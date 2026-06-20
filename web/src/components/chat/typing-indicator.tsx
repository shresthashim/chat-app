"use client";

import { useChatStore } from "@/store/chat";

export function TypingIndicator({ conversationId }: { conversationId: string }) {
  const typingMap = useChatStore((s) => s.typing[conversationId]);
  const typers = typingMap ? Object.values(typingMap) : [];
  if (typers.length === 0) return null;

  const label =
    typers.length === 1 ? `${typers[0]!.username} is typing` : `${typers.length} people are typing`;

  return (
    <div className="flex items-center gap-2 px-4 pb-1 pt-1 animate-fade-in">
      <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-3">
        <Dot /> <Dot delay="0.2s" /> <Dot delay="0.4s" />
      </span>
      <span className="text-xs text-muted-foreground">{label}…</span>
    </div>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return <span className="h-1.5 w-1.5 animate-typing rounded-full bg-muted-foreground" style={{ animationDelay: delay }} />;
}
