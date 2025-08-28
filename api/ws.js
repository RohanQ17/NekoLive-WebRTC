export const config = {
  runtime: 'edge'
};

const rooms = new Map(); // roomName -> Set of sockets

export default async function handler(req) {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected a WebSocket connection', { status: 400 });
  }

  const { 0: client, 1: server } = Object.values(new WebSocketPair());

  server.accept();
  server.userId = Math.random().toString(36).slice(2);
  server.roomName = null;

  server.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
      const type = data.type;
      const roomName = data.roomName;

      if (!type) return;

      if (type === 'join-room') {
        if (!roomName || typeof roomName !== 'string') return;
        // leave previous room
        if (server.roomName && rooms.has(server.roomName)) {
          rooms.get(server.roomName).delete(server);
        }
        server.roomName = roomName;
        if (!rooms.has(roomName)) rooms.set(roomName, new Set());
        rooms.get(roomName).add(server);
        return;
      }

      // broadcast to room (except sender)
      if (server.roomName && rooms.has(server.roomName)) {
        const payload = JSON.stringify({ ...data, timestamp: Date.now() });
        rooms.get(server.roomName).forEach(sock => {
          if (sock !== server) {
            try { sock.send(payload); } catch {}
          }
        });
      }
    } catch (e) {
      // ignore
    }
  });

  server.addEventListener('close', () => {
    if (server.roomName && rooms.has(server.roomName)) {
      rooms.get(server.roomName).delete(server);
      if (rooms.get(server.roomName).size === 0) rooms.delete(server.roomName);
    }
  });

  return new Response(null, { status: 101, webSocket: client });
}
