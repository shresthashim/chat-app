"use client";

import { useParams } from "next/navigation";
import { ConversationView } from "@/components/chat/conversation-view";

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  return <ConversationView conversationId={params.conversationId} />;
}
