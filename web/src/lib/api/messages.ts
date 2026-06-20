import { api } from "./client";
import type { Attachment, Message } from "@/types";

export interface SendMessagePayload {
  text?: string;
  attachments?: Attachment[];
  replyTo?: string;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export const messagesApi = {
  list: (conversationId: string, cursor?: string, limit = 30) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<MessagePage>(`/api/conversations/${conversationId}/messages?${params.toString()}`);
  },
  send: (conversationId: string, payload: SendMessagePayload) =>
    api.post<{ message: Message }>(`/api/conversations/${conversationId}/messages`, payload),
  edit: (conversationId: string, messageId: string, text: string) =>
    api.patch<{ message: Message }>(`/api/conversations/${conversationId}/messages/${messageId}`, { text }),
  remove: (conversationId: string, messageId: string) =>
    api.delete<{ message: Message }>(`/api/conversations/${conversationId}/messages/${messageId}`),
  react: (conversationId: string, messageId: string, emoji: string) =>
    api.post<{ message: Message }>(`/api/conversations/${conversationId}/messages/${messageId}/reactions`, {
      emoji,
    }),
  search: (q: string) => api.get<{ messages: Message[] }>(`/api/messages/search?q=${encodeURIComponent(q)}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<{ attachment: Attachment }>("/api/uploads", form);
  },
};
