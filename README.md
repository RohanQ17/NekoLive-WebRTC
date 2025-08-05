# NekoLive - Pure WebRTC Video Chat with Streaming Features

A comprehensive video chatroom application built with vanilla HTML, CSS, and JavaScript using pure WebRTC technology with advanced streaming features.

## ✨ Features

- 🎥 **Real-time video calling** using pure WebRTC
- 🚀 **No external dependencies** or SDKs required
- 💬 **Integrated chat system** with real-time messaging
- �️ **Advanced audio controls** with mute/unmute functionality
- 📹 **Video toggle controls** with visual feedback
- ⌨️ **Keyboard shortcuts** for quick access
- 🎨 **Modern UI** with glassmorphism design
- 📱 **Fully responsive** design for all devices
- � **Smart notifications** for user actions
- �🐱 **Cat-themed branding** with custom styling
- 🔄 **localStorage-based signaling** (works for same-origin tabs)
- 📊 **Connection state monitoring** with automatic reconnection

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **WebRTC**: Native browser WebRTC APIs for peer-to-peer communication
- **Data Channels**: For real-time chat messaging
- **Signaling**: localStorage (demo) / WebSocket (production)
- **Fonts**: Google Fonts (Russo One, Roboto Mono, Honk)

## 📁 Project Structure

```
├── main.html              # Landing page with room join form
├── room.html              # Video chat room interface with streaming features
├── streams.js             # Enhanced WebRTC logic with chat and controls
├── signaling-server.js    # Optional WebSocket signaling server
├── package.json           # Node.js dependencies for signaling server
├── styles/
│   ├── main.css          # Styles for landing page
│   └── room.css          # Enhanced styles with chat and controls
└── images/
    ├── cat.gif           # Animated cat logo
    ├── chat.svg          # Chat icon
    ├── leave.svg         # Leave room icon
    ├── microphone.svg    # Microphone toggle icon
    └── video.svg         # Video toggle icon
```

## 🚀 Setup

### Quick Start (WebSocket signaling - Recommended)
1. **Install Node.js** (if not already installed)
2. **Run setup**: Double-click `setup.bat` or run `npm install`
3. **Start signaling server**: Double-click `start-server.bat` or run `npm start`
4. **Open the app**: Open `main.html` in your browser
5. **Test**: Open another browser/device and connect to the same room

### Alternative Setup (localStorage signaling - Same browser only)
1. Open `streams.js` and change `let useWebSocket = false;`
2. Open `main.html` in a web browser
3. Open another tab/window with the same room name to test

### Manual Setup (Advanced)
1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Start the signaling server:
   ```bash
   npm start
   # or
   node signaling-server.js
   ```
3. Open `main.html` in a web browser

## 🎮 Usage

### Starting a Video Chat
1. Open `main.html` in your browser
2. Enter your username and a room name
3. Click "Enter a Room" to join the video chat
4. Share the room name with others to have them join

### Streaming Controls
- 🎙️ **Microphone**: Click the mic icon or press `M` to toggle audio
- 📹 **Video**: Click the video icon or press `V` to toggle video
- 💬 **Chat**: Click the chat icon or press `C` to open/close chat
- 🚪 **Leave**: Click the leave button to exit the room

### Chat Features
- **Real-time messaging** between connected users
- **System notifications** for user join/leave events
- **Timestamp display** for all messages
- **Auto-scroll** to latest messages
- **Enter key** to send messages quickly

### Keyboard Shortcuts
- `M` - Toggle microphone on/off
- `V` - Toggle video on/off  
- `C` - Toggle chat window
- `ESC` - Close chat window
- `Enter` - Send chat message (when in chat input)

## 📱 Responsive Design

The application automatically adapts to different screen sizes:
- **Desktop**: Side-by-side video layout with floating chat
- **Tablet**: Optimized controls and chat positioning
- **Mobile**: Stacked video layout with full-width chat

## 🔧 Signaling Methods

### Current: WebSocket (Production Ready) ⭐
- ✅ Enables connection between different browsers/devices/networks
- ✅ Real-time synchronization across all platforms
- ✅ Includes automatic reconnection and error handling
- ✅ Supports multiple rooms simultaneously
- ⚙️ Requires running the included signaling server

### Fallback: localStorage (Demo)
- ✅ Works for multiple tabs/windows on the same origin
- ✅ Perfect for testing and development
- ✅ No server required
- ❌ Limited to same browser/device only

## 🎨 UI Features

### Modern Design Elements
- **Glassmorphism effects** with backdrop blur
- **Smooth animations** and transitions
- **Visual feedback** for all user interactions
- **Status indicators** for mic/video state
- **Smart notifications** with auto-dismiss
- **Floating control panel** with rounded design

### Chat Interface
- **Bubble-style messages** with user identification
- **Different styling** for own vs. other messages
- **System message support** for notifications
- **Scrollable history** with auto-scroll
- **Typing area** with send button

## 🌐 Browser Support

- Chrome 56+
- Firefox 52+
- Safari 11+
- Edge 79+

## 🔒 Privacy & Security

- **No data collection** - everything runs locally
- **Peer-to-peer connections** - no data passes through servers
- **Temporary storage** - session data cleared on exit
- **Media permissions** - user controls camera/mic access

## 🚧 Development Roadmap

- [ ] Screen sharing capabilities
- [ ] File transfer support  
- [ ] User presence indicators
- [ ] Room persistence
- [ ] Audio-only mode
- [ ] Connection quality indicators

## 📝 Note

This is a pure WebRTC implementation with comprehensive streaming features. The current branch includes advanced chat functionality, enhanced controls, and a modern UI. For simpler implementations, check out other branches.

## License

This project is open source and available under the [MIT License](LICENSE).
