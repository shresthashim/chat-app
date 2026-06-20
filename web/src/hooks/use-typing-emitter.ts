"use client";

import { useCallback, useEffect, useRef } from "react";
import { emitTyping } from "@/components/providers/socket-provider";

/** Emits typing start/stop with auto-timeout so peers see a live indicator. */
export function useTypingEmitter(conversationId: string) {
  const typing = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stop = useCallback(() => {
    clearTimeout(timeout.current);
    if (typing.current) {
      typing.current = false;
      emitTyping(conversationId, false);
    }
  }, [conversationId]);

  const start = useCallback(() => {
    if (!typing.current) {
      typing.current = true;
      emitTyping(conversationId, true);
    }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(stop, 2500);
  }, [conversationId, stop]);

  // Stop emitting if the user navigates away mid-type.
  useEffect(() => stop, [stop]);

  return { start, stop };
}
