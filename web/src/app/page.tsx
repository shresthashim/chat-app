"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/brand";

/** Splash that routes to the app or login once the session resolves. */
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/chat" : "/login");
  }, [user, loading, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Logo className="h-12 w-12 animate-pulse" />
    </div>
  );
}
