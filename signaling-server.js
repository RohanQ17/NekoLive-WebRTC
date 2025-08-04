// Simple WebSocket signaling server (Node.js)
// This is an optional enhancement for production use
// Currently the app uses localStorage for signaling (works for same-origin tabs)

const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, roomName } = data;
            
            // Join room
            if (type === 'join-room') {
                if (!rooms.has(roomName)) {
                    rooms.set(roomName, new Set());
                }
                rooms.get(roomName).add(ws);
                ws.roomName = roomName;
                console.log(`Client joined room: ${roomName}`);
                return;
            }
            
            // Broadcast message to room members
            if (ws.roomName && rooms.has(ws.roomName)) {
                const roomClients = rooms.get(ws.roomName);
                roomClients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        
        // Remove from room
        if (ws.roomName && rooms.has(ws.roomName)) {
            rooms.get(ws.roomName).delete(ws);
            if (rooms.get(ws.roomName).size === 0) {
                rooms.delete(ws.roomName);
            }
        }
    });
});

console.log('WebSocket signaling server running on port 8080');

module.exports = wss;
