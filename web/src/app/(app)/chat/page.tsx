import { MessageCircleHeart } from "lucide-react";

/** Desktop empty state. On mobile this pane is hidden in favor of the list. */
export default function ChatIndexPage() {
  return (
    <div className="dot-grid flex h-dvh flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-brand text-white shadow-[var(--shadow-pop)]">
        <MessageCircleHeart className="h-9 w-9" />
      </span>
      <div className="max-w-sm">
        <h2 className="font-display text-2xl font-bold">Your conversations live here</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a chat from the left to jump back in, or start a new one. Messages, reactions and
          presence update in real time.
        </p>
      </div>
    </div>
  );
}
