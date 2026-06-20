"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useDebounce } from "use-debounce";
import { usersApi } from "@/lib/api/users";
import { conversationsApi } from "@/lib/api/conversations";
import { useChatStore } from "@/store/chat";
import { toast } from "@/store/toast";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

export function NewChatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-5">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>Find someone by name, or gather a few people into a group.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="direct">
          <TabsList className="w-full">
            <TabsTrigger value="direct">One-on-one</TabsTrigger>
            <TabsTrigger value="group">New group</TabsTrigger>
          </TabsList>
          <TabsContent value="direct" className="pt-4 focus-visible:outline-none">
            <DirectFinder onDone={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="group" className="pt-4 focus-visible:outline-none">
            <GroupBuilder onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Shared people-search hook. */
function usePeopleSearch(query: string) {
  const [debounced] = useDebounce(query.trim(), 300);
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (debounced.length < 1) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    usersApi
      .search(debounced)
      .then(({ users }) => active && setResults(users))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  return { results, loading };
}

function DirectFinder({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const { results, loading } = usePeopleSearch(query);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const upsert = useChatStore((s) => s.upsertConversation);

  const startChat = async (user: User) => {
    setBusyId(user.id);
    try {
      const { conversation } = await conversationsApi.createDirect(user.id);
      upsert(conversation);
      onDone();
      router.push(`/chat/${conversation.id}`);
    } catch {
      toast({ variant: "error", title: "Couldn't start chat" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Search people by name or @username" />
      <PeopleResults
        loading={loading}
        results={results}
        query={query}
        renderAction={(user) => (
          <Button size="sm" variant="secondary" disabled={busyId === user.id} onClick={() => startChat(user)}>
            {busyId === user.id ? <Spinner /> : "Message"}
          </Button>
        )}
      />
    </div>
  );
}

function GroupBuilder({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { results, loading } = usePeopleSearch(query);
  const router = useRouter();
  const upsert = useChatStore((s) => s.upsertConversation);

  const toggle = (user: User) =>
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
    );

  const create = async () => {
    if (!name.trim() || selected.length === 0) return;
    setSubmitting(true);
    try {
      const { conversation } = await conversationsApi.createGroup({
        name: name.trim(),
        memberIds: selected.map((u) => u.id),
      });
      upsert(conversation);
      onDone();
      router.push(`/chat/${conversation.id}`);
    } catch {
      toast({ variant: "error", title: "Couldn't create group" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={60} />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-2 text-xs">
              <Avatar name={u.displayName || u.username} src={u.avatarUrl || undefined} size="sm" className="!h-5 !w-5" />
              {u.displayName || u.username}
              <button onClick={() => toggle(u)} className="cursor-pointer text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <SearchInput value={query} onChange={setQuery} placeholder="Add people" />
      <PeopleResults
        loading={loading}
        results={results}
        query={query}
        renderAction={(user) => {
          const isSelected = selected.some((u) => u.id === user.id);
          return (
            <button
              onClick={() => toggle(user)}
              className={cn(
                "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition-colors",
                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary",
              )}
            >
              {isSelected && <Check className="h-4 w-4" />}
            </button>
          );
        }}
      />
      <Button
        variant="gradient"
        className="mt-1"
        disabled={!name.trim() || selected.length === 0 || submitting}
        onClick={create}
      >
        {submitting ? <Spinner className="text-white" /> : (
          <>
            <Users className="h-4 w-4" /> Create group{selected.length > 0 ? ` · ${selected.length}` : ""}
          </>
        )}
      </Button>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" autoFocus />
    </div>
  );
}

function PeopleResults({
  loading,
  results,
  query,
  renderAction,
}: {
  loading: boolean;
  results: User[];
  query: string;
  renderAction: (user: User) => React.ReactNode;
}) {
  return (
    <div className="max-h-64 min-h-24 overflow-y-auto">
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {query.trim() ? "No people found" : "Start typing to search"}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {results.map((user) => (
            <li key={user.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <Avatar name={user.displayName || user.username} src={user.avatarUrl || undefined} online={user.online} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.displayName || user.username}</p>
                <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
              </div>
              {renderAction(user)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
