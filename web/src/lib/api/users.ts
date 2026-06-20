import { api } from "./client";
import type { User } from "@/types";

export interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  statusText?: string;
  avatarUrl?: string;
}

export const usersApi = {
  search: (q: string) => api.get<{ users: User[] }>(`/api/users/search?q=${encodeURIComponent(q)}`),
  get: (id: string) => api.get<{ user: User }>(`/api/users/${id}`),
  updateProfile: (payload: UpdateProfilePayload) => api.patch<{ user: User }>("/api/users/me", payload),
};
