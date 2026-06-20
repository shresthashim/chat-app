"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, type LoginPayload, type RegisterPayload } from "@/lib/api/auth";
import { useChatStore } from "@/store/chat";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      useChatStore.getState().reset();
      setUser(null);
    }
  }, []);

  // Resolve the session once on mount (httpOnly cookie lives on the API domain).
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (payload: LoginPayload) => {
    const { user } = await authApi.login(payload);
    useChatStore.getState().reset();
    setUser(user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { user } = await authApi.register(payload);
    useChatStore.getState().reset();
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => null);
    useChatStore.getState().reset();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, setUser, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
