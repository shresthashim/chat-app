"use client";

import { useEffect, useState } from "react";
import { conversationsApi } from "@/lib/api/conversations";
import { useChatStore } from "@/store/chat";

/** Loads the current user's conversations into the store once on mount. */
export function useConversations() {
  const setConversations = useChatStore((s) => s.setConversations);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    conversationsApi
      .list()
      .then(({ conversations }) => active && setConversations(conversations))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [setConversations]);

  return { loading };
}
