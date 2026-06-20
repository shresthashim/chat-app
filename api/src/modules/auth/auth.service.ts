import { User, type UserDoc } from "../../models/User.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import type { RegisterInput, LoginInput } from "./auth.validation.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(user: UserDoc, tokenVersion: number): AuthTokens {
  const id = user.id as string;
  return {
    accessToken: signAccessToken(id, tokenVersion),
    refreshToken: signRefreshToken(id, tokenVersion),
  };
}

export async function registerUser(
  input: RegisterInput,
): Promise<{ user: UserDoc; tokens: AuthTokens }> {
  const existing = await User.findOne({
    $or: [{ username: input.username }, { email: input.email }],
  }).lean();
  if (existing) {
    const field = existing.email === input.email ? "Email" : "Username";
    throw ApiError.conflict(`${field} already in use`);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    username: input.username,
    email: input.email,
    passwordHash,
    displayName: input.displayName || input.username,
  });

  return { user, tokens: issueTokens(user, 0) };
}

export async function loginUser(input: LoginInput): Promise<{ user: UserDoc; tokens: AuthTokens }> {
  // Identifier can be a username or an email.
  const user = await User.findOne({
    $or: [{ username: input.identifier }, { email: input.identifier.toLowerCase() }],
  }).select("+passwordHash +tokenVersion");

  if (!user) throw ApiError.unauthorized("Invalid credentials");

  // passwordHash / tokenVersion are `select: false`; Mongoose types them loosely here.
  const valid = await verifyPassword(input.password, user.passwordHash as string);
  if (!valid) throw ApiError.unauthorized("Invalid credentials");

  user.lastSeenAt = new Date();
  await user.save();

  return { user, tokens: issueTokens(user, user.tokenVersion as number) };
}

/**
 * Rotate tokens from a valid refresh token. The token's version must still
 * match the user's current version (invalidated by "log out everywhere").
 */
export async function refreshTokens(
  refreshToken: string | undefined,
): Promise<{ user: UserDoc; tokens: AuthTokens }> {
  if (!refreshToken) throw ApiError.unauthorized("Missing refresh token");

  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub).select("+tokenVersion");
  if (!user) throw ApiError.unauthorized("User no longer exists");
  if (user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized("Session expired, please log in again");
  }

  return { user, tokens: issueTokens(user, user.tokenVersion) };
}

/** Invalidate every previously issued refresh token for a user. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}

/** Whether a username is free to register (matches the case-sensitive unique index). */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = await User.exists({ username });
  return existing === null;
}
