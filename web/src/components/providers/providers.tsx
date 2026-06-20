"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";
import { SocketProvider } from "./socket-provider";

/** Single composition root for all client-side context providers. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <TooltipProvider delayDuration={250}>
            {children}
            <Toaster />
          </TooltipProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
