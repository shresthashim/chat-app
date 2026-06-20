import type { AuthUser } from "./index.ts";

declare global {
  namespace Express {
    interface Request {
      /** Populated by `requireAuth`; guaranteed present on protected routes. */
      user?: AuthUser;
    }
  }
}

export {};
