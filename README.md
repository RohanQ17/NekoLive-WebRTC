# NekoLive - Pure WebRTC Video Chat

A lightweight video chatroom application built with vanilla HTML, CSS, and JavaScript using pure WebRTC technology.

## Features

- 🎥 Real-time video calling using pure WebRTC
- 🚀 No external dependencies or SDKs required
- 🎨 Clean, modern UI with custom styling
- 📱 Responsive design
- 🐱 Cat-themed branding
- 🎙️ Microphone and video toggle controls
- 🔄 localStorage-based signaling (works for same-origin tabs)

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **WebRTC**: Native browser WebRTC APIs for peer-to-peer communication
- **Signaling**: localStorage (demo) / WebSocket (production)
- **Fonts**: Google Fonts (Russo One, Roboto Mono, Honk)

## Project Structure

```
├── main.html              # Landing page with room join form
├── room.html              # Video chat room interface
├── streams.js             # Pure WebRTC logic
├── signaling-server.js    # Optional WebSocket signaling server
├── package.json           # Node.js dependencies for signaling server
├── styles/
│   ├── main.css          # Styles for landing page
│   └── room.css          # Styles for video chat room
└── images/
    ├── cat.gif           # Animated cat logo
    ├── leave.svg         # Leave room icon
    ├── microphone.svg    # Microphone toggle icon
    └── video.svg         # Video toggle icon
```

## Setup

### Basic Setup (localStorage signaling)
1. Clone this repository
2. Open `main.html` in a web browser
3. Enter a username and room name to start a video chat
4. Open another tab/window with the same room name to test

### Advanced Setup (WebSocket signaling)
1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Start the signaling server:
   ```bash
   npm start
   ```
3. Update `streams.js` to use WebSocket instead of localStorage
4. Open `main.html` in a web browser

## Usage

1. Open `main.html` in your browser
2. Enter your username and a room name
3. Click "Enter a Room" to join the video chat
4. Use the controls to toggle microphone, video, or leave the room
5. Share the room name with others to have them join

## Signaling Methods

### Current: localStorage (Demo)
- Works for multiple tabs/windows on the same origin
- Perfect for testing and development
- No server required

### Optional: WebSocket (Production)
- Enables connection between different devices/networks
- Requires running the included signaling server
- Better scalability for real-world use

## Controls

- 🎙️ **Microphone Toggle**: Enable/disable audio
- 📹 **Video Toggle**: Enable/disable video
- 🚪 **Leave Room**: Exit the video chat

## Browser Support

- Chrome 56+
- Firefox 52+
- Safari 11+
- Edge 79+

## Note

This is a pure WebRTC implementation without external SDKs. For an Agora SDK-based version, check out other branches.

## License

This project is open source and available under the [MIT License](LICENSE).
