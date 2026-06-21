# ChatHub — Documentation

Technical docs for the ChatHub messaging app. Written to **explain how the system
works** and to double as **learning / interview-prep** material.

## Contents

- **[SOCKET-IO-AND-REALTIME.md](./SOCKET-IO-AND-REALTIME.md)** — the shared real-time
  backbone. WebSocket vs HTTP, Socket.IO core concepts (events, rooms, namespaces,
  acks, broadcasting), how ChatHub uses it, reliability & delivery semantics, **scaling
  (sticky sessions, Redis adapter)**, security, deployment (Vercel + Render free tier),
  and an interview Q&A. **Start here** for fundamentals.

- **[MESSAGING.md](./MESSAGING.md)** — how chat messaging works: the REST-as-truth +
  socket-as-notification model, data model, the send flow, optimistic UI, read
  receipts, typing, presence, pagination, search, frontend state, and an interview Q&A.

- **[CALLS.md](./CALLS.md)** — 1:1 voice/video calling over WebRTC: STUN vs TURN,
  feasibility on Vercel + Render free tier, how the offer/answer/ICE handshake works,
  the implementation, security, limitations, how to enable TURN later, WebRTC concept
  deep-dive, and an interview Q&A.

## Suggested reading order
1. **SOCKET-IO-AND-REALTIME** (the transport everything shares)
2. **MESSAGING** (the primary feature built on it)
3. **CALLS** (WebRTC, which reuses the same signaling backbone)

## The system in one paragraph
A Next.js frontend (Vercel) talks to an Express + Socket.IO API (Render) backed by
MongoDB Atlas. **REST persists** authoritative changes; **Socket.IO** pushes live
updates to the right users via per-user rooms. Messaging stores and broadcasts saved
objects; **calls** reuse the same authenticated socket purely to **relay** WebRTC
signaling, while audio/video flow **peer-to-peer** (with optional TURN relay).
