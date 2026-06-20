/** Names of the auth cookies set on the client. */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: "chathub_access",
  REFRESH_TOKEN: "chathub_refresh",
} as const;

/** Socket.IO event names, shared contract between client and server. */
export const SOCKET_EVENTS = {
  // connection lifecycle
  CONNECT: "connection",
  DISCONNECT: "disconnect",
  // presence
  PRESENCE_ONLINE: "presence:online",
  PRESENCE_OFFLINE: "presence:offline",
  PRESENCE_SNAPSHOT: "presence:snapshot",
  // messaging
  MESSAGE_NEW: "message:new",
  MESSAGE_SEND: "message:send",
  MESSAGE_EDITED: "message:edited",
  MESSAGE_DELETED: "message:deleted",
  MESSAGE_REACTION: "message:reaction",
  // typing
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  // read receipts
  RECEIPT_READ: "receipt:read",
  // conversations
  CONVERSATION_NEW: "conversation:new",
  CONVERSATION_UPDATED: "conversation:updated",
  CONVERSATION_REMOVED: "conversation:removed",
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 30,
  MAX_LIMIT: 100,
} as const;
