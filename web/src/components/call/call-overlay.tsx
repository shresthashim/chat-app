"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useCallStore } from "@/store/call";
import * as call from "@/lib/call/call-manager";
import { startIncomingRingtone, startOutgoingRingback, stopRingtone } from "@/lib/call/ringtone";
import { cn } from "@/lib/utils";

/** Immersive, theme-independent backdrop for the call card. */
const CARD_BG = "radial-gradient(circle at 50% -20%, #2a2440 0%, #15121f 55%, #0c0a14 100%)";

export function CallOverlay() {
  const status = useCallStore((s) => s.status);
  if (status === "idle") return null;
  return <CallScreen />;
}

function CallScreen() {
  const { status, peer, media, localStream, remoteStream, muted, cameraOff, startedAt, endedReason } =
    useCallStore();

  const duration = useCallDuration(startedAt);
  const name = peer?.displayName || peer?.username || "Unknown";
  const isVideo = media === "video";
  const ringing = status === "outgoing" || status === "incoming";

  // Ringtone: incoming plays the bundled file, outgoing a synthesized ringback;
  // anything else (connecting/active/ended) is silent.
  useEffect(() => {
    if (status === "incoming") startIncomingRingtone();
    else if (status === "outgoing") startOutgoingRingback();
    else stopRingtone();
    return () => stopRingtone();
  }, [status]);

  const remoteVideoOn = isVideo && !!remoteStream;
  const selfPreview = isVideo && !remoteVideoOn && !!localStream && !cameraOff;
  const mainVideoStream = remoteVideoOn ? remoteStream : selfPreview ? localStream : null;
  const showPip = remoteVideoOn && !!localStream && !cameraOff;

  const statusLabel =
    status === "outgoing"
      ? "Ringing…"
      : status === "incoming"
        ? `Incoming ${isVideo ? "video" : "voice"} call`
        : status === "connecting"
          ? "Connecting…"
          : status === "ended"
            ? endedReason || "Call ended"
            : duration || "Connected";

  const controls =
    status === "incoming" ? (
      <>
        <Control label="Decline">
          <RoundButton variant="danger" big label="Decline" onClick={() => call.hangup()}>
            <PhoneOff className="h-6 w-6" />
          </RoundButton>
        </Control>
        <Control label="Accept">
          <RoundButton variant="accept" big label="Accept" onClick={() => void call.acceptCall()}>
            <Phone className="h-6 w-6" />
          </RoundButton>
        </Control>
      </>
    ) : status === "ended" ? null : (
      <>
        <Control label={muted ? "Unmute" : "Mute"}>
          <RoundButton variant={muted ? "toggled" : "neutral"} label={muted ? "Unmute" : "Mute"} onClick={call.toggleMute}>
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </RoundButton>
        </Control>
        {isVideo && (
          <Control label="Camera">
            <RoundButton
              variant={cameraOff ? "toggled" : "neutral"}
              label={cameraOff ? "Turn camera on" : "Turn camera off"}
              onClick={call.toggleCamera}
            >
              {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </RoundButton>
          </Control>
        )}
        <Control label="End">
          <RoundButton variant="danger" big label="End call" onClick={() => call.hangup()}>
            <PhoneOff className="h-6 w-6" />
          </RoundButton>
        </Control>
      </>
    );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${name}`}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-3xl border border-white/10 text-white shadow-[var(--shadow-pop)] animate-pop-in",
          mainVideoStream ? "max-w-4xl" : "max-w-sm",
        )}
        style={{ background: CARD_BG }}
      >
        {/* Remote audio plays even with no visible video (voice calls). */}
        {!isVideo && remoteStream && <AudioSink stream={remoteStream} />}

        {mainVideoStream ? (
          <div className="relative aspect-[3/4] w-full bg-black sm:aspect-auto sm:h-[78vh] sm:max-h-[720px]">
            <VideoTile
              stream={mainVideoStream}
              muted={!remoteVideoOn}
              mirror={selfPreview}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

            <div className="absolute inset-x-0 top-0 p-4">
              <MediaChip isVideo={isVideo} />
              <p className="mt-2 font-display text-base font-semibold leading-tight">{name}</p>
              <p className="text-xs text-white/70">{statusLabel}</p>
            </div>

            {showPip && (
              <div className="absolute right-3 top-3 h-32 w-24 overflow-hidden rounded-xl border border-white/20 shadow-[var(--shadow-pop)] sm:h-40 sm:w-28">
                <VideoTile stream={localStream} muted mirror className="h-full w-full object-cover" />
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-5 p-5 sm:gap-7">
              {controls}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-9 text-center">
            <MediaChip isVideo={isVideo} className="mb-7" />
            <Ringing active={ringing}>
              <Avatar name={name} src={peer?.avatarUrl || undefined} size="2xl" />
            </Ringing>
            <h2 className="mt-6 font-display text-xl font-semibold sm:text-2xl">{name}</h2>
            <p
              className={cn(
                "mt-1.5",
                status === "active" ? "font-mono text-base text-white/80" : "text-sm text-white/65",
              )}
            >
              {statusLabel}
            </p>
            <div className="mt-8 flex items-end justify-center gap-6">{controls}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaChip({ isVideo, className }: { isVideo: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur",
        className,
      )}
    >
      {isVideo ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
      {isVideo ? "Video call" : "Voice call"}
    </span>
  );
}

/** Expanding ring ripples around the avatar while ringing. Outline (not filled) and
 *  sized exactly to the avatar, so at rest it's just a hairline at the edge — no halo. */
function Ringing({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      {active && (
        <>
          <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-white/25" />
          <span className="absolute inset-0 animate-ping rounded-full ring-1 ring-white/15 [animation-delay:0.7s]" />
        </>
      )}
      <span className="relative">{children}</span>
    </span>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1.5">
      {children}
      <span className="text-[11px] text-white/55">{label}</span>
    </div>
  );
}

function RoundButton({
  variant,
  label,
  big,
  onClick,
  children,
}: {
  variant: "neutral" | "toggled" | "danger" | "accept";
  label: string;
  big?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-white/12 text-white hover:bg-white/20",
    toggled: "bg-white text-[#16131f] hover:bg-white/90",
    danger: "bg-danger text-white hover:opacity-90",
    accept: "bg-accent text-white hover:opacity-90",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full shadow-[var(--shadow-pop)] transition-all active:scale-95",
        big ? "h-14 w-14" : "h-12 w-12",
        styles[variant],
      )}
    >
      {children}
    </button>
  );
}

function VideoTile({
  stream,
  muted,
  mirror,
  className,
}: {
  stream: MediaStream | null;
  muted: boolean;
  mirror?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video ref={ref} autoPlay playsInline muted={muted} className={cn(mirror && "-scale-x-100", className)} />
  );
}

function AudioSink({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay className="hidden" />;
}

/** mm:ss elapsed since the call connected. */
function useCallDuration(startedAt: number | null): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "";
  const m = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
