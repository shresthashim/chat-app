/** Socket.IO event names — must stay in sync with the API's SOCKET_EVENTS. */
export const SOCKET_EVENTS = {
  PRESENCE_ONLINE: "presence:online",
  PRESENCE_OFFLINE: "presence:offline",
  PRESENCE_SNAPSHOT: "presence:snapshot",
  MESSAGE_NEW: "message:new",
  MESSAGE_EDITED: "message:edited",
  MESSAGE_DELETED: "message:deleted",
  MESSAGE_REACTION: "message:reaction",
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  RECEIPT_READ: "receipt:read",
  CONVERSATION_NEW: "conversation:new",
  CONVERSATION_UPDATED: "conversation:updated",
  CONVERSATION_REMOVED: "conversation:removed",
} as const;
