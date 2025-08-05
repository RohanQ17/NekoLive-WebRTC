# NekoLive - Pure WebRTC Video Chat Application

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://your-domain.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-14%2B-green)](https://nodejs.org)

A production-ready WebRTC video chat application with real-time messaging, built with vanilla JavaScript and Node.js.

## 🌟 Features

- **Pure WebRTC**: No external SDK dependencies
- **Real-time Video Chat**: High-quality peer-to-peer video communication
- **Live Messaging**: Built-in chat using WebRTC data channels
- **Cross-browser Support**: Works on Chrome, Firefox, Safari, and Edge
- **Responsive Design**: Mobile-friendly glassmorphism UI
- **Production Ready**: Rate limiting, CORS, health checks, and monitoring
- **Easy Deployment**: AWS-ready with comprehensive deployment guide

## � Quick Start

### Prerequisites

- Node.js 14+ and npm
- Modern web browser with WebRTC support
- HTTPS (required for WebRTC in production)

### Local Development

1. **Clone and Setup**
   ```bash
   git clone <your-repo-url>
   cd NekoLive
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open Application**
   - Visit `https://localhost:8080` (note: HTTPS required for WebRTC)
   - Enter a username and room name
   - Share the room URL with others to join

### Production Deployment

#### Option 1: Traditional Server (AWS EC2)

1. **Prepare Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

2. **Install Dependencies**
   ```bash
   npm ci --only=production
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

#### Option 2: AWS Lambda + S3 (Serverless)

See [AWS Deployment Guide](#aws-deployment-guide) below for detailed instructions.

## 📁 Project Structure

```
NekoLive/
├── main.html              # Landing page
├── room.html              # Video chat interface
├── streams.js             # Core WebRTC logic
├── signaling-server.js    # WebSocket signaling server
├── package.json           # Dependencies and scripts
├── .env.example           # Environment configuration template
├── styles/
│   ├── main.css          # Landing page styles
│   └── room.css          # Video chat styles
├── images/               # UI icons and assets
├── scripts/              # Deployment scripts
└── docs/                # Documentation
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | Yes |
| `PORT` | Server port | `8080` | Yes |
| `ALLOWED_ORIGINS` | CORS origins | `*` | Yes |
| `RATE_LIMIT_REQUESTS` | Requests per window | `100` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` | No |

### Server Configuration

The signaling server supports:
- **Rate Limiting**: Prevents abuse (100 requests/minute by default)
- **CORS**: Configurable cross-origin resource sharing
- **Health Checks**: `/health` and `/stats` endpoints
- **Graceful Shutdown**: Proper cleanup on termination
- **Session Management**: Automatic cleanup of dead connections
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
