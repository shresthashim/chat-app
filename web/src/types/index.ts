export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  statusText: string;
  lastSeenAt: string;
  online?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A lightweight user as embedded in messages/participants (subset of User). */
export type UserRef = Pick<User, "id" | "username" | "displayName" | "avatarUrl"> &
  Partial<Pick<User, "statusText" | "lastSeenAt" | "online">>;

export interface Attachment {
  url: string;
  type: "image" | "file";
  name: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface Reaction {
  user: string;
  emoji: string;
}

export interface ReadReceipt {
  user: string;
  readAt: string;
}

export type MessageType = "text" | "image" | "file" | "system";

export interface Message {
  id: string;
  conversation: string;
  sender: UserRef;
  type: MessageType;
  text: string;
  attachments: Attachment[];
  replyTo?: Message | null;
  reactions: Reaction[];
  readBy: ReadReceipt[];
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ParticipantRole = "member" | "admin";

export interface Participant {
  user: UserRef;
  role: ParticipantRole;
  joinedAt: string;
  lastReadAt?: string | null;
  lastReadMessage?: string | null;
  muted?: boolean;
}

export type ConversationType = "direct" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  description: string;
  avatarUrl: string;
  createdBy?: string;
  participants: Participant[];
  lastMessage?: Message | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Standard API envelope from the backend. */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  details?: Record<string, string[]>;
}
