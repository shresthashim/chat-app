import type { Server, Socket } from "socket.io";
import type { Types } from "mongoose";
import { Conversation } from "../../models/Conversation.js";
import { SOCKET_EVENTS } from "../../config/constants.js";
import { userRoom } from "../io.js";
import type { AuthUser } from "../../types/index.js";

interface TypingPayload {
  conversationId: string;
}

/** Resolve the other members of a conversation the user actually belongs to. */
async function otherParticipantIds(conversationId: string, userId: string): Promise<string[]> {
  const conversation = await Conversation.findOne(
    { _id: conversationId, "participants.user": userId },
    { "participants.user": 1 },
  ).lean<{ participants: Array<{ user: Types.ObjectId }> } | null>();
  if (!conversation) return [];
  return conversation.participants
    .map((p) => p.user.toString())
    .filter((id) => id !== userId);
}

export function registerTypingHandlers(io: Server, socket: Socket, user: AuthUser): void {
  const forward = (event: string) => async (payload: TypingPayload) => {
    try {
      if (!payload?.conversationId) return;
      const others = await otherParticipantIds(payload.conversationId, user.id);
      const data = {
        conversationId: payload.conversationId,
        user: { id: user.id, username: user.username },
      };
      for (const id of others) io.to(userRoom(id)).emit(event, data);
    } catch {
      // Typing is ephemeral; ignore transient lookup failures.
    }
  };

  socket.on(SOCKET_EVENTS.TYPING_START, forward(SOCKET_EVENTS.TYPING_START));
  socket.on(SOCKET_EVENTS.TYPING_STOP, forward(SOCKET_EVENTS.TYPING_STOP));
}
