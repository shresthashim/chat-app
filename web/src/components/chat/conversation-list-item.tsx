"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useChatStore } from "@/store/chat";
import { cn, formatListTimestamp } from "@/lib/utils";
import { getConversationTitle, getConversationAvatar, getMessagePreview, getPeer } from "@/lib/conversation";
import type { Conversation } from "@/types";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  active: boolean;
}

export function ConversationListItem({ conversation, currentUserId, active }: Props) {
  const title = getConversationTitle(conversation, currentUserId);
  const avatar = getConversationAvatar(conversation, currentUserId);
  const peer = getPeer(conversation, currentUserId);
  const online = useChatStore((s) => (peer ? s.onlineUsers.has(peer.id) : false));
  const typingMap = useChatStore((s) => s.typing[conversation.id]);
  const someoneTyping = typingMap && Object.keys(typingMap).length > 0;

  const lastMessage = conversation.lastMessage;
  const preview = someoneTyping ? "typing…" : getMessagePreview(lastMessage);
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
        active ? "bg-surface-2" : "hover:bg-surface-2/60",
      )}
    >
      {/* Signature: active conversation gets a gradient spine. */}
      {active && <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full gradient-brand" />}

      {conversation.type === "group" ? (
        <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 ring-1 ring-border">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={title} className="h-full w-full rounded-full object-cover" />
          ) : (
            <Users className="h-5 w-5 text-muted-foreground" />
          )}
        </span>
      ) : (
        <Avatar name={title} src={avatar} online={online} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm", hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
            {title}
          </span>
          {conversation.lastMessageAt && (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {formatListTimestamp(conversation.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-xs", someoneTyping ? "text-accent" : "text-muted-foreground", hasUnread && "text-foreground/80")}>
            {preview}
          </span>
          {hasUnread && <Badge variant="gradient">{conversation.unreadCount}</Badge>}
        </div>
      </div>
    </Link>
  );
}
