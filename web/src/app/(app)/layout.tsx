"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Splash } from "@/components/splash";
import { ChatShell } from "@/components/chat/chat-shell";

/** Guards every page under (app): unauthenticated users are sent to /login. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <Splash />;

  return <ChatShell>{children}</ChatShell>;
}
