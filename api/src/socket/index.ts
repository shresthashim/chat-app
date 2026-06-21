import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { parse as parseCookie } from "cookie";
import { env } from "../config/env.js";
import { COOKIE_NAMES, SOCKET_EVENTS } from "../config/constants.js";
import { logger } from "../utils/logger.js";
import { User } from "../models/User.js";
import { resolveUserFromToken } from "../middleware/auth.middleware.js";
import { setIO, userRoom } from "./io.js";
import { addConnection, removeConnection, getOnlineUserIds } from "./presence.js";
import { registerTypingHandlers } from "./handlers/typing.js";
import { registerCallHandlers } from "./handlers/call.js";
import type { AuthUser } from "../types/index.js";

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGINS, credentials: true },
  });
  setIO(io);

  // Authenticate the handshake using the same httpOnly access-token cookie as REST.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
      const user = await resolveUserFromToken(cookies[COOKIE_NAMES.ACCESS_TOKEN]);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on(SOCKET_EVENTS.CONNECT, (socket) => {
    const user = socket.data.user as AuthUser;
    socket.join(userRoom(user.id));

    const becameOnline = addConnection(user.id, socket.id);
    if (becameOnline) {
      socket.broadcast.emit(SOCKET_EVENTS.PRESENCE_ONLINE, { userId: user.id });
    }
    // Send the newcomer the current presence snapshot.
    socket.emit(SOCKET_EVENTS.PRESENCE_SNAPSHOT, { online: [...getOnlineUserIds()] });

    registerTypingHandlers(io, socket, user);
    registerCallHandlers(io, socket, user);

    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      const becameOffline = removeConnection(user.id, socket.id);
      if (becameOffline) {
        const lastSeenAt = new Date();
        await User.findByIdAndUpdate(user.id, { lastSeenAt }).catch(() => null);
        socket.broadcast.emit(SOCKET_EVENTS.PRESENCE_OFFLINE, {
          userId: user.id,
          lastSeenAt,
        });
      }
    });
  });

  logger.info("Socket.IO initialized");
  return io;
}
