import { Types } from "mongoose";
import { Conversation, buildDirectKey, type ConversationDoc } from "../../models/Conversation.js";
import { Message } from "../../models/Message.js";
import { User } from "../../models/User.js";
import { ApiError } from "../../utils/ApiError.js";
import { isUserOnline } from "../../socket/presence.js";

const PARTICIPANT_FIELDS = "username displayName avatarUrl statusText lastSeenAt";

const LAST_MESSAGE_POPULATE = {
  path: "lastMessage",
  populate: { path: "sender", select: PARTICIPANT_FIELDS },
} as const;

export function getParticipantIds(conversation: ConversationDoc): string[] {
  return conversation.participants.map((p) => participantUserId(p.user));
}

export function participantUserId(user: unknown): string {
  if (user instanceof Types.ObjectId) return user.toString();
  if (typeof user === "string") return user;
  if (user && typeof user === "object") {
    const value = user as { _id?: unknown; id?: unknown };
    if (value._id instanceof Types.ObjectId) return value._id.toString();
    if (typeof value._id === "string") return value._id;
    if (typeof value.id === "string") return value.id;
  }
  return String(user);
}

/** Throw unless the user is a participant; returns the participant entry. */
export function assertParticipant(conversation: ConversationDoc, userId: string) {
  const participant = conversation.participants.find((p) => participantUserId(p.user) === userId);
  if (!participant) throw ApiError.forbidden("You are not a member of this conversation");
  return participant;
}

function assertAdmin(conversation: ConversationDoc, userId: string) {
  const participant = assertParticipant(conversation, userId);
  if (conversation.type === "group" && participant.role !== "admin") {
    throw ApiError.forbidden("Only group admins can perform this action");
  }
}

/** Count messages the user hasn't read yet (not their own, after lastReadAt). */
async function unreadCountFor(conversation: ConversationDoc, userId: string): Promise<number> {
  const participant = conversation.participants.find((p) => participantUserId(p.user) === userId);
  const after = participant?.lastReadAt;
  return Message.countDocuments({
    conversation: conversation._id,
    sender: { $ne: new Types.ObjectId(userId) },
    deletedAt: null,
    ...(after ? { createdAt: { $gt: after } } : {}),
  });
}

/** Serialize a conversation for a given viewer, enriching presence + unread. */
export async function serializeConversation(conversation: ConversationDoc, userId: string) {
  const json = conversation.toJSON() as Record<string, unknown>;
  const participants = (json.participants as Array<Record<string, unknown>>).map((p) => {
    const user = p.user as { id?: string } | null;
    return {
      ...p,
      user: user && user.id ? { ...user, online: isUserOnline(user.id) } : user,
    };
  });
  return {
    ...json,
    participants,
    unreadCount: await unreadCountFor(conversation, userId),
  };
}

export async function listConversations(userId: string) {
  const conversations = (await Conversation.find({ "participants.user": userId })
    .populate("participants.user", PARTICIPANT_FIELDS)
    .populate(LAST_MESSAGE_POPULATE)
    .sort({ lastMessageAt: -1, updatedAt: -1 })) as unknown as ConversationDoc[];

  return Promise.all(conversations.map((c) => serializeConversation(c, userId)));
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = (await Conversation.findById(conversationId)
    .populate("participants.user", PARTICIPANT_FIELDS)
    .populate(LAST_MESSAGE_POPULATE)) as ConversationDoc | null;
  if (!conversation) throw ApiError.notFound("Conversation not found");
  assertParticipant(conversation, userId);
  return conversation;
}

/** Find or create the single direct conversation between two users. */
export async function getOrCreateDirectConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw ApiError.badRequest("You cannot start a chat with yourself");

  const other = await User.findById(otherUserId).lean();
  if (!other) throw ApiError.notFound("User not found");

  const directKey = buildDirectKey(userId, otherUserId);
  let conversation = await Conversation.findOne({ directKey });

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        type: "direct",
        directKey,
        participants: [{ user: userId }, { user: otherUserId }],
      });
    } catch (err) {
      // Handle the race where both users create it simultaneously.
      if (isDuplicateKey(err)) {
        conversation = await Conversation.findOne({ directKey });
      } else {
        throw err;
      }
    }
  }

  return getConversation(userId, conversation!.id as string);
}

export async function createGroupConversation(
  userId: string,
  input: { name: string; memberIds: string[]; avatarUrl?: string },
) {
  const memberIds = [...new Set(input.memberIds.filter((id) => id !== userId))];
  const found = await User.countDocuments({ _id: { $in: memberIds } });
  if (found !== memberIds.length) throw ApiError.badRequest("One or more members do not exist");

  const conversation = await Conversation.create({
    type: "group",
    name: input.name,
    avatarUrl: input.avatarUrl ?? "",
    createdBy: userId,
    participants: [
      { user: userId, role: "admin" },
      ...memberIds.map((id) => ({ user: id, role: "member" as const })),
    ],
  });

  return getConversation(userId, conversation.id as string);
}

export async function updateGroup(
  userId: string,
  conversationId: string,
  input: { name?: string; description?: string; avatarUrl?: string },
) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Not a group conversation");
  assertAdmin(conversation, userId);

  Object.assign(conversation, input);
  await conversation.save();
  return getConversation(userId, conversationId);
}

export async function addMembers(userId: string, conversationId: string, memberIds: string[]) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Not a group conversation");
  assertAdmin(conversation, userId);

  const existing = new Set(getParticipantIds(conversation));
  const toAdd = [...new Set(memberIds)].filter((id) => !existing.has(id));
  const found = await User.countDocuments({ _id: { $in: toAdd } });
  if (found !== toAdd.length) throw ApiError.badRequest("One or more members do not exist");

  conversation.participants.push(...toAdd.map((id) => ({ user: new Types.ObjectId(id), role: "member" as const })));
  await conversation.save();
  return getConversation(userId, conversationId);
}

export interface RemoveMemberResult {
  conversation: ConversationDoc | null;
  remainingParticipantIds: string[];
  removedMemberId: string;
  removedSelf: boolean;
}

export async function removeMember(
  userId: string,
  conversationId: string,
  memberId: string,
): Promise<RemoveMemberResult> {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  if (conversation.type !== "group") throw ApiError.badRequest("Not a group conversation");
  // A user may remove themselves (leave); otherwise admin-only.
  if (memberId !== userId) assertAdmin(conversation, userId);

  const previousParticipantIds = getParticipantIds(conversation);
  if (!previousParticipantIds.includes(memberId)) throw ApiError.notFound("Member not found");
  if (previousParticipantIds.length === 1) {
    await Message.deleteMany({ conversation: conversationId });
    await Conversation.deleteOne({ _id: conversationId });
    return {
      conversation: null,
      remainingParticipantIds: [],
      removedMemberId: memberId,
      removedSelf: memberId === userId,
    };
  }

  conversation.participants = conversation.participants.filter(
    (p) => participantUserId(p.user) !== memberId,
  ) as typeof conversation.participants;

  const hasAdmin = conversation.participants.some((p) => p.role === "admin");
  if (!hasAdmin && conversation.participants[0]) {
    conversation.participants[0].role = "admin";
  }

  await conversation.save();
  const remainingParticipantIds = getParticipantIds(conversation);
  return {
    conversation: await getConversation(remainingParticipantIds[0]!, conversationId).catch(() => null),
    remainingParticipantIds,
    removedMemberId: memberId,
    removedSelf: memberId === userId,
  };
}

/** Mark a conversation read up to now for the viewer. */
export async function markRead(userId: string, conversationId: string, messageId?: string) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound("Conversation not found");
  const participant = assertParticipant(conversation, userId);

  const targetMessage = messageId
    ? await Message.findOne({ _id: messageId, conversation: conversationId }).select("_id createdAt sender")
    : await Message.findOne({ conversation: conversationId }).sort({ createdAt: -1 }).select("_id createdAt sender");

  if (messageId && !targetMessage) throw ApiError.notFound("Message not found");

  const readAt = new Date();
  const cutoff = targetMessage?.createdAt ?? readAt;
  const previousReadAt = participant.lastReadAt?.getTime() ?? 0;

  if (cutoff.getTime() > previousReadAt) {
    participant.lastReadAt = readAt;
    if (targetMessage) participant.lastReadMessage = targetMessage._id;
  }

  await conversation.save();

  if (targetMessage) {
    await Message.updateMany(
      {
        conversation: conversationId,
        createdAt: { $lte: cutoff },
        sender: { $ne: new Types.ObjectId(userId) },
        "readBy.user": { $ne: new Types.ObjectId(userId) },
      },
      { $push: { readBy: { user: new Types.ObjectId(userId), readAt } } },
    );
  }

  return {
    conversationId,
    userId,
    messageId: participant.lastReadMessage?.toString() ?? null,
    readAt: participant.lastReadAt ?? readAt,
  };
}

interface MongoDuplicateKeyError {
  code?: number;
}
function isDuplicateKey(err: unknown): boolean {
  return (err as MongoDuplicateKeyError)?.code === 11000;
}
