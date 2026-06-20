"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, LogOut, Shield, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useDebounce } from "use-debounce";
import { usersApi } from "@/lib/api/users";
import { conversationsApi } from "@/lib/api/conversations";
import { useChatStore } from "@/store/chat";
import { toast } from "@/store/toast";
import type { Conversation, User } from "@/types";

interface Props {
  conversation: Conversation;
  currentUserId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GroupInfoDialog({ conversation, currentUserId, open, onOpenChange }: Props) {
  const router = useRouter();
  const upsert = useChatStore((s) => s.upsertConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const isAdmin = conversation.participants.find((p) => p.user.id === currentUserId)?.role === "admin";

  const [name, setName] = useState(conversation.name);
  const [savingName, setSavingName] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const existingIds = useMemo(
    () => conversation.participants.map((p) => p.user.id),
    [conversation.participants],
  );

  useEffect(() => setName(conversation.name), [conversation.name]);

  const saveName = async () => {
    if (!name.trim() || name === conversation.name) return;
    setSavingName(true);
    try {
      const { conversation: updated } = await conversationsApi.updateGroup(conversation.id, { name: name.trim() });
      upsert(updated);
      toast({ variant: "success", title: "Group renamed" });
    } catch {
      toast({ variant: "error", title: "Couldn't rename group" });
    } finally {
      setSavingName(false);
    }
  };

  const removeMember = async (userId: string) => {
    setBusy(true);
    try {
      const { conversation: updated } = await conversationsApi.removeMember(conversation.id, userId);
      if (updated) upsert(updated);
    } catch {
      toast({ variant: "error", title: "Couldn't remove member" });
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await conversationsApi.removeMember(conversation.id, currentUserId);
      removeConversation(conversation.id);
      onOpenChange(false);
      router.replace("/chat");
    } catch {
      toast({ variant: "error", title: "Couldn't leave group" });
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (user: User) => {
    setBusy(true);
    try {
      const { conversation: updated } = await conversationsApi.addMembers(conversation.id, [user.id]);
      upsert(updated);
      setQuery("");
    } catch {
      toast({ variant: "error", title: "Couldn't add member" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Group details</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isAdmin ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Group name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </div>
              <Button variant="secondary" disabled={savingName || name === conversation.name} onClick={saveName}>
                {savingName ? <Spinner /> : "Save"}
              </Button>
            </div>
          ) : (
            <p className="font-display text-lg font-semibold">{conversation.name}</p>
          )}

          {isAdmin && (
            <AddMemberSearch
              query={query}
              setQuery={setQuery}
              onAdd={addMember}
              existingIds={existingIds}
              disabled={busy}
            />
          )}

          <Separator />

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {conversation.participants.length} members
            </p>
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {conversation.participants.map((p) => (
                <li key={p.user.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                  <Avatar name={p.user.displayName || p.user.username} src={p.user.avatarUrl || undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.user.id === currentUserId ? "You" : p.user.displayName || p.user.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">@{p.user.username}</p>
                  </div>
                  {p.role === "admin" && (
                    <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  )}
                  {isAdmin && p.user.id !== currentUserId && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => removeMember(p.user.id)}>
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <Button variant="outline" className="text-danger" disabled={busy} onClick={leave}>
            <LogOut className="h-4 w-4" /> Leave group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberSearch({
  query,
  setQuery,
  onAdd,
  existingIds,
  disabled,
}: {
  query: string;
  setQuery: (v: string) => void;
  onAdd: (user: User) => void;
  existingIds: string[];
  disabled: boolean;
}) {
  const [debounced] = useDebounce(query.trim(), 300);
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    usersApi
      .search(debounced)
      .then(({ users }) => active && setResults(users.filter((u) => !existingIds.includes(u.id))))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced, existingIds]);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add people" className="pl-9" />
      </div>
      {(loading || results.length > 0) && (
        <ul className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto">
          {loading && <li className="px-2 py-2 text-xs text-muted-foreground">Searching…</li>}
          {results.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <Avatar name={u.displayName || u.username} src={u.avatarUrl || undefined} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{u.displayName || u.username}</span>
              <button
                onClick={() => onAdd(u)}
                disabled={disabled}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Add ${u.username}`}
              >
                <UserPlus className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
