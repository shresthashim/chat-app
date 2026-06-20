# ChatHub Web

Next.js frontend for ChatHub.

## Development

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app runs at http://localhost:3000 and expects the API URL in `NEXT_PUBLIC_API_URL`.

## Checks

```bash
npm run lint
npm run build
npm audit --omit=dev
```

For full project setup and deployment notes, see the root [`README.md`](../README.md).
