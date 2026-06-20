import type { Request, Response } from "express";
import { COOKIE_NAMES } from "../../config/constants.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { setAuthCookies, clearAuthCookies } from "../../utils/cookies.js";
import { User } from "../../models/User.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  registerUser,
  loginUser,
  refreshTokens,
  revokeAllSessions,
  isUsernameAvailable,
} from "./auth.service.js";

export const register = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await registerUser(req.body);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { user: user.toJSON() }, 201, "Account created");
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await loginUser(req.body);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { user: user.toJSON() }, 200, "Logged in");
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
  const { user, tokens } = await refreshTokens(token);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, { user: user.toJSON() }, 200, "Session refreshed");
});

export const logout = catchAsync(async (_req: Request, res: Response) => {
  clearAuthCookies(res);
  sendSuccess(res, null, 200, "Logged out");
});

export const logoutAll = catchAsync(async (req: Request, res: Response) => {
  await revokeAllSessions(req.user!.id);
  clearAuthCookies(res);
  sendSuccess(res, null, 200, "Logged out of all sessions");
});

export const checkUsername = catchAsync(async (req: Request, res: Response) => {
  const username = req.query.username as string;
  const available = await isUsernameAvailable(username);
  sendSuccess(res, { username, available });
});

export const me = catchAsync(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.notFound("User not found");
  sendSuccess(res, { user: user.toJSON() });
});
