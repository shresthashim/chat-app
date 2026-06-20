# ChatHub

A modern, real-time messaging app — rebuilt from the ground up. Direct & group chats, presence, typing indicators, read receipts, reactions, replies, file/image sharing, message edit/delete, search, notifications, profiles, settings, and a polished light/dark UI.

Two decoupled apps:

| App | Stack | Deploy |
| --- | --- | --- |
| **`web/`** | Next.js 16 (App Router) · TypeScript · Tailwind v4 · Radix UI · Zustand · socket.io-client | **Vercel** |
| **`api/`** | Node · Express · TypeScript · Socket.IO · Mongoose (MongoDB) · JWT · Zod | **Render** |

The split is deliberate: Socket.IO needs a long-running server (Render), which Vercel's serverless model handles poorly. The frontend stays a fast SSR/edge app on Vercel.

---

## Features

- **Auth** — register/login with JWT in **httpOnly cookies**, silent access-token refresh, "log out everywhere".
- **Real-time** — messages, presence (online/last seen), typing indicators, and read receipts over Socket.IO.
- **Conversations** — 1-to-1 and **group chats** with admin roles, add/remove members, rename, leave.
- **Messages** — replies, **reactions**, **edit** & soft-**delete**, image/file attachments, day dividers, infinite scroll history.
- **Search** — across conversations and message content.
- **Notifications** — in-app toasts + opt-in desktop notifications with a sound.
- **Profiles & settings** — avatar upload, display name, status, bio; theme (light/dark/system); notification + session controls.
- **Responsive** — single-pane on mobile, two-pane on desktop; keyboard-accessible, reduced-motion aware.

---

## Local development

### Prerequisites
- Node.js ≥ 20
- A MongoDB instance (local `mongod`, or a free MongoDB Atlas cluster)

### 1. API (`api/`)
```bash
cd api
cp .env.example .env        # then fill in MONGO_URI and JWT secrets
npm install
npm run dev                 # http://localhost:5000
```
Generate strong secrets:
```bash
openssl rand -hex 64        # use for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
```

### 2. Web (`web/`)
```bash
cd web
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                 # http://localhost:3000
```

Open http://localhost:3000, create an account, open a second browser/incognito to chat between two users in real time.

---

## Environment variables

### API (`api/.env`)
| Var | Notes |
| --- | --- |
| `MONGO_URI` | MongoDB connection string. If your username/password contains symbols, the API percent-encodes the credential portion on boot. Wrap the value in quotes if it contains `#`. |
| `CLIENT_ORIGINS` | Comma-separated allowed origins (e.g. `http://localhost:3000`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Long random strings |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | e.g. `15m`, `7d` |
| `COOKIE_SECURE` | `true` in production |
| `COOKIE_SAMESITE` | `lax` locally, **`none`** in production (cross-site) |
| `COOKIE_DOMAIN` | Optional. Usually leave empty unless intentionally sharing cookies across subdomains. |
| `CLOUDINARY_*` | Optional — enables image/file uploads |

### Web (`web/.env.local`)
| Var | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the API |

---

## Deployment

### Backend → Render
1. Push this repo to GitHub.
2. In Render, **New → Blueprint** and select the repo (uses [`render.yaml`](./render.yaml)), or create a Web Service with **root directory `api`**, build `npm install && npm run build`, start `npm start`.
3. Set env vars: `MONGO_URI`, `CLIENT_ORIGINS` (your Vercel URL), `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and (optionally) the `CLOUDINARY_*` keys. Secrets can be auto-generated.

### Frontend → Vercel
1. **New Project** from the same repo, set **Root Directory** to `web`.
2. Add env var `NEXT_PUBLIC_API_URL` = your Render API URL.
3. Deploy. Then update the API's `CLIENT_ORIGINS` to include the Vercel URL and redeploy the API.

> **Cross-site cookies:** because the apps live on different domains, production requires `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` on the API, and the API's CORS is restricted to `CLIENT_ORIGINS` with credentials enabled.

---

## Production checklist

- Rotate any credentials that were shared during development, especially MongoDB passwords.
- Set strong production values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Set API `CLIENT_ORIGINS` to the deployed Vercel URL.
- Set API cookies to `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none`.
- Set web `NEXT_PUBLIC_API_URL` to the deployed Render API URL.
- Configure `CLOUDINARY_*` if image/file uploads should be enabled.
- Run `npm run lint`, `npm run build`, and `npm audit --omit=dev` in both apps before deploying.

---

## Project structure

```
chat-app/
├─ api/                      # Express + Socket.IO + MongoDB (TypeScript)
│  └─ src/
│     ├─ config/             # validated env, db connection, constants
│     ├─ models/             # User, Conversation, Message (Mongoose)
│     ├─ modules/            # feature modules: routes · controller · service · validation
│     │  ├─ auth/ users/ conversations/ messages/ uploads/
│     ├─ middleware/         # auth guard, zod validate, error handler, rate limit
│     ├─ socket/             # io setup, presence, typing handlers
│     ├─ utils/              # ApiError, jwt, cookies, password, logger
│     ├─ app.ts  server.ts
└─ web/                      # Next.js App Router (TypeScript)
   └─ src/
      ├─ app/                # (auth) and (app) route groups, layouts, pages
      ├─ components/
      │  ├─ ui/              # Radix-based primitives (button, dialog, …)
      │  ├─ chat/            # sidebar, list, message bubble, composer, dialogs
      │  └─ providers/       # theme, auth, socket
      ├─ hooks/  lib/  store/  types/
```

Each backend feature is a self-contained module (`routes → controller → service → validation`) so new capabilities slot in without touching unrelated code.
