# NekoLive - WebRTC Video Chat (Client-Side)

A simple, lightweight video chatroom application built with vanilla HTML, CSS, and JavaScript using WebRTC and Agora SDK.

## Features

- 🎥 Real-time video calling
- 🚀 No server required - client-side only
- 🎨 Clean, modern UI with custom styling
- 📱 Responsive design
- 🐱 Cat-themed branding

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **WebRTC**: For peer-to-peer communication
- **Agora SDK**: For signaling and room management
- **Fonts**: Google Fonts (Russo One, Roboto Mono, Honk)

## Project Structure

```
├── main.html          # Landing page with room join form
├── room.html          # Video chat room interface
├── streams.js         # WebRTC and Agora SDK logic
├── agora-rtm-sdk-1.5.1.js  # Agora Real-Time Messaging SDK
├── styles/
│   ├── main.css       # Styles for landing page
│   └── room.css       # Styles for video chat room
└── images/
    ├── cat.gif        # Animated cat logo
    ├── leave.svg      # Leave room icon
    ├── microphone.svg # Microphone toggle icon
    └── video.svg      # Video toggle icon
```

## Setup

1. Clone this repository
2. Add your Agora App ID and Certificate in `streams.js`:
   ```javascript
   const appId = 'your_agora_app_id'
   const appCertificate = 'your_agora_app_certificate'
   ```
3. Open `main.html` in a web browser
4. Enter a username and room name to start a video chat

## Usage

1. Open `main.html` in your browser
2. Enter your username and a room name
3. Click "Enter a Room" to join the video chat
4. Share the room name with others to have them join

## Note

This is a client-side only version of NekoLive. For a full-featured Django web application version, check out the main NekoLive repository.

## License

This project is open source and available under the [MIT License](LICENSE).
