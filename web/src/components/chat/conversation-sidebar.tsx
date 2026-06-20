"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PenSquare, Search, X, MessagesSquare } from "lucide-react";
import { Logo } from "@/components/brand";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { UserMenu } from "./user-menu";
import { ConversationListItem } from "./conversation-list-item";
import { NewChatDialog } from "./new-chat-dialog";
import { ProfileDialog } from "./profile-dialog";
import { SettingsDialog } from "./settings-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useChatStore } from "@/store/chat";
import { useDebounce } from "use-debounce";
import { messagesApi } from "@/lib/api/messages";
import { getConversationTitle } from "@/lib/conversation";
import { cn, formatTime } from "@/lib/utils";
import type { Message } from "@/types";

export function ConversationSidebar({ className, loading }: { className?: string; loading: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const conversations = useChatStore((s) => s.conversations);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<null | "new" | "profile" | "settings">(null);

  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : undefined;
  const trimmed = query.trim();

  const filtered = useMemo(() => {
    if (!trimmed || !user) return conversations;
    const q = trimmed.toLowerCase();
    return conversations.filter((c) => getConversationTitle(c, user.id).toLowerCase().includes(q));
  }, [conversations, trimmed, user]);

  if (!user) return null;

  return (
    <aside className={cn("flex flex-col border-r border-border bg-surface", className)}>
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-bold tracking-tight">ChatHub</span>
        </div>
        <div className="flex items-center gap-1">
          <SimpleTooltip label="New conversation">
            <Button variant="ghost" size="icon" onClick={() => setDialog("new")} aria-label="New conversation">
              <PenSquare className="h-[1.15rem] w-[1.15rem]" />
            </Button>
          </SimpleTooltip>
          <UserMenu onOpenProfile={() => setDialog("profile")} onOpenSettings={() => setDialog("settings")} />
        </div>
      </header>

      {/* Search */}
      <div className="px-4 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and messages"
            className="h-10 bg-surface-2 pl-9 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <SidebarSkeleton />
        ) : (
          <>
            <Section label={trimmed ? "Chats" : undefined}>
              {filtered.length === 0 && !trimmed ? (
                <EmptyConversations onNew={() => setDialog("new")} />
              ) : (
                filtered.map((c) => (
                  <ConversationListItem key={c.id} conversation={c} currentUserId={user.id} active={c.id === activeId} />
                ))
              )}
              {filtered.length === 0 && trimmed && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No chats match “{trimmed}”.</p>
              )}
            </Section>

            {trimmed.length >= 2 && <MessageSearch query={trimmed} />}
          </>
        )}
      </div>

      <NewChatDialog open={dialog === "new"} onOpenChange={(v) => setDialog(v ? "new" : null)} />
      <ProfileDialog open={dialog === "profile"} onOpenChange={(v) => setDialog(v ? "profile" : null)} />
      <SettingsDialog open={dialog === "settings"} onOpenChange={(v) => setDialog(v ? "settings" : null)} />
    </aside>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>}
      {children}
    </div>
  );
}

/** Cross-conversation message search results. */
function MessageSearch({ query }: { query: string }) {
  const [debounced] = useDebounce(query, 350);
  const router = useRouter();
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    messagesApi
      .search(debounced)
      .then(({ messages }) => active && setResults(messages))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  if (loading) return <p className="px-3 py-3 text-xs text-muted-foreground">Searching messages…</p>;
  if (results.length === 0) return null;

  return (
    <Section label="Messages">
      {results.map((m) => (
        <button
          key={m.id}
          onClick={() => router.push(`/chat/${m.conversation}`)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
            <MessagesSquare className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-medium">{m.sender.displayName || m.sender.username}: </span>
              <span className="text-muted-foreground">{m.text}</span>
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">{formatTime(m.createdAt)}</p>
          </div>
        </button>
      ))}
    </Section>
  );
}

function EmptyConversations({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
        <MessagesSquare className="h-6 w-6 text-muted-foreground" />
      </span>
      <div>
        <p className="text-sm font-medium">No conversations yet</p>
        <p className="text-xs text-muted-foreground">Start a chat to see it here.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onNew}>
        <PenSquare className="h-4 w-4" /> New conversation
      </Button>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
