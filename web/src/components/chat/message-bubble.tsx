"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, SmilePlus, Reply, Pencil, Trash2, Check, CheckCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MessageAttachments } from "./message-attachments";
import { SeenByDialog } from "./seen-by-dialog";
import { QUICK_REACTIONS } from "@/lib/config";
import { cn, formatTime } from "@/lib/utils";
import type { Message, Participant } from "@/types";

interface Props {
  message: Message;
  currentUserId: string;
  isGroup: boolean;
  /** First message in a same-sender run — shows avatar/name + more spacing. */
  startsRun: boolean;
  /** Whether another participant has read this own message. */
  seen?: boolean;
  seenBy?: Participant[];
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
}

export function MessageBubble({
  message,
  currentUserId,
  isGroup,
  startsRun,
  seen,
  seenBy = [],
  onReply,
  onEdit,
  onDelete,
  onReact,
}: Props) {
  const own = message.sender.id === currentUserId;
  const deleted = Boolean(message.deletedAt);
  const [seenOpen, setSeenOpen] = useState(false);
  const seenCount = seenBy.length;
  // Attachment with no caption/reply: let the media define its own shape — no bubble card.
  const bareMedia = !deleted && message.attachments.length > 0 && !message.text && !message.replyTo;

  // Collapse reactions into emoji -> { count, mine }.
  const reactions = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of message.reactions) {
      const entry = map.get(r.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (r.user === currentUserId) entry.mine = true;
      map.set(r.emoji, entry);
    }
    return [...map.entries()];
  }, [message.reactions, currentUserId]);

  return (
    <div className={cn("group flex gap-2 px-3 sm:px-4", own ? "flex-row-reverse" : "flex-row", startsRun ? "mt-3" : "mt-0.5")}>
      {/* Avatar gutter (received group messages) */}
      {!own && isGroup ? (
        <div className="w-8 shrink-0">
          {startsRun && <Avatar name={message.sender.displayName || message.sender.username} src={message.sender.avatarUrl || undefined} size="sm" />}
        </div>
      ) : null}

      <div className={cn("flex min-w-0 max-w-[78%] flex-col sm:max-w-[68%]", own ? "items-end" : "items-start")}>
        {!own && isGroup && startsRun && (
          <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">
            {message.sender.displayName || message.sender.username}
          </span>
        )}

        <div className={cn("flex items-center gap-1", own ? "flex-row-reverse" : "flex-row")}>
          {/* Bubble */}
          <div
            className={cn(
              "relative w-fit max-w-full animate-message-in overflow-hidden rounded-2xl text-sm leading-relaxed",
              !bareMedia && "px-3.5 py-2",
              !bareMedia &&
                (own
                  ? "bg-bubble-self text-bubble-self-foreground rounded-br-md"
                  : "bg-surface-2 text-foreground rounded-bl-md"),
            )}
          >
            {message.replyTo && !deleted && (
              <div className={cn("mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs", own ? "border-white/40 bg-white/10" : "border-primary bg-surface-3")}>
                <span className="font-medium">{message.replyTo.sender.displayName || message.replyTo.sender.username}</span>
                <p className="truncate opacity-80">{message.replyTo.text || "Attachment"}</p>
              </div>
            )}

            {deleted ? (
              <span className="italic opacity-70">This message was deleted</span>
            ) : (
              <div className="flex flex-col gap-1.5">
                {message.attachments.length > 0 && <MessageAttachments attachments={message.attachments} />}
                {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
              </div>
            )}
          </div>

          {/* Hover actions */}
          {!deleted && (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Popover>
                <PopoverTrigger className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                  <SmilePlus className="h-4 w-4" />
                </PopoverTrigger>
                <PopoverContent className="flex gap-0.5 p-1" align={own ? "end" : "start"}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onReact(message, emoji)}
                      className="cursor-pointer rounded-lg p-1.5 text-lg transition-transform hover:scale-125 hover:bg-surface-2"
                    >
                      {emoji}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <button
                onClick={() => onReply(message)}
                className="cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label="Reply"
              >
                <Reply className="h-4 w-4" />
              </button>

              {own && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={own ? "end" : "start"}>
                    {message.text && (
                      <DropdownMenuItem onSelect={() => onEdit(message)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem destructive onSelect={() => onDelete(message)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", own ? "justify-end" : "justify-start")}>
            {reactions.map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={() => onReact(message, emoji)}
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                  mine ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <span>{emoji}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Meta: time, edited, receipt */}
        <div className={cn("mt-0.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground", own ? "flex-row-reverse" : "flex-row")}>
          <span className="font-mono">{formatTime(message.createdAt)}</span>
          {message.editedAt && !deleted && <span>· edited</span>}
          {own && !deleted && (
            isGroup ? (
              <button
                type="button"
                onClick={() => setSeenOpen(true)}
                className={cn(
                  "flex cursor-pointer items-center gap-0.5 rounded px-0.5 transition-colors hover:text-foreground",
                  seenCount > 0 && "text-accent",
                )}
                aria-label="View seen by"
              >
                {seenCount > 0 ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {seenCount > 0 && <span>{seenCount}</span>}
              </button>
            ) : seen ? (
              <CheckCheck className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )
          )}
        </div>
      </div>
      {own && isGroup && !deleted && (
        <SeenByDialog open={seenOpen} onOpenChange={setSeenOpen} readers={seenBy} />
      )}
    </div>
  );
}
