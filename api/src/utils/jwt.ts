import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

export type TokenType = "access" | "refresh";

export interface TokenPayload {
  sub: string; // user id
  type: TokenType;
  /** Bumped on "log out everywhere" to invalidate previously issued refresh tokens. */
  tokenVersion: number;
}

type SignablePayload = Omit<TokenPayload, "iat" | "exp">;

function sign(payload: SignablePayload, secret: string, expiresIn: string): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, secret, options);
}

export function signAccessToken(userId: string, tokenVersion: number): string {
  return sign({ sub: userId, type: "access", tokenVersion }, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_TTL);
}

export function signRefreshToken(userId: string, tokenVersion: number): string {
  return sign({ sub: userId, type: "refresh", tokenVersion }, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_TTL);
}

function verify(token: string, secret: string, expectedType: TokenType): TokenPayload {
  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    if (decoded.type !== expectedType) {
      throw ApiError.unauthorized("Invalid token type");
    }
    return decoded;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized("Invalid or expired token");
  }
}

export function verifyAccessToken(token: string): TokenPayload {
  return verify(token, env.JWT_ACCESS_SECRET, "access");
}

export function verifyRefreshToken(token: string): TokenPayload {
  return verify(token, env.JWT_REFRESH_SECRET, "refresh");
}
