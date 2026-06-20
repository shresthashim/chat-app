/**
 * In-memory presence registry. Maps a user id to the set of their active
 * socket ids so a user counts as "online" while at least one device/tab is
 * connected. (For multi-instance deployments this would move to Redis; a
 * single Render web service uses this directly.)
 */
const connections = new Map<string, Set<string>>();

/** Register a socket. Returns true if this is the user's first connection. */
export function addConnection(userId: string, socketId: string): boolean {
  let sockets = connections.get(userId);
  const wasOffline = !sockets || sockets.size === 0;
  if (!sockets) {
    sockets = new Set();
    connections.set(userId, sockets);
  }
  sockets.add(socketId);
  return wasOffline;
}

/** Remove a socket. Returns true if the user has no remaining connections. */
export function removeConnection(userId: string, socketId: string): boolean {
  const sockets = connections.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    connections.delete(userId);
    return true;
  }
  return false;
}

export function isUserOnline(userId: string): boolean {
  return connections.has(userId);
}

export function getOnlineUserIds(): Set<string> {
  return new Set(connections.keys());
}
