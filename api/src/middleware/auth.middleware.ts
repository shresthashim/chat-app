import type { RequestHandler } from "express";
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { COOKIE_NAMES } from "../config/constants.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { AuthUser } from "../types/index.js";

/**
 * Resolves an authenticated user from an access token. Shared by the HTTP
 * middleware and the Socket.IO handshake so both enforce the same rules.
 */
export async function resolveUserFromToken(token: string | undefined): Promise<AuthUser> {
  if (!token) throw ApiError.unauthorized("Authentication required");

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub)
    .select("username email +tokenVersion")
    .lean<{ _id: Types.ObjectId; username: string; email: string; tokenVersion: number } | null>();
  if (!user) throw ApiError.unauthorized("User no longer exists");
  if (user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized("Session expired, please log in again");
  }

  return { id: user._id.toString(), username: user.username, email: user.email };
}

/** Express guard for protected routes. Populates `req.user`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] as string | undefined;
  resolveUserFromToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
};
