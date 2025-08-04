
// Pure WebRTC implementation without Agora
let localStream;
let remoteStream;
let peerConnection;
let socket;
let roomName;
let userName;

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
        
    } catch (error) {
        console.error('Error initializing WebRTC:', error);
        alert('Error accessing media devices. Please check permissions.');
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

// Toggle microphone
function toggleMicrophone() {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        document.getElementById('toggle-mic').style.backgroundColor = 
            audioTrack.enabled ? '#fff' : 'rgb(255, 80, 80)';
    }
}

// Toggle video
function toggleVideo() {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        document.getElementById('video-toggle').style.backgroundColor = 
            videoTrack.enabled ? '#fff' : 'rgb(255, 80, 80)';
    }
}

// Leave room
function leaveRoom() {
    if (peerConnection) {
        peerConnection.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Clean up session storage
    sessionStorage.clear();
    
    // Redirect to main page
    window.location.href = 'main.html';
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}