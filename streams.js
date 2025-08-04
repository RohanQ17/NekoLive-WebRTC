
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

// Generate unique user ID
let uid = String(Math.floor(Math.random() * 10000));

// WebRTC configuration with STUN servers
const rtcConfiguration = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

// Initialize WebRTC connection
let init = async () => {
    try {
        // Get room and user info from session storage
        roomName = sessionStorage.getItem('room') || 'default';
        userName = sessionStorage.getItem('name') || 'Anonymous';
        
        console.log(`Initializing WebRTC for user: ${userName} in room: ${roomName}`);
        
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('user-1').srcObject = localStream;
        
        // Initialize signaling (using localStorage for demo - replace with WebSocket in production)
        initializeSignaling();
        
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

// Initialize signaling mechanism (simplified localStorage approach)
function initializeSignaling() {
    // Listen for storage events (messages from other tabs/windows)
    window.addEventListener('storage', handleSignalingMessage);
    
    // Announce presence in room
    sendSignalingMessage({
        type: 'user-joined',
        userId: uid,
        userName: userName,
        roomName: roomName
    });
}

// Handle incoming signaling messages
function handleSignalingMessage(event) {
    if (event.key !== `webrtc-${roomName}`) return;
    
    const message = JSON.parse(event.newValue);
    
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

// Send signaling message
function sendSignalingMessage(message) {
    message.timestamp = Date.now();
    localStorage.setItem(`webrtc-${roomName}`, JSON.stringify(message));
}

// Handle when a user joins
async function handleUserJoined(message) {
    console.log('User joined:', message.userName);
    
    // Create offer if we're the initiator (lower user ID)
    if (uid < message.userId) {
        await createOffer();
    }
}

// Create peer connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfiguration);
    
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
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage({
                type: 'ice-candidate',
                candidate: event.candidate,
                userId: uid,
                roomName: roomName
            });
        }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        const state = peerConnection.connectionState;
        
        if (state === 'connected') {
            showNotification('Connected to peer!', 'success');
        } else if (state === 'disconnected' || state === 'failed') {
            showNotification('Connection lost. Trying to reconnect...', 'error');
        }
    };
}

// Create and send offer
async function createOffer() {
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
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
        await peerConnection.setRemoteDescription(message.offer);
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        sendSignalingMessage({
            type: 'answer',
            answer: answer,
            userId: uid,
            roomName: roomName
        });
        
        console.log('Answer created and sent');
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle incoming answer
async function handleAnswer(message) {
    try {
        await peerConnection.setRemoteDescription(message.answer);
        console.log('Answer received and set');
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

// Handle incoming ICE candidate
async function handleIceCandidate(message) {
    try {
        await peerConnection.addIceCandidate(message.candidate);
        console.log('ICE candidate added');
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