import { create } from "zustand";
import type { Conversation, Message } from "@/types";

interface TypingUser {
  id: string;
  username: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  cursors: Record<string, string | null>;
  /** conversationId -> userId -> typing user */
  typing: Record<string, Record<string, TypingUser>>;
  onlineUsers: Set<string>;

  setConversations: (conversations: Conversation[]) => void;
  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;

  setMessages: (conversationId: string, messages: Message[], nextCursor: string | null) => void;
  prependMessages: (conversationId: string, messages: Message[], nextCursor: string | null) => void;
  addMessage: (
    message: Message,
    currentUserId?: string,
    options?: { viewingConversation?: boolean },
  ) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (conversationId: string, messageId: string) => void;

  clearUnread: (conversationId: string) => void;
  applyReadReceipt: (receipt: { conversationId: string; userId: string; readAt: string; messageId?: string | null }) => void;

  setTyping: (conversationId: string, user: TypingUser) => void;
  clearTyping: (conversationId: string, userId: string) => void;
  clearAllTyping: () => void;

  setPresenceSnapshot: (userIds: string[]) => void;
  setOnline: (userId: string) => void;
  setOffline: (userId: string) => void;

  reset: () => void;
}

/** Sort conversations by most-recent activity (lastMessageAt, then updatedAt). */
function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    const at = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
    const bt = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
    return bt - at;
  });
}

function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  cursors: {},
  typing: {},
  onlineUsers: new Set<string>(),

  setConversations: (conversations) => set({ conversations: sortConversations(conversations) }),

  upsertConversation: (conversation) =>
    set((state) => {
      const exists = state.conversations.some((c) => c.id === conversation.id);
      const next = exists
        ? state.conversations.map((c) => (c.id === conversation.id ? conversation : c))
        : [conversation, ...state.conversations];
      return { conversations: sortConversations(next) };
    }),

  removeConversation: (id) =>
    set((state) => {
      return {
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        messages: omitRecordKey(state.messages, id),
        cursors: omitRecordKey(state.cursors, id),
        typing: omitRecordKey(state.typing, id),
      };
    }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages, nextCursor) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
      cursors: { ...state.cursors, [conversationId]: nextCursor },
    })),

  prependMessages: (conversationId, older, nextCursor) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...older, ...(state.messages[conversationId] ?? [])],
      },
      cursors: { ...state.cursors, [conversationId]: nextCursor },
    })),

  addMessage: (message, currentUserId, options) =>
    set((state) => {
      const list = state.messages[message.conversation] ?? [];
      // Replace an optimistic temp message or ignore duplicates.
      const withoutDupe = list.filter(
        (m) => m.id !== message.id && !(m.id.startsWith("temp-") && m.text === message.text && m.sender.id === message.sender.id),
      );
      const messages = { ...state.messages, [message.conversation]: [...withoutDupe, message] };

      const isActive = state.activeConversationId === message.conversation;
      const fromSelf = currentUserId ? message.sender.id === currentUserId : false;
      const viewingConversation = options?.viewingConversation ?? isActive;
      const conversations = state.conversations.map((c) =>
        c.id === message.conversation
          ? {
              ...c,
              lastMessage: message,
              lastMessageAt: message.createdAt,
              unreadCount: viewingConversation || fromSelf ? 0 : c.unreadCount + 1,
            }
          : c,
      );

      return { messages, conversations: sortConversations(conversations) };
    }),

  updateMessage: (message) =>
    set((state) => {
      const list = state.messages[message.conversation];
      const conversations = state.conversations.map((conversation) =>
        conversation.id === message.conversation && conversation.lastMessage?.id === message.id
          ? { ...conversation, lastMessage: message, lastMessageAt: message.createdAt }
          : conversation,
      );
      if (!list) return { conversations: sortConversations(conversations) };
      return {
        conversations: sortConversations(conversations),
        messages: {
          ...state.messages,
          [message.conversation]: list.map((m) => (m.id === message.id ? message : m)),
        },
      };
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => {
      const list = state.messages[conversationId];
      if (!list) return {};
      return {
        messages: {
          ...state.messages,
          [conversationId]: list.filter((message) => message.id !== messageId),
        },
      };
    }),

  clearUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    })),

  applyReadReceipt: ({ conversationId, userId, readAt, messageId }) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              participants: c.participants.map((p) =>
                p.user.id === userId ? { ...p, lastReadAt: readAt, lastReadMessage: messageId ?? p.lastReadMessage } : p,
              ),
            }
          : c,
      );

      const list = state.messages[conversationId];
      if (!list) return { conversations: sortConversations(conversations) };

      const targetMessage = messageId ? list.find((message) => message.id === messageId) : undefined;
      const cutoff = new Date(targetMessage?.createdAt ?? readAt).getTime();
      const messages = {
        ...state.messages,
        [conversationId]: list.map((message) => {
          if (message.sender.id === userId || new Date(message.createdAt).getTime() > cutoff) return message;
          if (message.readBy.some((receipt) => receipt.user === userId)) return message;
          return { ...message, readBy: [...message.readBy, { user: userId, readAt }] };
        }),
      };

      return { conversations: sortConversations(conversations), messages };
    }),

  setTyping: (conversationId, user) =>
    set((state) => ({
      typing: {
        ...state.typing,
        [conversationId]: { ...state.typing[conversationId], [user.id]: user },
      },
    })),

  clearTyping: (conversationId, userId) =>
    set((state) => {
      const current = { ...state.typing[conversationId] };
      delete current[userId];
      return { typing: { ...state.typing, [conversationId]: current } };
    }),

  clearAllTyping: () => set({ typing: {} }),

  setPresenceSnapshot: (userIds) => set({ onlineUsers: new Set(userIds) }),

  setOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),

  setOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  reset: () =>
    set({
      conversations: [],
      activeConversationId: null,
      messages: {},
      cursors: {},
      typing: {},
      onlineUsers: new Set<string>(),
    }),
}));

/** Convenience selector: is a given user currently online? */
export function selectIsOnline(userId: string | undefined): (state: ChatState) => boolean {
  return (state) => (userId ? state.onlineUsers.has(userId) : false);
}

/** Helper used outside React (e.g. socket handlers) — current store snapshot. */
export const chatStore = useChatStore;
export type { TypingUser };
