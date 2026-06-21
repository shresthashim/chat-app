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
  // 1:1 calls (WebRTC signaling — server only relays, media is peer-to-peer)
  CALL_OFFER: "call:offer", // caller → callee: SDP offer + media kind
  CALL_ANSWER: "call:answer", // callee → caller: SDP answer
  CALL_ICE: "call:ice", // both ways: a trickled ICE candidate
  CALL_DECLINE: "call:decline", // callee → caller: rejected
  CALL_CANCEL: "call:cancel", // caller → callee: hung up before answer
  CALL_END: "call:end", // either → other: ended an established call
  CALL_BUSY: "call:busy", // callee → caller: already on another call
  CALL_UNAVAILABLE: "call:unavailable", // server → caller: callee is offline
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 30,
  MAX_LIMIT: 100,
} as const;

/** Upload constraints, shared by the multer middleware and the upload service. */
export const UPLOAD = {
  MAX_FILE_BYTES: 1 * 1024 * 1024, // 1 MB
  MAX_FILE_LABEL: "1 MB",
  ALLOWED_MIME_TYPES: [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    // Documents
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Archives
    "application/zip",
  ],
} as const;
