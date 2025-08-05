// Production-ready WebSocket signaling server for NekoLive WebRTC
// Load environment variables
require('dotenv').config();

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
    ['*'];
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS) || 100;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;

// In-memory storage (for production, consider Redis)
const rooms = new Map();
const userSessions = new Map();
const rateLimiter = new Map();

// Create HTTP server for health checks and static file serving
const server = http.createServer((req, res) => {
    // Enable CORS
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const pathname = req.url;
    
    // Health check endpoint
    if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: require('./package.json').version
        }));
        return;
    }
    
    // Stats endpoint
    if (pathname === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            activeConnections: wss.clients.size,
            totalRooms: rooms.size,
            memoryUsage: process.memoryUsage(),
            environment: ENV,
            uptime: process.uptime()
        }));
        return;
    }
    
    // Serve static files for development
    if (ENV === 'development') {
        let filePath = path.join(__dirname, pathname === '/' ? 'main.html' : pathname);
        
        // Security check - prevent directory traversal
        if (!filePath.startsWith(__dirname)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            
            // Set content type based on file extension
            const ext = path.extname(filePath);
            const mimeTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml'
            };
            
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
            res.end(data);
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ 
    server,
    verifyClient: (info) => {
        const origin = info.origin;
        if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
            return true;
        }
        console.log(`❌ Rejected connection from unauthorized origin: ${origin}`);
        return false;
    }
});

// Rate limiting function
function isRateLimited(ip) {
    const now = Date.now();
    const clientData = rateLimiter.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    
    if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
    }
    
    clientData.count++;
    rateLimiter.set(ip, clientData);
    
    return clientData.count > RATE_LIMIT_REQUESTS;
}

console.log(`🚀 NekoLive WebRTC Signaling Server starting...`);
console.log(`📍 Environment: ${ENV}`);
console.log(`🔒 CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
console.log(`⚡ Rate limit: ${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS}ms`);

wss.on('connection', (ws, request) => {
    const clientIP = request.socket.remoteAddress || request.headers['x-forwarded-for'] || 'unknown';
    
    // Rate limiting check
    if (isRateLimited(clientIP)) {
        console.log(`🚫 Rate limited connection from ${clientIP}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
    }
    
    // Generate unique session ID
    ws.sessionId = generateSessionId();
    ws.userId = generateSessionId();
    ws.isAlive = true;
    
    // Store session
    userSessions.set(ws.sessionId, {
        connectionTime: Date.now(),
        ip: clientIP,
        userAgent: request.headers['user-agent'] || 'unknown'
    });
    
    console.log(`🔗 [${ws.sessionId}] New client connected from: ${clientIP}`);
    
    // Heartbeat
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, roomName } = data;
            
            console.log(`📨 [${ws.sessionId}] Received message: ${type} for room: ${roomName}`);
            
            // Input validation
            if (!type || typeof type !== 'string') {
                console.log(`❌ [${ws.sessionId}] Invalid message type`);
                return;
            }
            
            switch (type) {
                case 'join-room':
                    if (!roomName || typeof roomName !== 'string' || roomName.length > 50) {
                        console.log(`❌ [${ws.sessionId}] Invalid room name`);
                        return;
                    }
                    
                    if (!rooms.has(roomName)) {
                        rooms.set(roomName, new Set());
                        console.log(`🏠 [${ws.sessionId}] Created new room: ${roomName}`);
                    }
                    
                    rooms.get(roomName).add(ws);
                    ws.roomName = roomName;
                    ws.userId = data.userId || ws.userId;
                    
                    console.log(`👤 [${ws.sessionId}] Joined room: ${roomName} (${rooms.get(roomName).size} participants)`);
                    
                    // Notify other users in room
                    const joinMessage = JSON.stringify({
                        type: 'user-joined',
                        userId: ws.userId,
                        userName: data.userName || 'User',
                        roomName: roomName,
                        timestamp: Date.now()
                    });
                    
                    rooms.get(roomName).forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            try {
                                client.send(joinMessage);
                            } catch (error) {
                                console.error(`❌ Error sending join message:`, error.message);
                            }
                        }
                    });
                    break;
                    
                default:
                    // Broadcast message to room members (except sender)
                    if (ws.roomName && rooms.has(ws.roomName)) {
                        const roomClients = rooms.get(ws.roomName);
                        let sentCount = 0;
                        
                        roomClients.forEach(client => {
                            if (client !== ws && client.readyState === WebSocket.OPEN) {
                                try {
                                    client.send(message);
                                    sentCount++;
                                } catch (error) {
                                    console.error(`❌ Error broadcasting message:`, error.message);
                                }
                            }
                        });
                        
                        console.log(`📤 [${ws.sessionId}] Broadcasted ${type} to ${sentCount} clients in room ${ws.roomName}`);
                    } else {
                        console.log(`⚠️ [${ws.sessionId}] Cannot broadcast - not in a room`);
                    }
                    break;
            }
        } catch (error) {
            console.error(`❌ [${ws.sessionId}] Error processing message:`, error.message);
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 [${ws.sessionId}] Client disconnected`);
        
        // Remove from room
        if (ws.roomName && rooms.has(ws.roomName)) {
            const room = rooms.get(ws.roomName);
            room.delete(ws);
            
            // Notify other clients in room about disconnection
            if (room.size > 0) {
                const leaveMessage = JSON.stringify({
                    type: 'user-left',
                    userId: ws.userId,
                    userName: 'User',
                    roomName: ws.roomName,
                    timestamp: Date.now()
                });
                
                room.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        try {
                            client.send(leaveMessage);
                        } catch (error) {
                            console.error(`❌ Error notifying client of user leave:`, error.message);
                        }
                    }
                });
            }
            
            // Clean up empty rooms
            if (room.size === 0) {
                rooms.delete(ws.roomName);
                console.log(`🗑️ Deleted empty room: ${ws.roomName}`);
            } else {
                console.log(`👋 [${ws.sessionId}] Left room: ${ws.roomName} (${room.size} participants remaining)`);
            }
        }
        
        // Clean up session
        userSessions.delete(ws.sessionId);
    });
    
    ws.on('error', (error) => {
        console.error(`❌ [${ws.sessionId}] WebSocket error:`, error.message);
    });
});

// Utility functions
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Heartbeat interval to detect dead connections
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
            console.log(`💀 Terminating dead connection: ${ws.sessionId}`);
            ws.terminate();
            return;
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000); // Check every 30 seconds

// Clean up inactive sessions
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    userSessions.forEach((session, sessionId) => {
        // This is a simplified cleanup - in production you'd track last activity per session
        // For now, we rely on WebSocket connection state
    });
    
    // Clean up rate limiter
    rateLimiter.forEach((data, ip) => {
        if (now > data.resetTime) {
            rateLimiter.delete(ip);
        }
    });
}, 60000); // Clean every minute

// Start server
server.listen(PORT, HOST, () => {
    console.log(`🌐 Server listening on ${HOST}:${PORT}`);
    if (ENV === 'development') {
        console.log(`🔧 Development mode - CORS enabled for all origins`);
    }
});

// Graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    console.log('\n🛑 Shutting down signaling server...');
    
    // Close all WebSocket connections
    wss.clients.forEach((ws) => {
        ws.close(1000, 'Server shutting down');
    });
    
    // Clear intervals
    clearInterval(heartbeatInterval);
    clearInterval(cleanupInterval);
    
    // Close server
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.log('⚠️ Forcing server shutdown...');
        process.exit(1);
    }, 10000);
}

module.exports = { server, wss };
