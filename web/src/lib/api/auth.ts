import { api } from "./client";
import type { User } from "@/types";

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export const authApi = {
  checkUsername: (username: string) =>
    api.get<{ username: string; available: boolean }>(
      `/api/auth/check-username?username=${encodeURIComponent(username)}`,
    ),
  register: (payload: RegisterPayload) => api.post<{ user: User }>("/api/auth/register", payload),
  login: (payload: LoginPayload) => api.post<{ user: User }>("/api/auth/login", payload),
  logout: () => api.post<null>("/api/auth/logout"),
  logoutAll: () => api.post<null>("/api/auth/logout-all"),
  me: () => api.get<{ user: User }>("/api/auth/me"),
};

