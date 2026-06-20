/** Thin wrapper around the Web Notifications API + a synthesized "ping". */

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showNotification(title: string, body: string, icon?: string): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  if (document.visibilityState === "visible") return false; // don't nag when focused
  try {
    new Notification(title, { body, icon, tag: "chathub-message" });
    return true;
  } catch {
    return false;
  }
}

let audioContext: AudioContext | null = null;

/** A short, soft two-tone ping — no asset to bundle. */
export function playPing(): void {
  if (typeof window === "undefined") return;
  try {
    audioContext ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioContext;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    /* autoplay restrictions — ignore */
  }
}
