import type { Server, Socket } from "socket.io";
import type { Types } from "mongoose";
import { Conversation } from "../../models/Conversation.js";
import { SOCKET_EVENTS } from "../../config/constants.js";
import { userRoom } from "../io.js";
import { isUserOnline } from "../presence.js";
import type { AuthUser } from "../../types/index.js";

/**
 * 1:1 WebRTC signaling. The server never sees media — it only relays SDP/ICE
 * between the two members of a direct conversation, re-authorizing every
 * message against conversation membership so a socket can't ring/probe a user
 * it doesn't share a chat with.
 */
interface CallPayload {
  conversationId: string;
  callId: string;
  // sdp / candidate / media kind ride along and are relayed opaquely.
  [key: string]: unknown;
}

/** The single other member of a DIRECT conversation the user belongs to. */
async function directPeerId(conversationId: string, userId: string): Promise<string | null> {
  const conversation = await Conversation.findOne(
    { _id: conversationId, type: "direct", "participants.user": userId },
    { "participants.user": 1 },
  ).lean<{ participants: Array<{ user: Types.ObjectId }> } | null>();
  if (!conversation) return null;
  const peer = conversation.participants.find((p) => p.user.toString() !== userId);
  return peer ? peer.user.toString() : null;
}

export function registerCallHandlers(io: Server, socket: Socket, user: AuthUser): void {
  const from = { id: user.id, username: user.username };
  // The call this socket is currently engaged in, so we can notify the peer if the
  // socket drops (tab closed / crashed) without an explicit hang-up.
  let active: { callId: string; conversationId: string } | null = null;

  // Relay a signal to the verified peer across all their devices.
  const relay = (event: string) => async (payload: CallPayload) => {
    try {
      if (!payload?.conversationId || !payload.callId) return;
      const peerId = await directPeerId(payload.conversationId, user.id);
      if (!peerId) return;
      io.to(userRoom(peerId)).emit(event, { ...payload, from });
    } catch {
      // ignore transient lookup failures
    }
  };

  // Starting a call: verify membership, make sure the callee is reachable,
  // then ring them. If they're offline, tell the caller instead of ringing forever.
  socket.on(SOCKET_EVENTS.CALL_OFFER, async (payload: CallPayload) => {
    try {
      if (!payload?.conversationId || !payload.callId) return;
      const peerId = await directPeerId(payload.conversationId, user.id);
      if (!peerId) return;
      if (!isUserOnline(peerId)) {
        socket.emit(SOCKET_EVENTS.CALL_UNAVAILABLE, {
          callId: payload.callId,
          conversationId: payload.conversationId,
        });
        return;
      }
      active = { callId: payload.callId, conversationId: payload.conversationId };
      io.to(userRoom(peerId)).emit(SOCKET_EVENTS.CALL_OFFER, { ...payload, from });
    } catch {
      // Transient lookup failure — drop the signal; the client will time out.
    }
  });

  // Answering also marks this socket as engaged (callee side).
  socket.on(SOCKET_EVENTS.CALL_ANSWER, (payload: CallPayload) => {
    if (payload?.conversationId && payload.callId) {
      active = { callId: payload.callId, conversationId: payload.conversationId };
    }
    void relay(SOCKET_EVENTS.CALL_ANSWER)(payload);
  });

  socket.on(SOCKET_EVENTS.CALL_ICE, relay(SOCKET_EVENTS.CALL_ICE));
  socket.on(SOCKET_EVENTS.CALL_BUSY, relay(SOCKET_EVENTS.CALL_BUSY));

  // Terminal signals: clear our engaged state, then relay so the peer's UI ends too.
  const terminate = (event: string) => (payload: CallPayload) => {
    active = null;
    void relay(event)(payload);
  };
  socket.on(SOCKET_EVENTS.CALL_DECLINE, terminate(SOCKET_EVENTS.CALL_DECLINE));
  socket.on(SOCKET_EVENTS.CALL_CANCEL, terminate(SOCKET_EVENTS.CALL_CANCEL));
  socket.on(SOCKET_EVENTS.CALL_END, terminate(SOCKET_EVENTS.CALL_END));

  // Dropped connection during a call → end it for the other person too.
  socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
    if (!active) return;
    const ended = active;
    active = null;
    const peerId = await directPeerId(ended.conversationId, user.id).catch(() => null);
    if (peerId) io.to(userRoom(peerId)).emit(SOCKET_EVENTS.CALL_END, { ...ended, from });
  });
}
