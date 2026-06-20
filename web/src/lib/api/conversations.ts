import { api } from "./client";
import type { Conversation } from "@/types";

export interface CreateGroupPayload {
  name: string;
  memberIds: string[];
  avatarUrl?: string;
}

export const conversationsApi = {
  list: () => api.get<{ conversations: Conversation[] }>("/api/conversations"),
  get: (id: string) => api.get<{ conversation: Conversation }>(`/api/conversations/${id}`),
  createDirect: (userId: string) =>
    api.post<{ conversation: Conversation }>("/api/conversations/direct", { userId }),
  createGroup: (payload: CreateGroupPayload) =>
    api.post<{ conversation: Conversation }>("/api/conversations/group", payload),
  updateGroup: (id: string, payload: Partial<Pick<Conversation, "name" | "description" | "avatarUrl">>) =>
    api.patch<{ conversation: Conversation }>(`/api/conversations/${id}`, payload),
  addMembers: (id: string, memberIds: string[]) =>
    api.post<{ conversation: Conversation }>(`/api/conversations/${id}/members`, { memberIds }),
  removeMember: (id: string, memberId: string) =>
    api.delete<{ conversation: Conversation | null }>(`/api/conversations/${id}/members/${memberId}`),
  markRead: (id: string, messageId?: string) =>
    api.post<{ conversationId: string; userId: string; messageId: string | null; readAt: string }>(
      `/api/conversations/${id}/read`,
      {
        messageId,
      },
    ),
};
