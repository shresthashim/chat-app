import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { emitToUsers } from "../../socket/io.js";
import { SOCKET_EVENTS } from "../../config/constants.js";
import type { ConversationDoc } from "../../models/Conversation.js";
import * as service from "./conversations.service.js";

async function emitConversationToParticipants(
  conversation: ConversationDoc,
  event: string,
  participantIds = service.getParticipantIds(conversation),
) {
  await Promise.all(
    participantIds.map(async (participantId) => {
      const data = await service.serializeConversation(conversation, participantId);
      emitToUsers([participantId], event, data);
    }),
  );
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const conversations = await service.listConversations(req.user!.id);
  sendSuccess(res, { conversations });
});

export const getOne = catchAsync(async (req: Request, res: Response) => {
  const conversation = await service.getConversation(req.user!.id, req.params.id as string);
  const data = await service.serializeConversation(conversation, req.user!.id);
  sendSuccess(res, { conversation: data });
});

export const createDirect = catchAsync(async (req: Request, res: Response) => {
  const conversation = await service.getOrCreateDirectConversation(req.user!.id, req.body.userId);
  const data = await service.serializeConversation(conversation, req.user!.id);
  // Let the other participant know a conversation now exists with them.
  await emitConversationToParticipants(conversation, SOCKET_EVENTS.CONVERSATION_NEW);
  sendSuccess(res, { conversation: data }, 201);
});

export const createGroup = catchAsync(async (req: Request, res: Response) => {
  const conversation = await service.createGroupConversation(req.user!.id, req.body);
  const data = await service.serializeConversation(conversation, req.user!.id);
  await emitConversationToParticipants(conversation, SOCKET_EVENTS.CONVERSATION_NEW);
  sendSuccess(res, { conversation: data }, 201);
});

export const updateGroup = catchAsync(async (req: Request, res: Response) => {
  const conversation = await service.updateGroup(req.user!.id, req.params.id as string, req.body);
  const data = await service.serializeConversation(conversation, req.user!.id);
  await emitConversationToParticipants(conversation, SOCKET_EVENTS.CONVERSATION_UPDATED);
  sendSuccess(res, { conversation: data });
});

export const addMembers = catchAsync(async (req: Request, res: Response) => {
  const conversation = await service.addMembers(req.user!.id, req.params.id as string, req.body.memberIds);
  const data = await service.serializeConversation(conversation, req.user!.id);
  await emitConversationToParticipants(conversation, SOCKET_EVENTS.CONVERSATION_UPDATED);
  sendSuccess(res, { conversation: data });
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  const result = await service.removeMember(
    req.user!.id,
    req.params.id as string,
    req.params.memberId as string,
  );
  if (result.conversation) {
    const data = await service.serializeConversation(result.conversation, result.removedSelf ? result.remainingParticipantIds[0]! : req.user!.id);
    await emitConversationToParticipants(
      result.conversation,
      SOCKET_EVENTS.CONVERSATION_UPDATED,
      result.remainingParticipantIds,
    );
    emitToUsers([result.removedMemberId], SOCKET_EVENTS.CONVERSATION_REMOVED, {
      conversationId: req.params.id,
    });
    return sendSuccess(res, { conversation: result.removedSelf ? null : data });
  }
  emitToUsers([result.removedMemberId], SOCKET_EVENTS.CONVERSATION_REMOVED, {
    conversationId: req.params.id,
  });
  sendSuccess(res, { conversation: null });
});

export const markRead = catchAsync(async (req: Request, res: Response) => {
  const receipt = await service.markRead(req.user!.id, req.params.id as string, req.body.messageId);
  const conversation = await service.getConversation(req.user!.id, req.params.id as string);
  emitToUsers(service.getParticipantIds(conversation), SOCKET_EVENTS.RECEIPT_READ, receipt);
  sendSuccess(res, receipt);
});
