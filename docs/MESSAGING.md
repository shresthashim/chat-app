# ChatHub — How Messaging Works

A reference for understanding the real-time messaging system: the data model, how a
message travels from sender to recipient, and the features layered on top.

---

## 1. The two channels

Messaging uses **two complementary transports**:

| Channel | Used for | Tech |
|---------|----------|------|
| **REST (HTTP)** | The **source of truth** — create/read/edit/delete/react, paginated history | Express controllers → services → MongoDB |
| **Socket.IO (WebSocket)** | **Live delivery & presence** — push new messages/edits/receipts/typing to other participants instantly | Socket.IO, authenticated by the same cookie as REST |

**Rule of thumb:** REST **persists** the change and returns the canonical object; the
server then **broadcasts** that object over Socket.IO to the other participants. The
database is authoritative; sockets are the fast notification layer.

---

## 2. Data model (`api/src/models/`)

- **User** — account, profile (`displayName`, `avatarUrl`, `bio`, `statusText`),
  `lastSeenAt`, and `tokenVersion` (for session invalidation).
- **Conversation** — `type: "direct" | "group"`, `participants[]` (each with `role`,
  `lastReadAt`, `lastReadMessage`), plus denormalized `lastMessage`/`lastMessageAt`
  for the sidebar.
- **Message** — `conversation`, `sender`, `type`, `text`, `attachments[]`,
  `replyTo`, `reactions[]`, `readBy[]`, `editedAt`, `deletedAt` (soft delete),
  timestamps.

---

## 3. Sending a message (the flow)

```
Sender UI                       Server                         Other participant(s)
  │ type + Enter                                                       │
  │ ① optimistic echo (temp msg shows instantly)                       │
  │ ② POST /api/conversations/:id/messages ─────►                      │
  │                          validate + authorize membership           │
  │                          create Message in MongoDB                 │
  │                          update conversation.lastMessage           │
  │ ◄──────── 201 { message } (real, with id) ──┤                      │
  │ ③ store reconciles: real msg replaces temp  │                      │
  │                          emitToUsers(participants, "message:new") ─► ④ store.addMessage
  │                                                                     │   (renders live)
```

1. **Optimistic echo** — the composer immediately inserts a temporary message
   (`temp-…` id) so the sender sees zero latency.
2. **REST write** — `POST` validates the body (Zod), checks the sender belongs to the
   conversation, creates the `Message`, and updates the conversation's `lastMessage`.
3. **Reconciliation** — the response carries the real message (with a real id). The
   store replaces the matching `temp-…` echo (dedupes by sender + text). On failure,
   the temp message is removed and a toast is shown.
4. **Broadcast** — the controller calls `emitToUsers(participantIds, "message:new",
   message)`. Every participant (including the sender's other devices) receives it;
   the store ignores duplicates by id.

> Media messages follow the same path but first `POST /api/uploads` (Cloudinary),
> then send the message with the returned attachment. The optimistic echo (step ①)
> applies to **text** sends; file sends skip it and show a "sending" state until the
> upload + send complete.

---

## 4. Real-time events (`SOCKET_EVENTS`)

Defined once in [`api/src/config/constants.ts`](../api/src/config/constants.ts) and
mirrored in [`web/src/lib/events.ts`](../web/src/lib/events.ts):

- **Messages:** `message:new`, `message:edited`, `message:deleted`, `message:reaction`
- **Typing:** `typing:start`, `typing:stop`
- **Receipts:** `receipt:read`
- **Presence:** `presence:online`, `presence:offline`, `presence:snapshot`
- **Conversations:** `conversation:new`, `conversation:updated`, `conversation:removed`

Edits, deletes, and reactions reuse the same write→broadcast pattern: the service
returns `{ message, participantIds }`, the controller emits the corresponding event,
and the client's store updates the message in place (see
[`messages.controller.ts`](../api/src/modules/messages/messages.controller.ts)).

---

## 5. Authentication & connection

- The Socket.IO **handshake is authenticated with the same httpOnly access-token
  cookie** as REST ([`socket/index.ts`](../api/src/socket/index.ts)), so there are no
  separate tokens.
- On connect, each socket **joins a personal room** `user:<id>`. Broadcasting to a
  user means emitting to that room across all their devices/tabs
  ([`socket/io.ts`](../api/src/socket/io.ts) → `emitToUsers`).
- Services broadcast without importing the HTTP layer by going through the shared
  `io` instance in `io.ts`.

---

## 6. Presence & typing

- **Presence** is an in-memory map of `userId → set of socket ids`
  ([`socket/presence.ts`](../api/src/socket/presence.ts)). First connection →
  `presence:online`; last disconnect → `presence:offline` + persists `lastSeenAt`. New
  sockets get a `presence:snapshot` of who's currently online.
  *(Single-instance; would move to Redis for multi-instance.)*
- **Typing** is ephemeral: the client emits `typing:start/stop`; the server relays to
  the other participants ([`socket/handlers/typing.ts`](../api/src/socket/handlers/typing.ts)).
  The client also auto-clears a stale indicator after a few seconds in case a `stop`
  is missed.

---

## 7. Read receipts

- When a conversation is open and the newest message changes, the client calls
  `markRead` → `receipt:read` is broadcast and the participant's `lastReadAt` /
  `lastReadMessage` is updated.
- The message list renders ✓ / ✓✓ (and "seen by" for groups) by comparing each
  message's time against participants' read cutoffs.

---

## 8. Loading history (pagination)

- `GET /api/conversations/:id/messages?limit=&cursor=` returns a page **newest-first**
  with a `nextCursor` ([`messages.service.ts`](../api/src/modules/messages/messages.service.ts)).
- The frontend hook [`use-messages.ts`](../web/src/hooks/use-messages.ts) loads the
  first page, and `loadMore()` prepends older pages as the user scrolls up. The list
  preserves scroll position on prepend and pins to the bottom for new messages.

---

## 9. Frontend state

- **Store** — [`web/src/store/chat.ts`](../web/src/store/chat.ts) (Zustand) holds
  conversations, messages per conversation, cursors, typing, presence, unread counts,
  and the active conversation. It owns optimistic insertion, dedupe/reconcile, and
  sorting.
- **Socket provider** — [`socket-provider.tsx`](../web/src/components/providers/socket-provider.tsx)
  connects the socket and registers all the listeners that drive the store; it also
  fires desktop notifications / sounds for messages received while you're away.
- **Composer** — [`message-composer.tsx`](../web/src/components/chat/message-composer.tsx)
  handles text, optimistic send, attachments (preview-before-send), replies, and edits.

---

## 10. Feature map

| Feature | How |
|---------|-----|
| Real-time 1:1 + group chat | REST write → `message:new` broadcast |
| Optimistic send | Temp message in store, reconciled by the REST response |
| Edit / soft-delete | `PATCH`/`DELETE` → `message:edited`/`message:deleted`; `deletedAt` keeps the row |
| Reactions | `POST …/reactions` toggles, broadcasts `message:reaction` |
| Replies | `replyTo` stored on the message and rendered as a quoted preview |
| Attachments | `POST /api/uploads` (Cloudinary) then send with the attachment |
| Typing indicator | `typing:start/stop` relay (ephemeral) |
| Presence / last seen | In-memory registry + `presence:*` events |
| Read receipts | `markRead` → `receipt:read`, ✓/✓✓ rendering |
| Search | `GET /api/messages/search?q=` (Mongo text index over the user's conversations) |
| Notifications | Browser notification + ping when a message arrives unfocused |

---

## 11. Relationship to calls

Calling reuses this exact realtime backbone: the **same authenticated Socket.IO
connection** and the **`user:<id>` room** delivery, with `call:*` events relayed only
between members of a direct conversation. The difference is that messages persist in
MongoDB and broadcast the saved object, whereas call signals are **relayed, not
stored** — and call media never touches the server. See
[CALLS.md](./CALLS.md).

---

## 12. Interview Q&A (messaging)

**Q: Why use both REST and WebSockets instead of just one?**
REST gives validated, authoritative, confirmed writes (you get the saved object back and
it survives refresh). WebSockets give instant push to *other* clients. Using both means
the DB is the source of truth and sockets are a fast notification layer — if a socket
event is missed, the data is still in the DB and the client reconciles on next load.

**Q: What is optimistic UI and how do you reconcile it?**
The sender inserts a temporary message immediately (`temp-…` id) for zero-latency feel.
When the REST response returns the real message (real id), the store replaces the temp
(matched by sender+text). On failure it removes the temp and shows an error. The socket
broadcast of the same message is de-duplicated by id.

**Q: How do you avoid duplicate messages (optimistic echo + socket broadcast)?**
The store dedupes by message id and by replacing a matching `temp-` echo, so the sender
seeing both their optimistic copy and the broadcast results in one message.

**Q: How is delivery to multiple devices handled?**
Each socket joins a `user:<id>` room; broadcasting to that room reaches all of a user's
tabs/devices. The sender's *other* devices also receive the broadcast.

**Q: How do read receipts work?**
When the newest message in an open conversation changes, the client calls a `markRead`
endpoint; the server updates the participant's `lastReadAt`/`lastReadMessage` and
broadcasts `receipt:read`. The UI computes ✓/✓✓ by comparing message timestamps to read
cutoffs.

**Q: How is message history paginated?**
Cursor-based, newest-first, with a `nextCursor`. Scrolling up calls `loadMore()` which
prepends older pages while preserving scroll position. (Cursor pagination is stable
under inserts, unlike offset pagination.)

**Q: How do you handle a socket reconnect (missed messages)?**
Re-sync: refetch the conversation's recent messages and re-apply the presence snapshot.
Sockets are best-effort, so the client treats the DB as truth after any gap.

**Q: How is "typing…" implemented and why isn't it stored?**
The client emits `typing:start/stop`; the server relays to other participants. It's
transient UI state with no value after the moment, so it's never persisted; the client
also auto-expires a stale indicator if a `stop` is missed.

**Q: How is delete implemented?**
**Soft delete** — set `deletedAt` and broadcast `message:deleted`; the row stays so
replies/threading and ordering remain intact, and the UI renders "message deleted".

**Q: Where would this break at scale, and how would you fix it?**
In-memory presence and single-process broadcasting break with multiple instances. Fix
with a Redis Socket.IO adapter (cross-node broadcast) and a shared presence store, plus
sticky sessions. See [SOCKET-IO-AND-REALTIME.md](./SOCKET-IO-AND-REALTIME.md) §6.
