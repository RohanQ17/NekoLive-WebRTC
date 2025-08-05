// Enhanced WebSocket signaling server for NekoLive WebRTC
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();

console.log(`🚀 NekoLive WebRTC Signaling Server running on port ${PORT}`);

wss.on('connection', (ws, request) => {
    console.log('🔗 New client connected from:', request.socket.remoteAddress);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, roomName } = data;
            
            console.log('📨 Received message:', type, 'for room:', roomName);
            
            // Join room
            if (type === 'join-room') {
                if (!rooms.has(roomName)) {
                    rooms.set(roomName, new Set());
                    console.log('🏠 Created new room:', roomName);
                }
                rooms.get(roomName).add(ws);
                ws.roomName = roomName;
                ws.userId = data.userId;
                console.log(`👤 Client joined room: ${roomName} (${rooms.get(roomName).size} participants)`);
                return;
            }
            
            // Broadcast message to room members (except sender)
            if (ws.roomName && rooms.has(ws.roomName)) {
                const roomClients = rooms.get(ws.roomName);
                let sentCount = 0;
                
                roomClients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                        sentCount++;
                    }
                });
                
                console.log(`📤 Broadcasted ${type} to ${sentCount} clients in room ${ws.roomName}`);
            }
        } catch (error) {
            console.error('❌ Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 Client disconnected');
        
        // Remove from room
        if (ws.roomName && rooms.has(ws.roomName)) {
            rooms.get(ws.roomName).delete(ws);
            
            // Notify other clients in room about disconnection
            const roomClients = rooms.get(ws.roomName);
            if (roomClients.size > 0) {
                const leaveMessage = JSON.stringify({
                    type: 'user-left',
                    userId: ws.userId,
                    userName: 'Unknown User',
                    roomName: ws.roomName,
                    timestamp: Date.now()
                });
                
                roomClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(leaveMessage);
                    }
                });
            }
            
            // Clean up empty rooms
            if (rooms.get(ws.roomName).size === 0) {
                rooms.delete(ws.roomName);
                console.log('🗑️ Deleted empty room:', ws.roomName);
            } else {
                console.log(`👋 Client left room: ${ws.roomName} (${rooms.get(ws.roomName).size} participants remaining)`);
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down signaling server...');
    wss.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = wss;
