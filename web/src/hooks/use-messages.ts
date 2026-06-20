"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { messagesApi } from "@/lib/api/messages";
import { conversationsApi } from "@/lib/api/conversations";
import { useChatStore } from "@/store/chat";

/** Loads and paginates a conversation's messages, and keeps read state current. */
export function useMessages(conversationId: string, enabled = true) {
  const messages = useChatStore((s) => s.messages[conversationId]);
  const cursor = useChatStore((s) => s.cursors[conversationId]);
  const setMessages = useChatStore((s) => s.setMessages);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const clearUnread = useChatStore((s) => s.clearUnread);
  const applyReadReceipt = useChatStore((s) => s.applyReadReceipt);

  const [loading, setLoading] = useState(!messages);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastReadId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    messagesApi
      .list(conversationId)
      .then((page) => active && setMessages(conversationId, page.messages, page.nextCursor))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [conversationId, enabled, setMessages]);

  // Mark read whenever a newer last message appears.
  const lastMessageId = messages?.[messages.length - 1]?.id;
  useEffect(() => {
    if (!enabled || !lastMessageId || lastMessageId.startsWith("temp-")) return;

    const markLatestRead = () => {
      if (document.visibilityState !== "visible") return;
      if (lastReadId.current === lastMessageId) return;
      lastReadId.current = lastMessageId;
      clearUnread(conversationId);
      conversationsApi
        .markRead(conversationId, lastMessageId)
        .then(applyReadReceipt)
        .catch(() => {
          lastReadId.current = null;
        });
    };

    markLatestRead();
    document.addEventListener("visibilitychange", markLatestRead);
    window.addEventListener("focus", markLatestRead);
    return () => {
      document.removeEventListener("visibilitychange", markLatestRead);
      window.removeEventListener("focus", markLatestRead);
    };
  }, [conversationId, enabled, lastMessageId, clearUnread, applyReadReceipt]);

  const loadMore = useCallback(async () => {
    if (!enabled) return;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await messagesApi.list(conversationId, cursor);
      prependMessages(conversationId, page.messages, page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, cursor, enabled, loadingMore, prependMessages]);

  return { messages: messages ?? [], loading: enabled ? loading : false, loadingMore, hasMore: Boolean(cursor), loadMore };
}
