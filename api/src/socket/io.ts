import type { Server } from "socket.io";

/**
 * Holds the Socket.IO server instance so domain services (invoked from REST
 * handlers) can broadcast real-time events without importing the HTTP layer.
 */
let io: Server | undefined;

export const setIO = (server: Server): void => {
  io = server;
};

export const getIO = (): Server | undefined => io;

/** Personal room every socket joins on connect, keyed by user id. */
export const userRoom = (userId: string): string => `user:${userId}`;

/** Emit an event to a set of users across all their connected devices. */
export function emitToUsers(userIds: Array<string>, event: string, payload: unknown): void {
  if (!io) return;
  for (const id of userIds) {
    io.to(userRoom(id)).emit(event, payload);
  }
}
