"use client";

import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime } from "@/lib/utils";
import type { Participant } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readers: Participant[];
}

export function SeenByDialog({ open, onOpenChange, readers }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Seen by</DialogTitle>
        </DialogHeader>

        {readers.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">No one has seen this message yet.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {readers.map((participant) => (
              <li key={participant.user.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <Avatar
                  name={participant.user.displayName || participant.user.username}
                  src={participant.user.avatarUrl || undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {participant.user.displayName || participant.user.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">@{participant.user.username}</p>
                </div>
                {participant.lastReadAt && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatTime(participant.lastReadAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
