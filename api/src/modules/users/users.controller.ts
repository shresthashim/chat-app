import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { getOnlineUserIds, isUserOnline } from "../../socket/presence.js";
import * as usersService from "./users.service.js";

export const searchUsers = catchAsync(async (req: Request, res: Response) => {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  const users = await usersService.searchUsers(q, req.user!.id, limit);
  const online = getOnlineUserIds();
  const data = users.map((u) => ({ ...u.toJSON(), online: online.has(u.id) }));
  sendSuccess(res, { users: data });
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await usersService.getUserById(req.params.id as string);
  sendSuccess(res, { user: { ...user.toJSON(), online: isUserOnline(user.id) } });
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await usersService.updateProfile(req.user!.id, req.body);
  sendSuccess(res, { user: user.toJSON() }, 200, "Profile updated");
});
