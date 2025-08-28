
// Pure WebRTC implementation with chat and enhanced controls
let localStream;
let remoteStream;
let peerConnection;
let dataChannel;
let socket;
let roomName;
let userName;
let isMuted = false;
let isVideoOff = false;
let isChatOpen = false;
let useWebSocket = !USE_HTTP_POLLING; // Set to false to use localStorage or HTTP polling

// Generate unique user ID
let uid = String(Math.floor(Math.random() * 10000));

// WebSocket server configuration
// For Vercel deployment, use HTTP polling instead of WebSockets
const USE_HTTP_POLLING = true;
const POLLING_URL = (typeof location !== 'undefined')
    ? `https://${location.host}/api/ws`
    : 'https://your-vercel-domain.vercel.app/api/ws';
const WEBSOCKET_URL = (typeof location !== 'undefined')
    ? `wss://${location.host}/api/ws`
    : 'wss://your-vercel-domain.vercel.app/api/ws';
// If hosting signaling on EC2 instead, set:
// const WEBSOCKET_URL = 'wss://signal.yourdomain.com/ws';

// Allow forcing TURN-only via query (?forceTurn=1) or sessionStorage('forceTurn'='1')
const FORCE_TURN = /[?&]forceTurn=1/i.test(window.location.search) || sessionStorage.getItem('forceTurn') === '1';

// WebRTC configuration with STUN and TURN servers
const rtcConfiguration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        // NOTE: Add your own TURN service here for production reliability
    ],
    iceCandidatePoolSize: 10,
    ...(FORCE_TURN ? { iceTransportPolicy: 'relay' } : {})
};

// Initialize WebRTC connection
let init = async () => {
    try {
        // Get room and user info from session storage
        roomName = sessionStorage.getItem('room') || 'default';
        userName = sessionStorage.getItem('name') || 'Anonymous';
        
        console.log(`Initializing WebRTC for user: ${userName} in room: ${roomName}`);
        
        // Get user media with enhanced error handling
        try {
            console.log('Requesting camera and microphone access...');
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }, 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            console.log('✅ Media access granted');
            document.getElementById('user-1').srcObject = localStream;
        } catch (mediaError) {
            console.error('❌ Media access failed:', mediaError);
            showNotification(`Camera/Microphone access denied: ${mediaError.message}`, 'error');
            
            // Try audio-only fallback
            try {
                console.log('Trying audio-only fallback...');
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                document.getElementById('user-1').srcObject = localStream;
                showNotification('Using audio-only mode', 'warning');
            } catch (audioError) {
                console.error('❌ Audio access also failed:', audioError);
                showNotification('No media access available', 'error');
                return;
            }
        }
        
        // Initialize signaling
        if (useWebSocket) {
            await initializeWebSocketSignaling();
        } else if (USE_HTTP_POLLING) {
            await initializeHttpPollingSignaling();
        } else {
            initializeLocalStorageSignaling();
        }
        
        // Create peer connection
        createPeerConnection();
        
        // Initialize chat
        initializeChat();
        
        // Initialize keyboard shortcuts
        initializeKeyboardShortcuts();
        
        // Show connection notification
        showNotification(`Connected as ${userName} in room ${roomName}`, 'success');
        
    } catch (error) {
        console.error('Error initializing WebRTC:', error);
        showNotification('Error accessing media devices. Please check permissions.', 'error');
    }
};

// Initialize WebSocket signaling
async function initializeWebSocketSignaling() {
    try {
        socket = new WebSocket(WEBSOCKET_URL);
        
        // Ensure we receive text data, not binary (default is usually text anyway)
        // socket.binaryType = 'arraybuffer';
        
        socket.onopen = () => {
            console.log('WebSocket connected to:', WEBSOCKET_URL);
            console.log('User ID:', uid, 'User Name:', userName, 'Room:', roomName);
            
            // Join room
            sendWebSocketMessage({
                type: 'join-room',
                roomName: roomName
            });
            
            // Announce presence
            sendWebSocketMessage({
                type: 'user-joined',
                userId: uid,
                userName: userName,
                roomName: roomName
            });
            
            showNotification('Connected to signaling server', 'success');
            console.log('Sent join-room and user-joined messages');
        };
        
        socket.onmessage = (event) => {
            console.log('Received WebSocket message:', event.data);
            
            let message;
            try {
                // Handle different data types
                if (event.data instanceof Blob) {
                    console.log('Received Blob data, converting to text...');
                    event.data.text().then(text => {
                        try {
                            message = JSON.parse(text);
                            console.log('Parsed message from Blob:', message);
                            handleSignalingMessage(message);
                        } catch (parseError) {
                            console.error('Error parsing Blob text as JSON:', parseError);
                        }
                    });
                    return;
                } else if (typeof event.data === 'string') {
                    message = JSON.parse(event.data);
                } else {
                    console.error('Unexpected data type:', typeof event.data, event.data);
                    return;
                }
                
                console.log('Parsed message:', message);
                handleSignalingMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                console.error('Raw data:', event.data);
            }
        };
        
        socket.onclose = () => {
            console.log('WebSocket disconnected');
            showNotification('Disconnected from signaling server. Retrying...', 'error');
            // Retry connection after 3 seconds
            setTimeout(() => {
                if (!socket || socket.readyState === WebSocket.CLOSED) {
                    initializeWebSocketSignaling();
                }
            }, 3000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            showNotification('Signaling server connection failed. Switching to HTTP polling...', 'error');
            useWebSocket = false;
            if (USE_HTTP_POLLING) {
                initializeHttpPollingSignaling();
            } else {
                initializeLocalStorageSignaling();
            }
        };
        
    } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        showNotification('WebSocket unavailable. Using HTTP polling...', 'error');
        useWebSocket = false;
        if (USE_HTTP_POLLING) {
            initializeHttpPollingSignaling();
        } else {
            initializeLocalStorageSignaling();
        }
    }
}

// Initialize localStorage signaling (fallback)
function initializeLocalStorageSignaling() {
    // Listen for storage events (messages from other tabs/windows)
    window.addEventListener('storage', (event) => {
        if (event.key !== `webrtc-${roomName}`) return;
        
        const message = JSON.parse(event.newValue);
        // Ignore messages from self
        if (message.userId === uid) return;
        
        handleSignalingMessage(message);
    });
    
    // Announce presence in room
    sendLocalStorageMessage({
        type: 'user-joined',
        userId: uid,
        userName: userName,
        roomName: roomName
    });
    
    showNotification('Using localStorage signaling (same browser only)', 'info');
}

// Initialize HTTP polling signaling (for Vercel Edge)
let lastMessageTime = 0;
let pollingInterval;

async function initializeHttpPollingSignaling() {
    console.log('Using HTTP polling signaling');
    
    // Start polling for messages
    pollingInterval = setInterval(pollForMessages, 1000); // Poll every second
    
    // Announce presence
    await sendHttpMessage({
        type: 'user-joined',
        userId: uid,
        userName: userName,
        roomName: roomName
    });
    
    showNotification('Connected via HTTP polling', 'success');
}

async function pollForMessages() {
    try {
        const response = await fetch(`${POLLING_URL}?room=${encodeURIComponent(roomName)}&since=${lastMessageTime}`);
        if (!response.ok) return;
        
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
            for (const message of data.messages) {
                lastMessageTime = Math.max(lastMessageTime, message.timestamp);
                handleSignalingMessage(message);
            }
        }
    } catch (error) {
        console.error('Polling error:', error);
    }
}

async function sendHttpMessage(message) {
    try {
        const response = await fetch(`${POLLING_URL}?room=${encodeURIComponent(roomName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
        console.log('Sent HTTP message:', message);
        return response.ok;
    } catch (error) {
        console.error('Error sending HTTP message:', error);
        return false;
    }
}

// Send WebSocket message
function sendWebSocketMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        message.timestamp = Date.now();
        console.log('Sending WebSocket message:', message);
        socket.send(JSON.stringify(message));
    } else {
        console.error('Cannot send message - WebSocket not connected. State:', socket ? socket.readyState : 'socket is null');
    }
}

// Send localStorage message
function sendLocalStorageMessage(message) {
    message.timestamp = Date.now();
    localStorage.setItem(`webrtc-${roomName}`, JSON.stringify(message));
}

// Handle incoming signaling messages
function handleSignalingMessage(message) {
    // For localStorage, we need to check the event structure
    if (message.key && message.newValue) {
        if (message.key !== `webrtc-${roomName}`) return;
        message = JSON.parse(message.newValue);
    }
    
    // Ignore messages from self
    if (message.userId === uid) return;
    
    console.log('Received signaling message:', message);
    
    switch (message.type) {
        case 'user-joined':
            handleUserJoined(message);
            break;
        case 'offer':
            handleOffer(message);
            break;
        case 'answer':
            handleAnswer(message);
            break;
        case 'ice-candidate':
            handleIceCandidate(message);
            break;
        case 'chat-message':
            handleChatMessage(message);
            break;
        case 'user-left':
            handleUserLeft(message);
            break;
    }
}

// Send signaling message (unified function)
function sendSignalingMessage(message) {
    if (useWebSocket) {
        sendWebSocketMessage(message);
    } else if (USE_HTTP_POLLING) {
        sendHttpMessage(message);
    } else {
        sendLocalStorageMessage(message);
    }
}

// Handle when a user joins
async function handleUserJoined(message) {
    console.log('User joined:', message.userName, 'User ID:', message.userId, 'My ID:', uid);
    
    displayChatMessage({
        type: 'system',
        content: `${message.userName} joined the room`,
        timestamp: new Date().toLocaleTimeString()
    }, false);
    
    showNotification(`${message.userName} joined the room`, 'success');
    
    // Ensure both user IDs are numbers for comparison
    let myIdNum = Number(uid);
    let otherIdNum = Number(message.userId);
    let isNumeric = !isNaN(myIdNum) && !isNaN(otherIdNum);
    let iAmInitiator = false;
    if (isNumeric) {
        iAmInitiator = myIdNum < otherIdNum;
    } else {
        // Fallback to string comparison if IDs are not numbers
        iAmInitiator = String(uid) < String(message.userId);
    }
    if (iAmInitiator) {
        console.log('I am the initiator - creating offer in 1 second...');
        setTimeout(() => {
            createOffer();
        }, 1000); // Small delay to ensure peer connection is ready
    } else {
        console.log('I am not the initiator - waiting for offer...');
    }
}

// Create peer connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfiguration);
    let attemptedIceRestart = false;
    
    // Create data channel for chat
    dataChannel = peerConnection.createDataChannel('chat', {
        ordered: true
    });
    
    // Handle data channel events
    dataChannel.onopen = () => {
        console.log('Data channel opened');
    };
    
    dataChannel.onmessage = (event) => {
        const message = JSON.parse(event.data);
        displayChatMessage(message, false);
    };
    
    // Handle incoming data channel
    peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        channel.onmessage = (event) => {
            const message = JSON.parse(event.data);
            displayChatMessage(message, false);
        };
    };
    
    // Set up remote stream
    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    
    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
        console.log('ontrack event:', event);
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
            console.log('Added remote track:', track);
        });
        document.getElementById('user-2').srcObject = remoteStream;
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate:', event.candidate);
            sendSignalingMessage({
                type: 'ice-candidate',
                candidate: event.candidate,
                userId: uid,
                roomName: roomName
            });
        } else {
            console.log('All ICE candidates have been sent');
        }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = async () => {
        const state = peerConnection.iceConnectionState;
        console.log('ICE connection state:', state);
        // Try a one-time ICE restart if we fail/disconnect
        if ((state === 'failed' || state === 'disconnected') && !attemptedIceRestart) {
            attemptedIceRestart = true;
            console.warn('Attempting ICE restart...');
            try {
                const offer = await peerConnection.createOffer({ iceRestart: true });
                await peerConnection.setLocalDescription(offer);
                sendSignalingMessage({
                    type: 'offer',
                    offer,
                    userId: uid,
                    roomName
                });
                console.log('ICE restart offer sent');
            } catch (e) {
                console.error('ICE restart failed:', e);
            }
        }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('Connection state:', state);
        if (state === 'connected') {
            showNotification('Connected to peer!', 'success');
        } else if (state === 'disconnected') {
            showNotification('Connection lost. Trying to reconnect...', 'error');
        } else if (state === 'failed') {
            showNotification('Connection failed. If this persists, enable TURN-only with ?forceTurn=1', 'error');
        }
    };
}

// Create and send offer
async function createOffer() {
    try {
        console.log('Creating offer...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('Offer created and set as local description:', offer);
        
        sendSignalingMessage({
            type: 'offer',
            offer: offer,
            userId: uid,
            roomName: roomName
        });
        
        console.log('Offer created and sent');
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

// Handle incoming offer
async function handleOffer(message) {
    try {
        console.log('Received offer from:', message.userId);
        console.log('Current signaling state:', peerConnection.signalingState);
        
        // Only handle offer if we're in stable state or haven't set remote description
        if (peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(message.offer);
            console.log('Remote description set');
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log('Answer created and set as local description');
            
            sendSignalingMessage({
                type: 'answer',
                answer: answer,
                userId: uid,
                roomName: roomName
            });
            
            console.log('Answer created and sent');
        } else {
            console.warn('Ignoring offer - wrong signaling state:', peerConnection.signalingState);
        }
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle incoming answer
async function handleAnswer(message) {
    try {
        console.log('Received answer from:', message.userId);
        console.log('Current signaling state:', peerConnection.signalingState);
        
        // Only set remote description if we're in the right state
        if (peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(message.answer);
            console.log('Answer received and set');
        } else {
            console.warn('Ignoring answer - wrong signaling state:', peerConnection.signalingState);
        }
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

// Handle incoming ICE candidate
async function handleIceCandidate(message) {
    try {
        console.log('Received ICE candidate from:', message.userId);
        await peerConnection.addIceCandidate(message.candidate);
        console.log('ICE candidate added successfully');
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
}

// Enhanced toggle microphone with visual feedback
function toggleMicrophone() {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isMuted = !audioTrack.enabled;
        
        const micWrapper = document.getElementById('mic-wrapper');
        const micLabel = document.getElementById('mic-label');
        
        if (isMuted) {
            micWrapper.classList.add('muted');
            micLabel.textContent = 'Mic Off';
            showNotification('Microphone muted', 'info');
        } else {
            micWrapper.classList.remove('muted');
            micLabel.textContent = 'Mic On';
            showNotification('Microphone unmuted', 'info');
        }
    }
}

// Enhanced toggle video with visual feedback
function toggleVideo() {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isVideoOff = !videoTrack.enabled;
        
        const videoWrapper = document.getElementById('video-wrapper');
        const videoLabel = document.getElementById('video-label');
        
        if (isVideoOff) {
            videoWrapper.classList.add('video-off');
            videoLabel.textContent = 'Video Off';
            showNotification('Video disabled', 'info');
        } else {
            videoWrapper.classList.remove('video-off');
            videoLabel.textContent = 'Video On';
            showNotification('Video enabled', 'info');
        }
    }
}

// Toggle chat visibility
function toggleChat() {
    const chatContainer = document.getElementById('chat-container');
    isChatOpen = !isChatOpen;
    
    if (isChatOpen) {
        chatContainer.classList.add('show');
        // Auto-scroll to bottom
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        chatContainer.classList.remove('show');
    }
}

// Initialize chat functionality
function initializeChat() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-message-btn');
    
    // Send message on button click
    sendButton.addEventListener('click', sendChatMessage);
    
    // Send message on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    // Add system message
    displayChatMessage({
        type: 'system',
        content: 'Chat connected. Start messaging!',
        timestamp: new Date().toLocaleTimeString()
    }, false);
}

// Send chat message
function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (message === '') return;
    
    const chatMessage = {
        type: 'user',
        username: userName,
        content: message,
        timestamp: new Date().toLocaleTimeString(),
        userId: uid
    };
    
    // Display message locally
    displayChatMessage(chatMessage, true);
    
    // Send via data channel if available
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(chatMessage));
    } else {
        // Fallback to signaling
        sendSignalingMessage({
            type: 'chat-message',
            message: chatMessage,
            userId: uid,
            roomName: roomName
        });
    }
    
    // Clear input
    chatInput.value = '';
}

// Handle incoming chat message from signaling
function handleChatMessage(signalMessage) {
    displayChatMessage(signalMessage.message, false);
}

// Display chat message in UI
function displayChatMessage(message, isOwn) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOwn ? 'own' : message.type === 'system' ? 'system' : 'other'}`;
    
    if (message.type === 'system') {
        messageElement.innerHTML = `
            <div class="content">${message.content}</div>
            <div class="timestamp">${message.timestamp}</div>
        `;
        messageElement.style.backgroundColor = '#17a2b8';
        messageElement.style.color = 'white';
        messageElement.style.textAlign = 'center';
        messageElement.style.margin = '10px 0';
    } else {
        messageElement.innerHTML = `
            <div class="username">${message.username}</div>
            <div class="content">${message.content}</div>
            <div class="timestamp">${message.timestamp}</div>
        `;
    }
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle user leaving
function handleUserLeft(message) {
    displayChatMessage({
        type: 'system',
        content: `${message.userName} left the room`,
        timestamp: new Date().toLocaleTimeString()
    }, false);
    
    showNotification(`${message.userName} left the room`, 'info');
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Enhanced leave room function
function leaveRoom() {
    // Notify other users
    sendSignalingMessage({
        type: 'user-left',
        userId: uid,
        userName: userName,
        roomName: roomName
    });
    
    // Close connections
    if (dataChannel) {
        dataChannel.close();
    }
    if (peerConnection) {
        peerConnection.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (socket) {
        socket.close();
    }
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    // Clean up session storage
    sessionStorage.clear();
    
    // Show leaving message
    showNotification('Leaving room...', 'info');
    
    // Redirect after a short delay
    setTimeout(() => {
        window.location.href = 'main.html';
    }, 1000);
}

// Initialize keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in chat
        if (document.activeElement === document.getElementById('chat-input')) {
            return;
        }
        
        // Check for keyboard shortcuts
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            toggleMicrophone();
        } else if (e.key === 'v' || e.key === 'V') {
            e.preventDefault();
            toggleVideo();
        } else if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            toggleChat();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (isChatOpen) {
                toggleChat();
            }
        }
    });
    
    // Show keyboard shortcuts notification
    setTimeout(() => {
        showNotification('Shortcuts: M (mic), V (video), C (chat), ESC (close chat)', 'info');
    }, 2000);
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}