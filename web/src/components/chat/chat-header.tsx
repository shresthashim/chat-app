"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Info, Phone, Video } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GroupInfoDialog } from "./group-info-dialog";
import { useChatStore } from "@/store/chat";
import { getConversationTitle, getConversationAvatar, getPeer, getGroupMemberSummary } from "@/lib/conversation";
import { formatLastSeen } from "@/lib/utils";
import * as call from "@/lib/call/call-manager";
import type { Conversation } from "@/types";

export function ChatHeader({ conversation, currentUserId }: { conversation: Conversation; currentUserId: string }) {
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(false);
  const isGroup = conversation.type === "group";

  const title = getConversationTitle(conversation, currentUserId);
  const avatar = getConversationAvatar(conversation, currentUserId);
  const peer = getPeer(conversation, currentUserId);

  const online = useChatStore((s) => (peer ? s.onlineUsers.has(peer.id) : false));
  const typingMap = useChatStore((s) => s.typing[conversation.id]);
  const someoneTyping = typingMap && Object.keys(typingMap).length > 0;

  const subtitle = someoneTyping
    ? "typing…"
    : isGroup
      ? getGroupMemberSummary(conversation, currentUserId)
      : online
        ? "Online"
        : peer?.lastSeenAt
          ? formatLastSeen(peer.lastSeenAt)
          : "Offline";

  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface px-3 py-3 sm:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Back" onClick={() => router.push("/chat")}>
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <button
        onClick={() => isGroup && setInfoOpen(true)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-default"
        disabled={!isGroup}
      >
        {isGroup ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-3 ring-1 ring-border">
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
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{title}</p>
          <p className={`truncate text-xs ${someoneTyping ? "text-accent" : online && !isGroup ? "text-accent" : "text-muted-foreground"}`}>
            {subtitle}
          </p>
        </div>
      </button>

      {!isGroup && peer && (
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voice call"
            onClick={() => void call.startCall(conversation.id, peer, "audio")}
          >
            <Phone className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Video call"
            onClick={() => void call.startCall(conversation.id, peer, "video")}
          >
            <Video className="h-5 w-5" />
          </Button>
        </>
      )}

      {isGroup && (
        <Button variant="ghost" size="icon" aria-label="Group details" onClick={() => setInfoOpen(true)}>
          <Info className="h-5 w-5" />
        </Button>
      )}

      {isGroup && (
        <GroupInfoDialog conversation={conversation} currentUserId={currentUserId} open={infoOpen} onOpenChange={setInfoOpen} />
      )}
    </header>
  );
}
