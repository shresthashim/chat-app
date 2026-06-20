"use client";

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { Spinner } from "@/components/ui/spinner";
import { formatDayLabel } from "@/lib/utils";
import { getPeer } from "@/lib/conversation";
import type { Conversation, Message, Participant } from "@/types";

const RUN_GAP_MS = 5 * 60 * 1000;

interface Props {
  conversation: Conversation;
  currentUserId: string;
  messages: Message[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
}

export function MessageList({
  conversation,
  currentUserId,
  messages,
  loading,
  loadingMore,
  hasMore,
  loadMore,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const prevScrollHeight = useRef(0);
  const prevCount = useRef(0);
  const initializedFor = useRef<string | null>(null);

  const isGroup = conversation.type === "group";

  const peer = getPeer(conversation, currentUserId);
  const peerParticipant = conversation.participants.find((p) => p.user.id === peer?.id);

  function readCutoff(participant: Participant): number | null {
    if (participant.lastReadMessage) {
      const target = messages.find((message) => message.id === participant.lastReadMessage);
      if (target) return new Date(target.createdAt).getTime();
    }
    return participant.lastReadAt ? new Date(participant.lastReadAt).getTime() : null;
  }

  function hasRead(participant: Participant, message: Message): boolean {
    const cutoff = readCutoff(participant);
    return cutoff !== null && cutoff >= new Date(message.createdAt).getTime();
  }

  function groupReaders(message: Message): Participant[] {
    const readBy = new Set(message.readBy.map((receipt) => receipt.user));
    return conversation.participants.filter(
      (participant) =>
        participant.user.id !== currentUserId &&
        (readBy.has(participant.user.id) || hasRead(participant, message)),
    );
  }

  // Scroll management: jump to the bottom when a conversation opens, follow new
  // messages when already near the bottom, and preserve position when paginating.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el || messages.length === 0) return;

    // First render of this conversation — snap straight to the latest message.
    if (initializedFor.current !== conversation.id) {
      initializedFor.current = conversation.id;
      nearBottom.current = true;
      prevCount.current = messages.length;
      prevScrollHeight.current = 0;
      el.scrollTop = el.scrollHeight;
      return;
    }

    const added = messages.length - prevCount.current;
    prevCount.current = messages.length;
    if (added <= 0) return;

    // Older messages prepended (pagination): keep the viewport anchored.
    if (added > 1 && !nearBottom.current && prevScrollHeight.current) {
      el.scrollTop = el.scrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = 0;
    } else if (nearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation.id, messages.length]);

  // Media loads asynchronously and grows the content height; re-pin to the bottom
  // as images finish loading so opening a chat reliably lands on the newest message.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onMediaLoad = () => {
      if (nearBottom.current) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("load", onMediaLoad, true);
    return () => el.removeEventListener("load", onMediaLoad, true);
  }, []);

  const onScroll = () => {
    const el = viewport.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80 && hasMore && !loadingMore) {
      prevScrollHeight.current = el.scrollHeight;
      loadMore();
    }
  };

  return (
    <div ref={viewport} onScroll={onScroll} className="flex-1 overflow-y-auto py-4">
      {loading && messages.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <Spinner className="text-muted-foreground" />
        </div>
      )}
      {loadingMore && (
        <div className="flex justify-center py-2">
          <Spinner className="text-muted-foreground" />
        </div>
      )}
      {!hasMore && messages.length > 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">This is the beginning of your conversation.</p>
      )}

      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const dayChanged =
          !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
        const startsRun =
          dayChanged ||
          !prev ||
          prev.sender.id !== m.sender.id ||
          Boolean(prev.deletedAt) ||
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > RUN_GAP_MS;

        return (
          <Fragment key={m.id}>
            {dayChanged && <DayDivider date={m.createdAt} />}
            <MessageBubble
              message={m}
              currentUserId={currentUserId}
              isGroup={isGroup}
              startsRun={startsRun}
              seen={!isGroup && m.sender.id === currentUserId && peerParticipant ? hasRead(peerParticipant, m) : undefined}
              seenBy={isGroup && m.sender.id === currentUserId ? groupReaders(m) : undefined}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
            />
          </Fragment>
        );
      })}

      <TypingIndicator conversationId={conversation.id} />
    </div>
  );
}

function DayDivider({ date }: { date: string }) {
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted-foreground">
        {formatDayLabel(date)}
      </span>
    </div>
  );
}
