"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Smile, X, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useTypingEmitter } from "@/hooks/use-typing-emitter";
import { messagesApi } from "@/lib/api/messages";
import { useChatStore } from "@/store/chat";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/store/toast";
import { cn, formatFileSize } from "@/lib/utils";
import type { Message } from "@/types";

const EMOJIS = "😀 😂 🥹 😊 😍 😘 🤔 🙌 👍 👎 🙏 🔥 🎉 💯 ❤️ 💔 😎 😭 😅 😴 🤝 👀 ✅ ⭐ ☕ 🚀".split(" ");
const MAX_UPLOAD_BYTES = 1 * 1024 * 1024;

interface Props {
  conversationId: string;
  replyTo: Message | null;
  editing: Message | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

export function MessageComposer({ conversationId, replyTo, editing, onCancelReply, onCancelEdit }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  // A file the user has picked but not yet sent (preview before sending).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { start, stop } = useTypingEmitter(conversationId);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);

  // Enter edit mode: prefill and focus.
  useEffect(() => {
    if (editing) {
      setText(editing.text);
      textarea.current?.focus();
    }
  }, [editing]);

  // Auto-grow the textarea.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // Release the image preview's object URL when it changes or on unmount.
  useEffect(() => {
    if (!pendingPreview) return;
    return () => URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  const reset = () => {
    setText("");
    stop();
    if (textarea.current) textarea.current.style.height = "auto";
  };

  const submitEdit = async () => {
    if (!editing || !text.trim()) return;
    try {
      const { message } = await messagesApi.edit(conversationId, editing.id, text.trim());
      updateMessage(message);
      onCancelEdit();
      reset();
    } catch {
      toast({ variant: "error", title: "Couldn't edit message" });
    }
  };

  const clearPending = () => {
    setPendingFile(null);
    setPendingPreview(null);
  };

  // Stage a picked file for preview instead of sending it immediately.
  const onSelectFile = (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ variant: "error", title: "File is too large", description: "Uploads must be 1 MB or smaller." });
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setPendingFile(file);
    setPendingPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    if (fileInput.current) fileInput.current.value = "";
    textarea.current?.focus();
  };

  const submitSend = async () => {
    const body = text.trim();
    const file = pendingFile;
    if ((!body && !file) || !user) return;

    // With an attachment: upload first, then send the message (optional caption).
    if (file) {
      setSending(true);
      setUploading(true);
      const reply = replyTo?.id;
      reset();
      clearPending();
      onCancelReply();
      try {
        const { attachment } = await messagesApi.upload(file);
        const { message } = await messagesApi.send(conversationId, {
          text: body || undefined,
          attachments: [attachment],
          replyTo: reply,
        });
        addMessage(message, user.id);
      } catch (err) {
        const msg =
          err instanceof ApiError && err.status === 501
            ? "File sharing isn't configured on this server."
            : "Check your connection and try again.";
        toast({ variant: "error", title: "Couldn't send file", description: msg });
      } finally {
        setSending(false);
        setUploading(false);
      }
      return;
    }

    setSending(true);
    const tempId = `temp-${crypto.randomUUID()}`;
    // Optimistic echo for instant feedback.
    addMessage({
      id: tempId,
      conversation: conversationId,
      sender: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
      type: "text",
      text: body,
      attachments: [],
      replyTo: replyTo ?? null,
      reactions: [],
      readBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, user.id);
    reset();
    onCancelReply();
    try {
      const { message } = await messagesApi.send(conversationId, { text: body, replyTo: replyTo?.id });
      addMessage(message, user.id);
    } catch {
      removeMessage(conversationId, tempId);
      toast({ variant: "error", title: "Message not sent", description: "Check your connection and try again." });
    } finally {
      setSending(false);
    }
  };

  const onSubmit = () => (editing ? submitEdit() : submitSend());

  return (
    <div className="border-t border-border bg-surface px-3 py-3 sm:px-4">
      {/* Reply / edit context bar */}
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-primary bg-surface-2 px-3 py-2">
          {editing ? <Pencil className="h-4 w-4 text-primary" /> : <span className="h-4 w-1 rounded bg-primary" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-primary">
              {editing ? "Editing message" : `Replying to ${replyTo?.sender.displayName || replyTo?.sender.username}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">{(editing ?? replyTo)?.text || "Attachment"}</p>
          </div>
          <button
            onClick={() => (editing ? (onCancelEdit(), reset()) : onCancelReply())}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Staged attachment preview (shown before sending) */}
      {pendingFile && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
          {pendingPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pendingPreview} alt={pendingFile.name} className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{pendingFile.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(pendingFile.size)}</p>
          </div>
          <button
            onClick={clearPending}
            disabled={uploading}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Insert emoji">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setText((t) => t + emoji)}
                  className="cursor-pointer rounded-lg p-1.5 text-lg transition-transform hover:scale-125 hover:bg-surface-2"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {!editing && (
          <Button variant="ghost" size="icon" aria-label="Attach file" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? <Spinner /> : <Paperclip className="h-5 w-5" />}
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
        />

        <textarea
          ref={textarea}
          value={text}
          rows={1}
          placeholder={pendingFile ? "Add a caption…" : "Write a message…"}
          onChange={(e) => {
            setText(e.target.value);
            if (!editing) start();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape" && editing) {
              onCancelEdit();
              reset();
            }
          }}
          className={cn(
            "scrollbar-none flex-1 resize-none rounded-2xl border border-input bg-surface-2 px-4 py-2.5 text-sm leading-relaxed",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />

        <Button
          variant="gradient"
          size="icon"
          aria-label={editing ? "Save edit" : "Send message"}
          disabled={(!text.trim() && !pendingFile) || sending}
          onClick={onSubmit}
        >
          {sending ? <Spinner className="text-white" /> : <Send className="h-[1.15rem] w-[1.15rem]" />}
        </Button>
      </div>
    </div>
  );
}
