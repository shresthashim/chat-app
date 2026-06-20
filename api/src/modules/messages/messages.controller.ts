import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { emitToUsers } from "../../socket/io.js";
import { SOCKET_EVENTS } from "../../config/constants.js";
import * as service from "./messages.service.js";

export const list = catchAsync(async (req: Request, res: Response) => {
  const { limit, cursor } = req.query as unknown as { limit: number; cursor?: string };
  const page = await service.listMessages(req.user!.id, req.params.id as string, { limit, cursor });
  sendSuccess(res, page);
});

export const send = catchAsync(async (req: Request, res: Response) => {
  const { message, participantIds } = await service.sendMessage(
    req.user!.id,
    req.params.id as string,
    req.body,
  );
  emitToUsers(participantIds, SOCKET_EVENTS.MESSAGE_NEW, message);
  sendSuccess(res, { message }, 201);
});

export const edit = catchAsync(async (req: Request, res: Response) => {
  const { message, participantIds } = await service.editMessage(
    req.user!.id,
    req.params.id as string,
    req.params.messageId as string,
    req.body.text,
  );
  emitToUsers(participantIds, SOCKET_EVENTS.MESSAGE_EDITED, message);
  sendSuccess(res, { message });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const { message, participantIds } = await service.deleteMessage(
    req.user!.id,
    req.params.id as string,
    req.params.messageId as string,
  );
  emitToUsers(participantIds, SOCKET_EVENTS.MESSAGE_DELETED, message);
  sendSuccess(res, { message });
});

export const react = catchAsync(async (req: Request, res: Response) => {
  const { message, participantIds } = await service.toggleReaction(
    req.user!.id,
    req.params.id as string,
    req.params.messageId as string,
    req.body.emoji,
  );
  emitToUsers(participantIds, SOCKET_EVENTS.MESSAGE_REACTION, message);
  sendSuccess(res, { message });
});

export const search = catchAsync(async (req: Request, res: Response) => {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  const messages = await service.searchMessages(req.user!.id, q, limit);
  sendSuccess(res, { messages });
});
