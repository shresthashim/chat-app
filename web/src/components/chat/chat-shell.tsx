"use client";

import { usePathname } from "next/navigation";
import { useConversations } from "@/hooks/use-conversations";
import { ConversationSidebar } from "./conversation-sidebar";
import { cn } from "@/lib/utils";

/**
 * Two-pane messaging layout. On mobile only one pane shows at a time:
 * the conversation list, or — once a chat is open — the conversation itself.
 */
export function ChatShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useConversations();
  const inConversation = pathname.startsWith("/chat/");

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <ConversationSidebar
        loading={loading}
        className={cn("w-full shrink-0 md:w-[348px] lg:w-[380px]", inConversation ? "hidden md:flex" : "flex")}
      />
      <main className={cn("min-w-0 flex-1", inConversation ? "flex" : "hidden md:flex")}>{children}</main>
    </div>
  );
}
