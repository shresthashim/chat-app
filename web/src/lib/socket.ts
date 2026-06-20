import { io, type Socket } from "socket.io-client";
import { API_URL } from "./config";

let socket: Socket | null = null;

/** Lazily create the shared socket. Auth rides on the httpOnly cookie via `withCredentials`. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
