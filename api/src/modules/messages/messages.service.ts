import { Types } from "mongoose";
import { Message, type MessageDoc } from "../../models/Message.js";
import { Conversation, type ConversationDoc } from "../../models/Conversation.js";
import { ApiError } from "../../utils/ApiError.js";
import { assertParticipant, getParticipantIds, participantUserId } from "../conversations/conversations.service.js";

const SENDER_FIELDS = "username displayName avatarUrl";

const REPLY_POPULATE = {
  path: "replyTo",
  populate: { path: "sender", select: SENDER_FIELDS },
} as const;

/** Fetch a single fully-populated message by id (post-write reads). */
async function findPopulatedMessage(id: unknown): Promise<MessageDoc | null> {
  return (await Message.findById(id)
    .populate("sender", SENDER_FIELDS)
    .populate(REPLY_POPULATE)) as MessageDoc | null;
}

async function loadConversationFor(userId: string, conversationId: string): Promise<ConversationDoc> {
  const conversation = (await Conversation.findById(conversationId)) as ConversationDoc | null;
  if (!conversation) throw ApiError.notFound("Conversation not found");
  assertParticipant(conversation, userId);
  return conversation;
}

export interface MessagePage {
  messages: unknown[];
  nextCursor: string | null;
}

/** Cursor-paginated history, returned oldest→newest for natural rendering. */
export async function listMessages(
  userId: string,
  conversationId: string,
  options: { limit: number; cursor?: string },
): Promise<MessagePage> {
  await loadConversationFor(userId, conversationId);

  const filter: Record<string, unknown> = { conversation: conversationId };
  if (options.cursor) filter.createdAt = { $lt: new Date(options.cursor) };

  // Fetch one extra to know whether another page exists.
  const docs = (await Message.find(filter)
    .populate("sender", SENDER_FIELDS)
    .populate(REPLY_POPULATE)
    .sort({ createdAt: -1 })
    .limit(options.limit + 1)) as unknown as MessageDoc[];

  const hasMore = docs.length > options.limit;
  const page = hasMore ? docs.slice(0, options.limit) : docs;
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  return {
    messages: page.reverse().map((m) => m.toJSON()),
    nextCursor,
  };
}

export interface SendResult {
  message: Record<string, unknown>;
  participantIds: string[];
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: { text: string; attachments: unknown[]; replyTo?: string },
): Promise<SendResult> {
  const conversation = await loadConversationFor(userId, conversationId);

  const attachments = input.attachments as Array<{ type: "image" | "file" }>;
  const type = attachments.length > 0 ? attachments[0]!.type : "text";

  if (input.replyTo) {
    const replyExists = await Message.exists({
      _id: input.replyTo,
      conversation: conversationId,
      deletedAt: null,
    });
    if (!replyExists) throw ApiError.badRequest("Reply target is not available");
  }

  const created = await Message.create({
    conversation: conversationId,
    sender: userId,
    text: input.text,
    attachments,
    type,
    replyTo: input.replyTo ?? null,
    readBy: [{ user: userId }],
  });

  // Denormalize for conversation-list previews/ordering.
  conversation.lastMessage = created._id;
  conversation.lastMessageAt = created.createdAt;
  const sender = conversation.participants.find((p) => participantUserId(p.user) === userId);
  if (sender) {
    sender.lastReadAt = created.createdAt;
    sender.lastReadMessage = created._id;
  }
  await conversation.save();

  const populated = await findPopulatedMessage(created._id);
  return { message: populated!.toJSON() as Record<string, unknown>, participantIds: getParticipantIds(conversation) };
}

async function loadOwnedMessage(userId: string, conversationId: string, messageId: string) {
  const message = await Message.findOne({ _id: messageId, conversation: conversationId });
  if (!message) throw ApiError.notFound("Message not found");
  if (message.sender!.toString() !== userId) throw ApiError.forbidden("You can only modify your own messages");
  if (message.deletedAt) throw ApiError.badRequest("Message has been deleted");
  return message;
}

export async function editMessage(
  userId: string,
  conversationId: string,
  messageId: string,
  text: string,
): Promise<SendResult> {
  await loadConversationFor(userId, conversationId);
  const message = await loadOwnedMessage(userId, conversationId, messageId);

  message.text = text;
  message.editedAt = new Date();
  await message.save();

  const populated = await findPopulatedMessage(message._id);
  const conversation = (await Conversation.findById(conversationId)) as ConversationDoc | null;
  return {
    message: populated!.toJSON() as Record<string, unknown>,
    participantIds: conversation ? getParticipantIds(conversation) : [],
  };
}

export async function deleteMessage(
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<SendResult> {
  await loadConversationFor(userId, conversationId);
  const message = await loadOwnedMessage(userId, conversationId, messageId);

  // Soft delete: keep the row for thread/order integrity, drop the content.
  message.deletedAt = new Date();
  message.text = "";
  message.attachments = [] as typeof message.attachments;
  message.reactions = [] as typeof message.reactions;
  await message.save();

  const populated = await findPopulatedMessage(message._id);
  const conversation = await Conversation.findById(conversationId);
  return {
    message: populated!.toJSON() as Record<string, unknown>,
    participantIds: conversation ? getParticipantIds(conversation) : [],
  };
}

/** Toggle a single (user, emoji) reaction on a message. */
export async function toggleReaction(
  userId: string,
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<SendResult> {
  const conversation = await loadConversationFor(userId, conversationId);
  const message = await Message.findOne({ _id: messageId, conversation: conversationId });
  if (!message) throw ApiError.notFound("Message not found");
  if (message.deletedAt) throw ApiError.badRequest("Message has been deleted");

  const idx = message.reactions.findIndex((r) => r.user.toString() === userId && r.emoji === emoji);
  if (idx >= 0) {
    message.reactions.splice(idx, 1);
  } else {
    message.reactions.push({ user: new Types.ObjectId(userId), emoji });
  }
  await message.save();

  const populated = await findPopulatedMessage(message._id);
  return {
    message: populated!.toJSON() as Record<string, unknown>,
    participantIds: getParticipantIds(conversation),
  };
}

/** Full-text-ish search across the user's own conversations. */
export async function searchMessages(userId: string, q: string, limit: number) {
  const conversationIds = await Conversation.find({ "participants.user": userId }).distinct("_id");
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const messages = (await Message.find({
    conversation: { $in: conversationIds },
    deletedAt: null,
    text: new RegExp(safe, "i"),
  })
    .populate("sender", SENDER_FIELDS)
    .sort({ createdAt: -1 })
    .limit(limit)) as unknown as MessageDoc[];

  return messages.map((m) => m.toJSON());
}
