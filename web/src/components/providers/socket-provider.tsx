"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@/lib/events";
import { useChatStore } from "@/store/chat";
import { showNotification, playPing } from "@/lib/notifications";
import { useAuth } from "./auth-provider";
import type { Conversation, Message } from "@/types";

interface SocketContextValue {
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  // Auto-clear stale typing indicators if a STOP event is missed.
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const clearTypingTimers = () => {
    Object.values(typingTimers.current).forEach(clearTimeout);
    typingTimers.current = {};
  };

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      clearTypingTimers();
      useChatStore.getState().reset();
      setConnected(false);
      return;
    }

    const socket = connectSocket();
    const store = useChatStore.getState;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      clearTypingTimers();
      store().clearAllTyping();
    };

    const onSnapshot = ({ online }: { online: string[] }) => store().setPresenceSnapshot(online);
    const onOnline = ({ userId }: { userId: string }) => store().setOnline(userId);
    const onOffline = ({ userId }: { userId: string }) => store().setOffline(userId);

    const onMessageNew = (message: Message) => {
      const { activeConversationId, conversations } = store();
      const fromSelf = message.sender.id === user.id;
      const isActive = activeConversationId === message.conversation;
      const viewingConversation = isActive && document.visibilityState === "visible";
      store().addMessage(message, user.id, { viewingConversation });
      if (!fromSelf && !viewingConversation) {
        const conv = conversations.find((c) => c.id === message.conversation);
        const title = conv?.type === "group" && conv.name ? conv.name : message.sender.displayName || message.sender.username;
        const preview = message.text || (message.attachments.length ? "Sent an attachment" : "");
        const notified = showNotification(title, preview, message.sender.avatarUrl || undefined);
        if (notified || document.visibilityState !== "visible") playPing();
      }
    };

    const onMessageUpdate = (message: Message) => store().updateMessage(message);

    const onTypingStart = ({ conversationId, user: u }: { conversationId: string; user: { id: string; username: string } }) => {
      store().setTyping(conversationId, u);
      const key = `${conversationId}:${u.id}`;
      clearTimeout(typingTimers.current[key]);
      typingTimers.current[key] = setTimeout(() => store().clearTyping(conversationId, u.id), 4000);
    };
    const onTypingStop = ({ conversationId, user: u }: { conversationId: string; user: { id: string } }) =>
      store().clearTyping(conversationId, u.id);

    const onReceiptRead = (receipt: { conversationId: string; userId: string; readAt: string; messageId?: string | null }) =>
      store().applyReadReceipt(receipt);

    const onConversationNew = (conversation: Conversation) => store().upsertConversation(conversation);
    const onConversationUpdated = (conversation: Conversation) => store().upsertConversation(conversation);
    const onConversationRemoved = ({ conversationId }: { conversationId: string }) =>
      store().removeConversation(conversationId);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(SOCKET_EVENTS.PRESENCE_SNAPSHOT, onSnapshot);
    socket.on(SOCKET_EVENTS.PRESENCE_ONLINE, onOnline);
    socket.on(SOCKET_EVENTS.PRESENCE_OFFLINE, onOffline);
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
    socket.on(SOCKET_EVENTS.MESSAGE_EDITED, onMessageUpdate);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, onMessageUpdate);
    socket.on(SOCKET_EVENTS.MESSAGE_REACTION, onMessageUpdate);
    socket.on(SOCKET_EVENTS.TYPING_START, onTypingStart);
    socket.on(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
    socket.on(SOCKET_EVENTS.RECEIPT_READ, onReceiptRead);
    socket.on(SOCKET_EVENTS.CONVERSATION_NEW, onConversationNew);
    socket.on(SOCKET_EVENTS.CONVERSATION_UPDATED, onConversationUpdated);
    socket.on(SOCKET_EVENTS.CONVERSATION_REMOVED, onConversationRemoved);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SOCKET_EVENTS.PRESENCE_SNAPSHOT, onSnapshot);
      socket.off(SOCKET_EVENTS.PRESENCE_ONLINE, onOnline);
      socket.off(SOCKET_EVENTS.PRESENCE_OFFLINE, onOffline);
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onMessageNew);
      socket.off(SOCKET_EVENTS.MESSAGE_EDITED, onMessageUpdate);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, onMessageUpdate);
      socket.off(SOCKET_EVENTS.MESSAGE_REACTION, onMessageUpdate);
      socket.off(SOCKET_EVENTS.TYPING_START, onTypingStart);
      socket.off(SOCKET_EVENTS.TYPING_STOP, onTypingStop);
      socket.off(SOCKET_EVENTS.RECEIPT_READ, onReceiptRead);
      socket.off(SOCKET_EVENTS.CONVERSATION_NEW, onConversationNew);
      socket.off(SOCKET_EVENTS.CONVERSATION_UPDATED, onConversationUpdated);
      socket.off(SOCKET_EVENTS.CONVERSATION_REMOVED, onConversationRemoved);
      clearTypingTimers();
    };
  }, [user]);

  return <SocketContext.Provider value={{ connected }}>{children}</SocketContext.Provider>;
}

export function useSocketStatus(): SocketContextValue {
  return useContext(SocketContext);
}

/** Emit a typing signal to the active conversation. */
export function emitTyping(conversationId: string, isTyping: boolean): void {
  const socket = getSocket();
  if (!socket.connected) return;
  socket.emit(isTyping ? SOCKET_EVENTS.TYPING_START : SOCKET_EVENTS.TYPING_STOP, { conversationId });
}
