# ChatHub — 1:1 Calls (WebRTC)

Voice & video calling for **direct (1:1) conversations**, built on **WebRTC** with
**no third-party calling platform** (no Agora/Twilio/Daily). Signaling rides on the
app's existing Socket.IO connection; media flows **peer-to-peer** between the two
browsers.

> **Status:** Phase 1 shipped — P2P calling with STUN (free, no extra infra).
> TURN relay is wired but optional (see [Limitations](#limitations) and
> [Enabling TURN](#enabling-turn-phase-2)).

---

## 1. What a call actually needs

A WebRTC call has three independent concerns. Only one of them runs on our server:

| Piece | Job | Where it runs | Cost |
|-------|-----|---------------|------|
| **Signaling** | Exchange connection info (SDP offer/answer + ICE candidates) so two browsers can find each other | **Our API** (Socket.IO on Render) | Free (existing infra) |
| **STUN** | Tells a browser its public IP/port so peers can connect directly | **Free public** servers (Google) — we host nothing | Free |
| **TURN** | **Relays** the audio/video when a direct connection is impossible | **Not on Render** — needs a UDP-capable host (optional) | Only when enabled |

The server **never sees the media**. It only relays small text signals; the actual
audio/video goes browser ↔ browser.

---

## 2. STUN vs TURN (the key distinction)

- **STUN = "what's my public address?"** A one-time lookup during setup. The two
  browsers then connect **directly**. Carries no media. Free, tiny.
- **TURN = "relay everything through me."** Used only when a direct path can't be
  formed (restrictive NAT/firewall). It carries **100% of the call's media**, so it's
  bandwidth-heavy. A TURN server also does STUN.

**Why P2P works ~80% of the time:** after STUN reveals each peer's public address,
most home routers allow "hole-punching" (a direct connection). The **~15–20%** that
fail are **symmetric NAT, mobile carriers/CGNAT, and corporate/hotel firewalls** —
those need TURN.

---

## 3. Feasibility findings (deployment: Vercel + Render free)

Researched during design. Summary:

- **1:1 WebRTC is the simplest topology** — one peer connection, pure P2P, no media
  server (SFU/MCU) required. We already had the hard prerequisite: an authenticated
  Socket.IO channel.
- **Render free tier CANNOT host TURN.** Render only exposes HTTP/HTTPS — no UDP or
  raw TCP. coturn (the standard TURN server) needs UDP 3478/5349 + a UDP port range.
  → TURN must live on a separate UDP-capable host if/when we want it.
- **Render free tier spin-down** (15 min idle → ~50–60s cold start) would kill the
  *first* call after idle. **Mitigated** in this project with an **UptimeRobot** ping
  to `/api/health` every 5 minutes, which keeps the signaling server warm. (During an
  active call, Render also stays awake from the live WebSocket traffic.)
- **getUserMedia (mic/cam) requires HTTPS** — satisfied by Vercel (and `localhost`).

**Decision:** ship **Phase 1 = STUN-only P2P** (free, zero new infra, works on most
networks), built **TURN-ready** so enabling relay later is a config change, not a
rewrite.

---

## 4. How it works (the flow)

```
Caller                         Server (relay)                    Callee
  │  click 📞 / 🎥                                                  │
  │  getUserMedia (mic/cam)                                         │
  │  create offer ───────────► call:offer ───────────────────────► │  ring (incoming UI)
  │                            (verifies they share the chat)       │  click Accept
  │                                                                 │  getUserMedia
  │  ◄───────────────────────── call:answer ◄───────────────────── │  create answer
  │  ◄──────── call:ice ◄────── (both trickle ICE) ──► call:ice ──► │
  │  ════════════════ direct P2P media (audio/video) ════════════════
  │  hang up ─────────────────► call:end ─────────────────────────► │  call ends
```

- **Caller** captures media, creates an SDP **offer**, sends it via `call:offer`.
- **Server** verifies both users belong to the same direct conversation, checks the
  callee is online (else replies `call:unavailable`), and relays the offer.
- **Callee** sees the incoming-call UI. On **Accept**, captures media, sets the offer,
  creates an **answer**, sends it back.
- Both sides **trickle ICE candidates** (`call:ice`) until a path is found, then media
  flows **directly** between browsers.
- Either side can `call:cancel` (before answer), `call:decline`, or `call:end`.

---

## 5. Implementation

### Backend (`api/`)
- **Signaling handler** — [`src/socket/handlers/call.ts`](../api/src/socket/handlers/call.ts):
  relays `call:*` events to the **other member of the direct conversation only**,
  re-authorizing **every** message against conversation membership. Offers to an
  offline user return `call:unavailable`.
- **Events** — added to [`src/config/constants.ts`](../api/src/config/constants.ts)
  (`CALL_OFFER`, `CALL_ANSWER`, `CALL_ICE`, `CALL_DECLINE`, `CALL_CANCEL`, `CALL_END`,
  `CALL_BUSY`, `CALL_UNAVAILABLE`).
- **ICE endpoint** — [`src/modules/calls/`](../api/src/modules/calls/):
  `GET /api/calls/ice-servers` (auth required) returns STUN always, plus TURN with
  **short-lived HMAC credentials** when configured.
- **Registered** in [`src/socket/index.ts`](../api/src/socket/index.ts) and
  [`src/app.ts`](../api/src/app.ts).

### Frontend (`web/`)
- **Call manager** — [`src/lib/call/call-manager.ts`](../web/src/lib/call/call-manager.ts):
  framework-free engine owning the `RTCPeerConnection`, local/remote streams, ICE
  candidate queueing, timeouts, and the full lifecycle.
- **Call store** — [`src/store/call.ts`](../web/src/store/call.ts): Zustand state the UI renders.
- **Call provider** — [`src/components/providers/call-provider.tsx`](../web/src/components/providers/call-provider.tsx):
  bridges socket signals → manager, resolves the peer, mounts the overlay.
- **Call UI** — [`src/components/call/call-overlay.tsx`](../web/src/components/call/call-overlay.tsx):
  a centered **modal** (not a full-page takeover) with incoming / outgoing / connecting /
  active states (audio + video), mute, camera toggle, PiP self-view, duration timer —
  styled to the "Midnight Ink" theme.
- **Ringtones** — [`src/lib/call/ringtone.ts`](../web/src/lib/call/ringtone.ts): incoming
  plays a bundled file (`public/`), outgoing a synthesized ringback.
- **Entry points** — voice + video buttons in
  [`src/components/chat/chat-header.tsx`](../web/src/components/chat/chat-header.tsx)
  (direct chats only).

### Call states
`idle → outgoing → connecting → active → ended` (caller) ·
`idle → incoming → connecting → active → ended` (callee).

---

## 6. Security & robustness

- **Per-message authorization:** the server re-checks conversation membership on
  every signal, so you can only ring/relay to someone you share a direct chat with.
- **Stray-signal guards:** the client ignores signals for a non-matching `callId`, and
  terminal signals (`decline`/`busy`/`cancel`) only apply in the state where they make
  sense — a late signal from a second device can't tear down an active call.
- **Ephemeral TURN credentials:** TURN creds embed an expiry and are HMAC-signed
  (coturn `use-auth-secret`), so a leaked credential can't be reused to abuse relay
  bandwidth.
- **Resilient negotiation:** offer/answer creation is guarded so a teardown
  mid-negotiation can't crash with an unhandled error; ICE candidates that arrive
  before the remote description are queued and drained.
- **Busy handling:** an incoming call while already on one auto-replies `call:busy`.
- **Disconnect propagation:** ending a call relays `call:end` so the other side ends
  too; and if a participant's socket drops mid-call (tab closed/crashed), the server
  detects it and notifies the peer, so nobody is left stuck on a dead call.

---

## 7. Limitations

- **No TURN by default** → calls fail on the ~15–20% of restrictive networks
  (symmetric NAT, some mobile/corporate). Enable TURN to cover them (below).
- **1:1 only** — no group calls (would need an SFU; out of scope/infeasible on free tier).
- **Ringtone autoplay** — incoming plays a bundled ringtone file and outgoing a
  synthesized ringback, but browsers block audio until the user has interacted with the
  page. So if a call arrives before any click on a freshly loaded tab, the first ring
  may be silent — the visual call modal always shows regardless.
- **Multi-device** — if you're logged in on several tabs/devices, all ring; only the
  one that accepts connects (others stop on timeout). First-accept-wins isn't
  fully coordinated.
- **Free-tier cold start** — mitigated by UptimeRobot, but a missed ping or a Render
  restart can still delay the first call.
- **Mobile background tabs** throttle WebRTC; a backgrounded call may drop.

---

## 8. Configuration

ICE behaviour is driven by API env vars
([`api/src/config/env.ts`](../api/src/config/env.ts), see `.env.example`):

```bash
# Always-on, free, public discovery servers
STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# Optional relay (leave blank for STUN-only Phase 1)
TURN_URL=
TURN_SECRET=
TURN_TTL_SECONDS=3600
```

With `TURN_URL` + `TURN_SECRET` unset, `/api/calls/ice-servers` returns STUN only.

### Enabling TURN (Phase 2)
1. Run **coturn** on a UDP-capable host that is **not** Render — e.g. Oracle Cloud
   Always Free (free forever), Hetzner, Fly.io, or DigitalOcean. Configure it with
   `use-auth-secret` and a static secret; enable TURN-over-TLS on 443 for the
   strictest networks.
2. Set `TURN_URL=turn:your-host:3478` (and/or `turns:`) and `TURN_SECRET=<same secret>`
   on the API.
3. Redeploy. **No frontend changes** — the client already requests ICE servers from
   the endpoint and uses whatever it returns.

---

## 9. Quick test (local)

1. Run `api` and `web`. Open the app in **two different browsers/profiles**, logged in
   as two users who share a direct chat.
2. From one, click the **voice** (📞) or **video** (🎥) button in the chat header.
3. The other gets the incoming-call screen → **Accept**. You're connected.

> Same-machine/same-network calls connect via STUN. To exercise TURN you need two
> genuinely different restrictive networks (or force `iceTransportPolicy: "relay"`).

---

## 10. WebRTC concepts (deep-dive / interview prep)

**WebRTC** = browser APIs for real-time **peer-to-peer** audio/video/data. The browser
does the media; you provide **signaling** (any channel — we use Socket.IO).

### The vocabulary
- **`getUserMedia`** — asks the OS/browser for mic/camera; returns a `MediaStream`
  (a bundle of tracks). Requires a **secure context** (HTTPS/localhost).
- **`RTCPeerConnection` (PC)** — the engine that encodes, transports, and decodes media
  between two peers.
- **SDP (Session Description Protocol)** — a text blob describing media capabilities
  (codecs, resolutions, etc.). Exchanged as an **offer** (caller) and **answer**
  (callee). It is **not** media — just the "menu".
- **ICE (Interactive Connectivity Establishment)** — the framework that finds a working
  network path. It gathers **candidates** (possible addresses) and tests them.
- **ICE candidate** — one possible address/route. They "trickle" out asynchronously and
  are sent to the peer as they're found (faster than waiting for all of them).
- **STUN / TURN** — candidate sources: STUN discovers your public address (direct);
  TURN provides a relay address (indirect). See §2.
- **Signaling** — how peers exchange SDP + ICE **before** a connection exists. WebRTC
  deliberately leaves this to you; we relay it over Socket.IO.

### The handshake, precisely
```
caller: getUserMedia → new RTCPeerConnection → addTrack
        createOffer → setLocalDescription(offer) → send offer (signaling)
callee: setRemoteDescription(offer) → addTrack
        createAnswer → setLocalDescription(answer) → send answer (signaling)
both:   onicecandidate → send candidate;  on receive → addIceCandidate
        ontrack → render remote;  connectionState "connected" → live
```
- **Why queue ICE candidates?** A candidate can arrive before `setRemoteDescription`
  ran (especially on the callee, who only builds the PC after Accept). Adding one too
  early throws — so we **buffer** candidates and drain them after the remote description
  is set ([`call-manager.ts`](../web/src/lib/call/call-manager.ts)).
- **Offer/answer roles avoid "glare":** only the caller offers, only the callee answers
  — so there's no negotiation collision in this 1:1 design. (Mesh/multi-party needs
  *perfect negotiation*.)

### Why no media server for 1:1
Two peers can connect directly, so media is P2P — no **SFU** (selective forwarding) or
**MCU** (mixing) needed. Those are only required for **group** calls, where each extra
participant otherwise multiplies upload bandwidth. That's the main reason group calling
is out of scope on a free-tier budget.

---

## 11. Interview Q&A (calls)

**Q: What does WebRTC give you, and what do you have to provide?**
It provides the media stack (capture, codecs, transport, NAT traversal) and the P2P
connection. **You** provide signaling (exchanging SDP/ICE) and the UI. WebRTC is
signaling-agnostic on purpose.

**Q: STUN vs TURN — difference and when each is used?**
STUN just tells a peer its public address so peers connect **directly** (no media
through it). TURN **relays** all media when a direct path is impossible (symmetric NAT,
strict firewalls). STUN is free/cheap; TURN is bandwidth-heavy. ~80% of calls work with
STUN; ~15–20% need TURN.

**Q: What is signaling and why isn't it part of WebRTC?**
Signaling is the out-of-band exchange of SDP and ICE candidates before the peer
connection exists. WebRTC leaves it to you so you can use any channel (WebSocket, HTTP,
even copy-paste). We use the existing authenticated Socket.IO connection.

**Q: Offer/answer and SDP — what are they?**
SDP is a text description of media capabilities. The caller creates an **offer**, the
callee replies with an **answer**; each side sets the other's as its *remote
description*. This negotiates codecs and media directions.

**Q: What's ICE and trickle ICE?**
ICE finds a working path by gathering candidate addresses and probing them. *Trickle*
ICE sends candidates as they're discovered instead of batching, so connections form
faster.

**Q: Why can't you host TURN on Render free / why two hosts?**
TURN needs UDP (and a port range); Render only exposes HTTP/HTTPS. So TURN must run on a
UDP-capable host (e.g. Oracle Always Free, Hetzner, Fly.io), separate from the signaling
server.

**Q: Does call media flow through your server?**
No. The server only relays small signaling messages. Audio/video go **peer-to-peer**
(or via TURN if relayed) — never through the app server. This is why a tiny free
instance can support calls.

**Q: How would you scale to group calls?**
Move from mesh P2P to an **SFU** (each peer sends one upstream; the server forwards
streams). That's a real media server (CPU/bandwidth heavy) — not feasible on free tier,
hence 1:1 only here.

**Q: Security concerns with calling?**
Authorize signaling per conversation (not just the connection); use **ephemeral TURN
credentials** (HMAC + expiry) to prevent relay abuse; validate/limit signaling to
prevent ring-spam; note P2P exposes peers' IPs to each other (force-relay hides it at a
bandwidth cost).
