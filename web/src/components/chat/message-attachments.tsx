"use client";

import { FileText, Download } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import type { Attachment } from "@/types";

export function MessageAttachments({ attachments, own }: { attachments: Attachment[]; own: boolean }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {attachments.map((a, i) =>
        a.type === "image" ? (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.name || "Image"}
              className="max-h-72 w-full max-w-xs rounded-xl object-cover transition-transform hover:scale-[1.01]"
            />
          </a>
        ) : (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
              own ? "border-white/20 hover:bg-white/10" : "border-border hover:bg-surface-3",
            )}
          >
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", own ? "bg-white/15" : "bg-surface-3")}>
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.name || "File"}</span>
              <span className={cn("text-xs", own ? "text-white/70" : "text-muted-foreground")}>
                {formatFileSize(a.size)}
              </span>
            </span>
            <Download className="h-4 w-4 shrink-0 opacity-70" />
          </a>
        ),
      )}
    </div>
  );
}
