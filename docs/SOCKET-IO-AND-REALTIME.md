# Real-time with Socket.IO — Concepts, Practice & Interview Prep

The shared real-time backbone behind **both** [messaging](./MESSAGING.md) and
[calls](./CALLS.md). This doc goes from fundamentals → how ChatHub uses them →
advanced/scaling → deployment, with an **interview Q&A** at the end.

---

## 1. Why real-time needs more than plain HTTP

Classic HTTP is **request/response**: the client asks, the server answers, done. The
server **cannot push** to the client on its own. To get "live" updates you have a few
options:

| Technique | How it works | Trade-off |
|-----------|--------------|-----------|
| **Short polling** | Client requests every N seconds | Simple; wasteful, laggy |
| **Long polling** | Request held open until data, then re-issued | Near-real-time; many reconnects, heavy |
| **SSE (Server-Sent Events)** | One long-lived HTTP stream, **server→client only** | Great for one-way feeds; no client→server, text-only |
| **WebSocket** | One TCP connection, **full-duplex** (both directions), low overhead | Best for chat/calls/games; needs a stateful server |

**WebSocket** is the right tool for chat: a single persistent connection both sides can
send over at any time.

### WebSocket basics
- Starts as an HTTP request with `Upgrade: websocket`; the server replies `101
  Switching Protocols`, then the same TCP socket becomes a bidirectional message pipe.
- Messages are **frames** (text or binary), not HTTP requests — almost no per-message
  overhead.
- It's **stateful**: the connection lives on one server process. That single fact drives
  most scaling decisions (see §6).

---

## 2. What Socket.IO is (and isn't)

**Socket.IO is a library on top of WebSocket** (via the lower-level *Engine.IO*). It is
**not** the same as the raw WebSocket API. It adds the things you'd otherwise build:

- **Transport fallback** — uses WebSocket when possible, falls back to HTTP long-polling
  otherwise; can upgrade transparently.
- **Automatic reconnection** with backoff.
- **Named events** with structured payloads (JSON, plus binary).
- **Acknowledgements** (request/response over the socket).
- **Rooms & namespaces** for targeted broadcasting.
- **Heartbeats** (ping/pong) to detect dead connections.

> Because of this, a Socket.IO client must talk to a Socket.IO server — it isn't a
> drop-in raw WebSocket client.

---

## 3. Core concepts

### Connection lifecycle
```
client connects ──► server "connection" event ──► (work) ──► "disconnect" event
```
Server:
```js
io.on("connection", (socket) => {
  socket.on("some:event", (payload, ack) => { /* ... */ ack?.("ok"); });
  socket.on("disconnect", (reason) => { /* cleanup */ });
});
```

### Events
- `socket.emit("event", payload)` — send.
- `socket.on("event", handler)` — receive.
- Event names are arbitrary strings; **define them once and share** between client and
  server to avoid typos. ChatHub does this:
  [`api/.../constants.ts`](../api/src/config/constants.ts) ↔
  [`web/.../events.ts`](../web/src/lib/events.ts).

### Acknowledgements (request/response over a socket)
```js
// client
socket.emit("join", roomId, (res) => console.log(res.ok));
// server
socket.on("join", (roomId, ack) => ack({ ok: true }));
```
Useful when the sender needs confirmation. ChatHub mostly uses **REST for confirmed
writes** and sockets for fire-and-forget broadcasts.

### Namespaces vs Rooms (commonly confused)
- **Namespace** = a separate communication channel/endpoint (e.g. `/admin`, `/chat`),
  its own middleware and handlers. Chosen by the **client**. Think "different API".
- **Room** = an arbitrary, server-side **group of sockets** within a namespace. Clients
  can't join rooms directly — the **server** puts them in/out. Think "mailing list".

```js
socket.join("user:42");                 // server-side
io.to("user:42").emit("message:new", m); // emit to everyone in that room
```

### Broadcasting cheatsheet
| Call | Reaches |
|------|---------|
| `socket.emit(...)` | just this socket |
| `socket.broadcast.emit(...)` | everyone **except** this socket |
| `io.emit(...)` | everyone |
| `io.to(room).emit(...)` | everyone in `room` |
| `socket.to(room).emit(...)` | room, except this socket |

---

## 4. How ChatHub uses Socket.IO

- **One connection per user session.** The client lazily creates a single shared socket
  ([`web/.../socket.ts`](../web/src/lib/socket.ts)) with `withCredentials: true` so the
  auth cookie is sent.
- **Auth in the handshake.** Server middleware reads the **httpOnly access-token
  cookie** and resolves the user before allowing the connection
  ([`api/.../socket/index.ts`](../api/src/socket/index.ts)). Same identity as REST — no
  separate token.
  ```js
  io.use(async (socket, next) => {
    const user = await resolveUserFromToken(cookie);
    socket.data.user = user; next();   // or next(new Error("Unauthorized"))
  });
  ```
- **A personal room per user:** on connect each socket does `socket.join("user:<id>")`.
  To message a user on all their devices, emit to that room
  ([`io.ts → emitToUsers`](../api/src/socket/io.ts)). This is the core delivery
  primitive for messages, receipts, conversation updates, and call signals.
- **Services broadcast without touching HTTP.** The `io` instance is stashed in a module
  (`io.ts`) so domain services invoked from REST controllers can push events.
- **Presence** is tracked in-memory (`userId → set of socket ids`) so a user is "online"
  while ≥1 tab is connected ([`presence.ts`](../api/src/socket/presence.ts)).
- **Typing** and **call signaling** are relayed (not stored) to the other
  participants of a conversation, re-authorizing membership on every event
  ([`handlers/typing.ts`](../api/src/socket/handlers/typing.ts),
  [`handlers/call.ts`](../api/src/socket/handlers/call.ts)).

### The dominant pattern: persist over REST, notify over socket
For anything that must survive a refresh (messages, edits, reactions), ChatHub
**writes via REST → MongoDB**, then the controller **broadcasts the saved object** over
Socket.IO to participants. Sockets are the *fast layer*, the DB is the *truth*. (Typing
and call ICE/SDP are the exceptions — purely ephemeral, never stored.)

---

## 5. Reliability & delivery semantics

- **Reconnection.** Socket.IO auto-reconnects with backoff. On reconnect you must
  **re-sync** any state you may have missed. In ChatHub the server re-pushes a
  `presence:snapshot` on every (re)connect, and a conversation's history is (re)loaded
  when that chat is opened. *(A fuller version would also refetch the active
  conversation immediately on reconnect.)*
- **Delivery is at-most-once by default.** A socket emit is fire-and-forget; if the
  client is briefly disconnected, that emit can be lost. That's *why* the source of
  truth is the DB and the client refetches on reconnect — the socket is an optimization,
  not a guarantee.
- **Connection State Recovery** (Socket.IO feature) can replay missed events for a short
  window after a drop, but it's not a substitute for a re-sync on important data.
- **Volatile events** (`socket.volatile.emit`) may be dropped if the client isn't ready
  — appropriate for high-frequency, disposable data (e.g. typing, cursor positions).
- **Heartbeats** (ping/pong) detect half-open connections; tune `pingInterval` /
  `pingTimeout` for your network.
- **Backpressure.** A slow client can build a send buffer; for very high-rate data,
  throttle/coalesce on the server and prefer volatile emits.

---

## 6. Scaling & advanced topics (the interview meat)

### The core problem: WebSockets are sticky and stateful
A connection lives on **one** server process. With multiple instances behind a load
balancer:

1. **Sticky sessions** are required so a client's HTTP-polling handshake and subsequent
   requests hit the **same** instance. (Pure WebSocket is one connection so it's less of
   an issue, but Socket.IO's polling fallback needs stickiness.)
2. **Cross-instance broadcasting** breaks: if user A is on instance 1 and user B on
   instance 2, `io.to("user:B")` on instance 1 won't reach B — B's socket isn't there.

### The Adapter pattern (how Socket.IO solves #2)
Socket.IO uses an **adapter** to route room emits. The default in-memory adapter only
knows the local process. The **Redis adapter** (or other backends) publishes emits over
a Redis Pub/Sub channel so **every instance** delivers to its local members of a room.
```
instance1.io.to("user:B").emit(...) ──► Redis pub/sub ──► instance2 delivers to B
```
- This makes rooms work cluster-wide with no app changes.
- **In-memory presence also breaks at scale** for the same reason — ChatHub's presence
  map is per-process; multi-instance would move it to **Redis** (a shared registry).
  *(The code notes this explicitly.)*

### Horizontal scaling checklist
- [ ] Sticky load balancing (or WebSocket-only transport to reduce reliance on it).
- [ ] Redis (or equivalent) adapter for cross-node broadcasting.
- [ ] Shared presence/session store (Redis), not per-process maps.
- [ ] Stateless auth (JWT/cookie) so any node can validate the handshake.
- [ ] Graceful shutdown: drain connections, let clients reconnect elsewhere.

### Vertical vs horizontal
A single Node process handles **thousands** of idle sockets fine (they're cheap when
idle). You scale **out** when CPU (message fan-out, JSON serialization) or memory
(buffers) saturate — or for redundancy. Fan-out cost grows with room size, so very large
rooms/broadcasts are the usual bottleneck.

---

## 7. Security

- **Authenticate the handshake** (cookie/JWT) in `io.use(...)`; reject otherwise.
- **CORS / allowed origins** — Socket.IO has its own CORS config; restrict to your
  frontend origins with `credentials: true` (ChatHub passes `CLIENT_ORIGINS`).
- **Authorize every sensitive event**, not just the connection. ChatHub re-checks
  conversation membership on each typing/call signal — a valid connection ≠ permission
  to message arbitrary rooms.
- **Validate payloads** (size + shape); never trust client input. Cap message/SDP sizes.
- **Rate-limit** event floods (call spam, typing storms). HTTP rate limiters don't cover
  socket events — add per-socket throttling for hardening.
- **Don't leak rooms:** never let a client `join` arbitrary rooms by name; the server
  decides room membership.

---

## 8. Deployment (Vercel + Render, free tier)

**Topology:** Next.js frontend on **Vercel**; Express + Socket.IO API on **Render**;
MongoDB Atlas. Frontend and API are **different sites** (cross-origin), which affects
cookies and CORS.

- **WebSockets on the host.** The API host must support long-lived WebSocket
  connections. **Render does** (natively). Serverless/edge platforms (e.g. Vercel
  Functions) are a **poor fit for a Socket.IO server** because they're short-lived and
  don't hold persistent connections — hence Socket.IO lives on Render, not Vercel.
- **Cross-site cookies.** The socket handshake sends the auth cookie only if the cookie
  is `SameSite=None; Secure` in production and the client uses `withCredentials`. (Same
  requirement as REST — see the cookies note in the app.)
- **CORS** on the Socket.IO server must echo the exact Vercel origin with
  `credentials: true`.
- **Free-tier spin-down.** Render free services sleep after ~15 min idle (≈50–60s cold
  start). For a realtime app that means the first connection after idle is slow. ChatHub
  mitigates with an **UptimeRobot** ping to `/api/health` every 5 min to stay warm;
  during active use the WebSocket traffic itself keeps it awake. Production-grade →
  paid instance.
- **Transports.** The client allows `["websocket", "polling"]`; WebSocket is preferred,
  polling is the fallback. If you ever run **multiple** free/paid instances, you need
  sticky sessions + the Redis adapter (see §6) — a single instance (current setup)
  doesn't.
- **Proxies & timeouts.** Behind a proxy (Render), set `app.set("trust proxy", 1)` so
  secure cookies and IPs work; ensure idle timeouts exceed the heartbeat interval.

---

## 9. Interview Q&A

**Q: WebSocket vs HTTP — when would you use each?**
HTTP for request/response/CRUD. WebSocket for low-latency, bidirectional, server-push
workloads (chat, calls, live dashboards, games). Often **both**: REST for the
authoritative writes, WebSocket for live notifications — exactly ChatHub's model.

**Q: WebSocket vs Socket.IO?**
WebSocket is the browser protocol/API. Socket.IO is a library that uses WebSocket (with
polling fallback) and adds reconnection, rooms, namespaces, acks, heartbeats, and
binary/JSON event semantics. A Socket.IO client can't talk to a raw WS server and vice
versa.

**Q: Namespace vs Room?**
Namespace = separate endpoint/channel chosen by the client, with its own handlers/
middleware. Room = a server-managed group of sockets within a namespace for targeted
broadcast. Clients join rooms only via the server.

**Q: How do you target one user across multiple devices/tabs?**
Put every socket in a per-user room (`user:<id>`) on connect and emit to that room.
(ChatHub's `emitToUsers`.)

**Q: How do you authenticate a Socket.IO connection?**
In `io.use()` middleware during the handshake — validate the cookie/JWT, attach the user
to `socket.data`, call `next()` or reject. Then authorize individual events too.

**Q: How does Socket.IO scale across multiple servers?**
Sticky sessions at the load balancer + an **adapter** (commonly **Redis pub/sub**) so a
room emit on one node reaches that room's members on every node. Shared state
(presence/sessions) moves to Redis too.

**Q: Why does in-memory presence break when you add a second instance?**
Each process only knows its own connections. User A on node 1 and user B on node 2 are
invisible to each other's presence maps and room emits — you need a shared store +
adapter.

**Q: Are socket messages guaranteed to be delivered?**
No — emits are at-most-once and can be lost across a disconnect. Use acks for
confirmation, keep the source of truth in a DB, and **re-sync on reconnect**. Use
volatile emits for disposable high-frequency data.

**Q: Why run Socket.IO on Render and not Vercel?**
Socket.IO needs a long-lived, stateful server process. Vercel's serverless/edge
functions are short-lived and don't maintain persistent connections; Render runs a
persistent Node server that holds WebSockets.

**Q: How do you keep a free Render service from sleeping, and what's the catch?**
Ping a lightweight endpoint (`/api/health`) every <15 min (e.g. UptimeRobot). Catch: it
consumes the monthly free hours and isn't truly production-grade; a missed ping or
platform restart still causes a cold start.

**Q: What's the difference between persisting via REST and broadcasting via socket?**
REST writes are authoritative, validated, and confirmed (you get the saved object).
The socket broadcast just *notifies* other clients quickly; if it's missed, the DB still
has the data and clients reconcile on next load.

---

## 10. Glossary

- **Engine.IO** — the low-level transport layer under Socket.IO (handshake, upgrade,
  heartbeats).
- **Transport** — how bytes move: `websocket` or HTTP `polling`.
- **Adapter** — pluggable room/broadcast router (in-memory default, Redis for scale).
- **Sticky session** — load-balancer affinity keeping a client on one instance.
- **Heartbeat (ping/pong)** — periodic liveness check.
- **Backpressure** — buildup when a producer outpaces a slow consumer.
- **STUN/TURN/ICE/SDP** — WebRTC terms; see [CALLS.md](./CALLS.md).
