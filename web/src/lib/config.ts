/** Base URL of the ChatHub API (Render in production, localhost in dev). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export const APP_NAME = "ChatHub";

/** Quick-reaction set shown on message hover (kept small and intentional). */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
