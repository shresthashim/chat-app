/**
 * Call ringtones. Incoming uses a bundled audio file from /public; outgoing is a
 * synthesized "ringback" tone (no asset needed). All best-effort — browsers block
 * audio until the user has interacted with the page, so a ring may be silent if the
 * tab was never touched (the visual call UI always shows regardless).
 */

const INCOMING_SRC = "/mixkit-waiting-ringtone-1354.wav";

let incomingAudio: HTMLAudioElement | null = null;
let outgoing: { ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null = null;

function AudioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/** Loop the user-provided ringtone file for an incoming call. */
export function startIncomingRingtone(): void {
  stopRingtone();
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(INCOMING_SRC);
    audio.loop = true;
    audio.volume = 0.6;
    incomingAudio = audio;
    void audio.play().catch(() => undefined); // blocked until user gesture — ignore
  } catch {
    /* ignore */
  }
}

/** Synthesize a repeating ringback tone (~440/480 Hz burst every 3s) for outgoing calls. */
export function startOutgoingRingback(): void {
  stopRingtone();
  const Ctx = AudioCtor();
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    void ctx.resume?.();

    const ring = () => {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
      gain.gain.setValueAtTime(0.05, now + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

      for (const freq of [440, 480]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 1.15);
      }
    };

    ring();
    outgoing = { ctx, timer: setInterval(ring, 3000) };
  } catch {
    /* ignore */
  }
}

/** Stop whatever ringtone is currently playing. */
export function stopRingtone(): void {
  if (incomingAudio) {
    incomingAudio.pause();
    incomingAudio.currentTime = 0;
    incomingAudio = null;
  }
  if (outgoing) {
    clearInterval(outgoing.timer);
    void outgoing.ctx.close().catch(() => undefined);
    outgoing = null;
  }
}
