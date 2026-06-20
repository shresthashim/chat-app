"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { MessageComposer } from "./message-composer";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/providers/auth-provider";
import { useMessages } from "@/hooks/use-messages";
import { useChatStore } from "@/store/chat";
import { conversationsApi } from "@/lib/api/conversations";
import { messagesApi } from "@/lib/api/messages";
import { toast } from "@/store/toast";
import type { Message } from "@/types";

export function ConversationView({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const conversation = useChatStore((s) => s.conversations.find((c) => c.id === conversationId));
  const upsert = useChatStore((s) => s.upsertConversation);
  const setActive = useChatStore((s) => s.setActiveConversation);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const isParticipant = Boolean(
    user && conversation?.participants.some((participant) => participant.user.id === user.id),
  );

  const messagesState = useMessages(conversationId, Boolean(user && conversation && isParticipant));
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [missing, setMissing] = useState(false);
  const inaccessible = Boolean(conversation && !isParticipant);

  // Track the active conversation so notifications/unread behave correctly.
  useEffect(() => {
    setActive(conversationId);
    return () => setActive(null);
  }, [conversationId, setActive]);

  // Hydrate the conversation if the user deep-linked / refreshed.
  useEffect(() => {
    if (conversation || !user) return;
    conversationsApi
      .get(conversationId)
      .then(({ conversation }) => upsert(conversation))
      .catch(() => setMissing(true));
  }, [conversation, conversationId, user, upsert]);

  if (!user) return null;

  if (missing || inaccessible) {
    return (
      <div className="flex h-dvh flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">This conversation could not be found.</p>
        <Button variant="secondary" onClick={() => router.replace("/chat")}>
          Back to chats
        </Button>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-dvh flex-1 items-center justify-center">
        <Spinner className="text-muted-foreground" />
      </div>
    );
  }

  const onDelete = async (m: Message) => {
    try {
      const { message } = await messagesApi.remove(conversationId, m.id);
      updateMessage(message);
    } catch {
      toast({ variant: "error", title: "Couldn't delete message" });
    }
  };

  const onReact = async (m: Message, emoji: string) => {
    try {
      const { message } = await messagesApi.react(conversationId, m.id, emoji);
      updateMessage(message);
    } catch {
      toast({ variant: "error", title: "Couldn't add reaction" });
    }
  };

  return (
    <div className="flex h-dvh min-w-0 flex-1 flex-col bg-background">
      <ChatHeader conversation={conversation} currentUserId={user.id} />
      <MessageList
        conversation={conversation}
        currentUserId={user.id}
        messages={messagesState.messages}
        loading={messagesState.loading}
        loadingMore={messagesState.loadingMore}
        hasMore={messagesState.hasMore}
        loadMore={messagesState.loadMore}
        onReply={(m) => {
          setEditing(null);
          setReplyTo(m);
        }}
        onEdit={(m) => {
          setReplyTo(null);
          setEditing(m);
        }}
        onDelete={onDelete}
        onReact={onReact}
      />
      <MessageComposer
        conversationId={conversationId}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
      />
    </div>
  );
}
