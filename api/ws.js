export const config = { runtime: 'edge' };

// In-memory room registry for this Edge function instance.
// Note: Edge instances can scale; this state is not shared across regions/instances.
// For production-grade multi-instance signaling, back this with a shared store (e.g., Redis pub/sub).
const rooms = globalThis.__nekolive_rooms || new Map();
globalThis.__nekolive_rooms = rooms;

function jsonSafeParse(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

export default function handler(req) {
  // Require WebSocket upgrade
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected a WebSocket upgrade request', { status: 400 });
  }

  // Create a WebSocket pair (client<->server)
  const { 0: client, 1: server } = new WebSocketPair();

  // Accept the server-side socket
  server.accept();

  // Per-connection state
  server.sessionId = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  server.userId = Math.random().toString(36).slice(2);
  server.roomName = null;

  // Helper to broadcast to everyone else in the same room
  const broadcastToRoom = (roomName, fromSocket, data) => {
    const room = rooms.get(roomName);
    if (!room) return;
    let sent = 0;
    room.forEach((ws) => {
      if (ws !== fromSocket) {
        try {
          ws.send(data);
          sent++;
        } catch {}
      }
    });
    return sent;
  };

  // Handle messages from the client
  server.addEventListener('message', (event) => {
    const msg = typeof event.data === 'string' ? jsonSafeParse(event.data) : null;
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'join-room': {
        const roomName = (msg.roomName || '').toString();
        if (!roomName || roomName.length > 50) return;

        if (!rooms.has(roomName)) {
          rooms.set(roomName, new Set());
        }
        const room = rooms.get(roomName);
        room.add(server);
        server.roomName = roomName;

        // Notify others in the room (mirrors Node server behavior)
        const joinMessage = JSON.stringify({
          type: 'user-joined',
          userId: server.userId,
          userName: msg.userName || 'User',
          roomName,
          timestamp: Date.now(),
        });
        broadcastToRoom(roomName, server, joinMessage);
        break;
      }

      default: {
        // Relay any other signaling message to the rest of the room
        if (server.roomName) {
          broadcastToRoom(server.roomName, server, event.data);
        }
        break;
      }
    }
  });

  // Cleanup on disconnect/error
  const cleanup = () => {
    if (!server.roomName) return;
    const room = rooms.get(server.roomName);
    if (!room) return;

    room.delete(server);

    if (room.size === 0) {
      rooms.delete(server.roomName);
    } else {
      const leaveMessage = JSON.stringify({
        type: 'user-left',
        userId: server.userId,
        userName: 'User',
        roomName: server.roomName,
        timestamp: Date.now(),
      });
      room.forEach((ws) => {
        try { ws.send(leaveMessage); } catch {}
      });
    }
  };

  server.addEventListener('close', cleanup);
  server.addEventListener('error', cleanup);

  // Return the client end to the browser and complete the upgrade
  return new Response(null, { status: 101, webSocket: client });
}
