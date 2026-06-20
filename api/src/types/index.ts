/** The authenticated principal attached to `req.user` by the auth middleware. */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

/** Cursor-style pagination query shared across list endpoints. */
export interface PaginationQuery {
  limit: number;
  cursor?: string;
}
