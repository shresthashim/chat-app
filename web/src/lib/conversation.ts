import type { Conversation, Message, UserRef } from "@/types";

/** The "other" participant in a direct chat, relative to the current user. */
export function getPeer(conversation: Conversation, currentUserId: string): UserRef | undefined {
  if (conversation.type !== "direct") return undefined;
  return conversation.participants.find((p) => p.user.id !== currentUserId)?.user;
}

export function getConversationTitle(conversation: Conversation, currentUserId: string): string {
  if (conversation.type === "group") return conversation.name || "Unnamed group";
  const peer = getPeer(conversation, currentUserId);
  return peer?.displayName || peer?.username || "Unknown";
}

export function getConversationAvatar(conversation: Conversation, currentUserId: string): string | undefined {
  if (conversation.type === "group") return conversation.avatarUrl || undefined;
  return getPeer(conversation, currentUserId)?.avatarUrl || undefined;
}

/** One-line preview of the latest message for the conversation list. */
export function getMessagePreview(message: Message | null | undefined): string {
  if (!message) return "No messages yet";
  if (message.deletedAt) return "Message deleted";
  if (message.text) return message.text;
  if (message.attachments.length) {
    const a = message.attachments[0]!;
    return a.type === "image" ? "📷 Photo" : `📎 ${a.name || "File"}`;
  }
  return "";
}

/** A short member summary for a group ("You, Maya, Sam +3"). */
export function getGroupMemberSummary(conversation: Conversation, currentUserId: string): string {
  const names = conversation.participants.map((p) =>
    p.user.id === currentUserId ? "You" : p.user.displayName || p.user.username,
  );
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}
