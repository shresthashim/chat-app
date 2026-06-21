import { getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@/lib/events";
import { callsApi } from "@/lib/api/calls";
import { useCallStore, type CallMedia } from "@/store/call";
import type { UserRef } from "@/types";

/**
 * Owns the single active 1:1 WebRTC call: the RTCPeerConnection, local/remote
 * media, and the signaling exchanged over Socket.IO. It drives the call store
 * (which the UI renders) and is deliberately framework-free so the React layer
 * stays thin.
 *
 * Caller flow:  startCall → offer → (answer) → ICE → connected
 * Callee flow:  handleIncomingOffer → acceptCall → answer → ICE → connected
 */

const RING_TIMEOUT_MS = 35_000; // stop ringing if unanswered
const ENDED_LINGER_MS = 2_500; // keep the "ended" screen up briefly

interface Session {
  pc: RTCPeerConnection | null;
  callId: string;
  conversationId: string;
  peer: UserRef;
  media: CallMedia;
  role: "caller" | "callee";
  incomingOffer: RTCSessionDescriptionInit | null;
  pendingCandidates: RTCIceCandidateInit[];
}

let session: Session | null = null;
let ringTimer: ReturnType<typeof setTimeout> | null = null;
let endedTimer: ReturnType<typeof setTimeout> | null = null;

const store = () => useCallStore.getState();
const socket = () => getSocket();

function clearRingTimer(): void {
  if (ringTimer) {
    clearTimeout(ringTimer);
    ringTimer = null;
  }
}

function isFree(): boolean {
  const s = store().status;
  return s === "idle" || s === "ended";
}

function getLocalMedia(media: CallMedia): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: media === "video" ? { facingMode: "user" } : false,
  });
}

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const { iceServers } = await callsApi.iceServers();
    return iceServers as RTCIceServer[];
  } catch {
    // Keep calls working in dev even if the endpoint hiccups.
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

function buildPeerConnection(iceServers: RTCIceServer[]): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (e) => {
    if (e.candidate && session) {
      socket().emit(SOCKET_EVENTS.CALL_ICE, {
        conversationId: session.conversationId,
        callId: session.callId,
        candidate: e.candidate.toJSON(),
      });
    }
  };

  pc.ontrack = (e) => {
    const remote = e.streams[0];
    if (remote) store().patch({ remoteStream: remote });
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      if (store().status !== "active") store().patch({ status: "active", startedAt: Date.now() });
    } else if (pc.connectionState === "failed") {
      hangup("Connection lost");
    }
  };

  return pc;
}

/** Add any ICE candidates that arrived before the remote description was set. */
async function drainCandidates(): Promise<void> {
  if (!session?.pc) return;
  const queued = session.pendingCandidates;
  session.pendingCandidates = [];
  for (const candidate of queued) {
    await session.pc.addIceCandidate(candidate).catch(() => undefined);
  }
}

/** Tear down local resources and surface a terminal state — does NOT signal the peer. */
function teardown(reason: string): void {
  clearRingTimer();
  const ending = session;
  session = null;

  if (ending?.pc) {
    ending.pc.onicecandidate = null;
    ending.pc.ontrack = null;
    ending.pc.onconnectionstatechange = null;
    ending.pc.close();
  }

  const { localStream, remoteStream } = store();
  localStream?.getTracks().forEach((t) => t.stop());
  remoteStream?.getTracks().forEach((t) => t.stop());

  store().patch({
    status: "ended",
    endedReason: reason,
    localStream: null,
    remoteStream: null,
    startedAt: null,
  });

  if (endedTimer) clearTimeout(endedTimer);
  endedTimer = setTimeout(() => {
    if (store().status === "ended") store().reset();
  }, ENDED_LINGER_MS);
}

/** Notify the peer of a local-side termination appropriate to the current state. */
function signalTerminate(): void {
  if (!session) return;
  const status = store().status;
  const event =
    status === "outgoing"
      ? SOCKET_EVENTS.CALL_CANCEL
      : status === "incoming"
        ? SOCKET_EVENTS.CALL_DECLINE
        : SOCKET_EVENTS.CALL_END;
  socket().emit(event, { conversationId: session.conversationId, callId: session.callId });
}

// ─── Public API (caller) ──────────────────────────────────────────────

export async function startCall(conversationId: string, peer: UserRef, media: CallMedia): Promise<void> {
  if (!isFree()) return;

  const callId = crypto.randomUUID();
  session = {
    pc: null,
    callId,
    conversationId,
    peer,
    media,
    role: "caller",
    incomingOffer: null,
    pendingCandidates: [],
  };
  store().patch({
    status: "outgoing",
    callId,
    conversationId,
    peer,
    media,
    muted: false,
    cameraOff: false,
    startedAt: null,
    endedReason: null,
    localStream: null,
    remoteStream: null,
  });

  let local: MediaStream;
  try {
    local = await getLocalMedia(media);
  } catch {
    teardown("Microphone/camera blocked");
    return;
  }
  if (session?.callId !== callId) return void local.getTracks().forEach((t) => t.stop());
  store().patch({ localStream: local });

  const iceServers = await fetchIceServers();
  if (session?.callId !== callId) return void local.getTracks().forEach((t) => t.stop());

  const pc = buildPeerConnection(iceServers);
  session.pc = pc;
  local.getTracks().forEach((t) => pc.addTrack(t, local));

  let offer: RTCSessionDescriptionInit;
  try {
    offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  } catch {
    return; // torn down mid-negotiation
  }
  if (session?.callId !== callId) return;

  socket().emit(SOCKET_EVENTS.CALL_OFFER, { conversationId, callId, media, sdp: offer });
  ringTimer = setTimeout(() => hangup("No answer"), RING_TIMEOUT_MS);
}

// ─── Public API (callee) ──────────────────────────────────────────────

export function handleIncomingOffer(
  payload: { conversationId: string; callId: string; media: CallMedia; sdp: RTCSessionDescriptionInit },
  peer: UserRef,
): void {
  if (!isFree()) {
    // Already on a call — let the caller know instead of silently dropping.
    socket().emit(SOCKET_EVENTS.CALL_BUSY, {
      conversationId: payload.conversationId,
      callId: payload.callId,
    });
    return;
  }

  session = {
    pc: null,
    callId: payload.callId,
    conversationId: payload.conversationId,
    peer,
    media: payload.media,
    role: "callee",
    incomingOffer: payload.sdp,
    pendingCandidates: [],
  };
  store().patch({
    status: "incoming",
    callId: payload.callId,
    conversationId: payload.conversationId,
    peer,
    media: payload.media,
    muted: false,
    cameraOff: false,
    startedAt: null,
    endedReason: null,
    localStream: null,
    remoteStream: null,
  });
  ringTimer = setTimeout(() => hangup("Missed call"), RING_TIMEOUT_MS);
}

export async function acceptCall(): Promise<void> {
  if (!session || session.role !== "callee" || !session.incomingOffer) return;
  const { callId, incomingOffer } = session;
  clearRingTimer();
  store().patch({ status: "connecting" });

  let local: MediaStream;
  try {
    local = await getLocalMedia(session.media);
  } catch {
    hangup("Microphone/camera blocked");
    return;
  }
  if (session?.callId !== callId) return void local.getTracks().forEach((t) => t.stop());
  store().patch({ localStream: local });

  const iceServers = await fetchIceServers();
  if (session?.callId !== callId) return void local.getTracks().forEach((t) => t.stop());

  const pc = buildPeerConnection(iceServers);
  session.pc = pc;
  local.getTracks().forEach((t) => pc.addTrack(t, local));

  let answer: RTCSessionDescriptionInit;
  try {
    await pc.setRemoteDescription(incomingOffer);
    await drainCandidates();
    answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  } catch {
    return; // torn down mid-negotiation
  }
  if (session?.callId !== callId) return;

  socket().emit(SOCKET_EVENTS.CALL_ANSWER, {
    conversationId: session.conversationId,
    callId,
    sdp: answer,
  });
}

// ─── Signaling handlers (from CallProvider) ───────────────────────────

export async function handleAnswer(payload: { callId: string; sdp: RTCSessionDescriptionInit }): Promise<void> {
  if (!session || session.callId !== payload.callId || !session.pc) return;
  clearRingTimer();
  store().patch({ status: "connecting" });
  await session.pc.setRemoteDescription(payload.sdp).catch(() => undefined);
  await drainCandidates();
}

export async function handleRemoteIce(payload: { callId: string; candidate: RTCIceCandidateInit }): Promise<void> {
  if (!session || session.callId !== payload.callId) return;
  const pc = session.pc;
  if (pc?.remoteDescription) {
    await pc.addIceCandidate(payload.candidate).catch(() => undefined);
  } else {
    session.pendingCandidates.push(payload.candidate);
  }
}

/** A signal only matters for the current call, and only in a state where it makes sense. */
function matches(callId: string, ...states: Array<ReturnType<typeof store>["status"]>): boolean {
  return session?.callId === callId && states.includes(store().status);
}

// Decline/busy/unavailable only make sense while we're the one ringing out. Guarding
// on state stops a stray late signal (e.g. a second device timing out on the same
// callId) from tearing down a call that's already connected.
export function handleDecline(payload: { callId: string }): void {
  if (matches(payload.callId, "outgoing")) teardown("Call declined");
}
export function handleBusy(payload: { callId: string }): void {
  if (matches(payload.callId, "outgoing")) teardown("User is busy");
}
export function handleUnavailable(payload: { callId: string }): void {
  if (matches(payload.callId, "outgoing")) teardown("User is unavailable");
}
// Cancel only applies while we're still being rung (haven't accepted yet).
export function handleCancel(payload: { callId: string }): void {
  if (matches(payload.callId, "incoming")) teardown("Call canceled");
}
// The peer can hang up an established (or connecting) call at any point.
export function handleRemoteEnd(payload: { callId: string }): void {
  if (matches(payload.callId, "connecting", "active", "outgoing", "incoming")) teardown("Call ended");
}

// ─── Local controls ───────────────────────────────────────────────────

/** End the call from our side (decline if ringing-in, cancel if ringing-out, else hang up). */
export function hangup(reason?: string): void {
  if (!session) return;
  const status = store().status;
  signalTerminate();
  teardown(reason ?? (status === "incoming" ? "Declined" : "Call ended"));
}

export function toggleMute(): void {
  const { localStream, muted } = store();
  if (!localStream) return;
  const next = !muted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
  store().patch({ muted: next });
}

export function toggleCamera(): void {
  const { localStream, cameraOff } = store();
  if (!localStream) return;
  const next = !cameraOff;
  localStream.getVideoTracks().forEach((t) => (t.enabled = !next));
  store().patch({ cameraOff: next });
}
