// Simple HTTP-based signaling for Vercel Edge (WebSocket not supported)
const messages = new Map(); // roomName -> array of messages
const MESSAGE_LIMIT = 50; // Keep last 50 messages per room

export default async function handler(req) {
  const url = new URL(req.url);
  const roomName = url.searchParams.get('room') || 'default';
  const method = req.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (method === 'POST') {
    // Send message to room
    try {
      const data = await req.json();
      if (!messages.has(roomName)) {
        messages.set(roomName, []);
      }
      
      const roomMessages = messages.get(roomName);
      roomMessages.push({
        ...data,
        timestamp: Date.now(),
        id: Math.random().toString(36).slice(2)
      });
      
      // Keep only recent messages
      if (roomMessages.length > MESSAGE_LIMIT) {
        roomMessages.splice(0, roomMessages.length - MESSAGE_LIMIT);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'GET') {
    // Poll for messages
    const since = parseInt(url.searchParams.get('since')) || 0;
    const roomMessages = messages.get(roomName) || [];
    const newMessages = roomMessages.filter(msg => msg.timestamp > since);
    
    return new Response(JSON.stringify({ messages: newMessages }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { 
    status: 405, 
    headers: corsHeaders 
  });
}
