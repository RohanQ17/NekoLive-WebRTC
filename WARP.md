# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository overview
- Purpose: Pure WebRTC video chat with optional real-time chat via data channel. Signaling is handled by a Node.js WebSocket server; the UI is static (HTML/CSS/JS).
- Key pieces:
  - Client: main.html (landing/form), room.html (call UI), streams.js (WebRTC + signaling logic), styles/*.css, images/*
  - Server: signaling-server.js (HTTP + WebSocket), health/stats endpoints, in-memory rooms, rate limiting, CORS, graceful shutdown
  - Docker/Compose: Containerized server and optional Nginx reverse proxy with TLS and health checks

Common commands
- Prerequisites
  - Node.js ≥14 (README) — the Dockerfile uses node:18-alpine. Use Node 18 locally for parity if possible.
  - For local HTTPS/WSS, use the provided docker-compose.yml (with Nginx) or your own TLS termination.

- Install dependencies
  - npm install
  - Note: The code imports ws and dotenv in signaling-server.js. If they are not present in package.json, install them:
    - npm i ws dotenv

- Development server (no TLS)
  - PowerShell (Windows):
    - $env:NODE_ENV = "development"
    - node signaling-server.js
  - Bash/zsh:
    - NODE_ENV=development node signaling-server.js
  - Open http://localhost:8080/. getUserMedia is allowed on localhost over HTTP, but WebSocket in streams.js defaults to wss://…/api/ws.
    - For same-browser development without a signaling server, set useWebSocket = false in streams.js (fallback via localStorage), then open main.html directly.
    - For cross-device tests without TLS, set the client WebSocket URL to ws://localhost:8080 (streams.js), or run via Docker + Nginx (see below) to get HTTPS/WSS.

- Production server (no container)
  - PowerShell (Windows):
    - $env:NODE_ENV = "production"
    - node signaling-server.js
  - Bash/zsh:
    - NODE_ENV=production node signaling-server.js
  - Health check: curl http://localhost:8080/health

- Static build (stages client files to public/)
  - POSIX (as defined in package.json):
    - npm run build
  - Note: The build script uses rm, mkdir -p, cp; on Windows, run it from Git Bash/WSL or use PowerShell equivalents:
    - Remove-Item -Recurse -Force public; New-Item -ItemType Directory -Force public; Copy-Item main.html,room.html,streams.js -Destination public; Copy-Item styles,images -Destination public -Recurse

- Docker (single container)
  - Build: docker build -t nekolive:local .
  - Run: docker run --rm -p 8080:8080 --env-file .env nekolive:local
  - Health: curl http://localhost:8080/health

- Docker Compose (with Nginx TLS reverse proxy)
  - Prepare SSL certs referenced in nginx.conf (./ssl/cert.pem, ./ssl/key.pem) and update server_name and ALLOWED_ORIGINS.
  - Up server only: docker compose up --build -d nikolive-server
  - Up full stack (TLS, proxy, logs): docker compose up --build -d nginx
  - Logs: docker compose logs -f nikolive-server

- Lint and tests
  - Linting: not configured in this repository.
  - Tests: no test framework/config present. A “single test” run is not applicable.

High-level architecture and data flow
- Client (streams.js)
  - State: localStream, remoteStream, RTCPeerConnection, dataChannel, WebSocket (or localStorage fallback), roomName/userName from sessionStorage
  - Signaling URL: defaults to wss://${location.host}/api/ws meant for an edge/serverless deployment; for local Node signaling without TLS, use ws://localhost:8080 or run behind Nginx to terminate TLS.
  - TURN/STUN: Uses Google STUN and openrelay.metered.ca TURN; force TURN-only via ?forceTurn=1 or sessionStorage('forceTurn'='1').
  - Flow:
    1) getUserMedia with A/V constraints and robust fallbacks (audio-only on failure)
    2) Signaling: WebSocket if available, else localStorage (same-browser demo)
    3) RTCPeerConnection configured with iceServers and iceCandidatePool; ondatachannel/ontrack handlers
    4) Initiator selection when a peer joins (lower numeric uid or lexicographic fallback)
    5) Offer/answer exchange; ICE candidates broadcast via signaling
    6) Data channel carries chat messages; signaling used as fallback for chat
    7) Keyboard shortcuts: M (mic), V (video), C (chat), ESC (close chat)
    8) Leave flow cleans up media, peer connection, WS, and sessionStorage

- Signaling server (signaling-server.js)
  - HTTP endpoints: /health (status + uptime + version), /stats (activeConnections, totalRooms, memoryUsage, environment)
  - Dev static server: In NODE_ENV=development, serves main.html, room.html, streams.js, styles, images directly via the HTTP server.
  - WebSocket server: Verifies origin against ALLOWED_ORIGINS; broadcasts messages to room participants.
  - Message types: join-room (server assigns membership), user-joined/user-left notifications, offer/answer/ice-candidate pass-through, chat-message fallback delivery
  - Rooms: In-memory Map(roomName => Set<WebSocket>), with cleanup on disconnect; userSessions and a basic rateLimiter map; heartbeat pings and dead-connection termination
  - Graceful shutdown: Closes clients, clears intervals, stops server on SIGINT/SIGTERM

- Containerization and reverse proxy
  - Dockerfile: Multi-stage (builder installs deps via npm ci; production stage copies node_modules and app), runs as non-root (nodejs user) under dumb-init; ENTRYPOINT starts node signaling-server.js; healthcheck hits /health
  - docker-compose.yml: Services:
    - nikolive-server (Node signaling on 8080)
    - nginx (TLS, websockets, static file serving if you mount ./static to /usr/share/nginx/html)
    - redis (optional; not used by current code; placeholder for scaling/session persistence)
  - nginx.conf: Security headers, gzip, rate limiting zones, upstream to nikolive-server, HTTP→HTTPS redirect, websocket proxying with Upgrade headers, long timeouts, and static file caching

Environment and configuration
- .env.example documents the main settings. Important ones to set per environment:
  - ALLOWED_ORIGINS: Comma-separated list of origins allowed for CORS and WebSocket
  - PORT, HOST, NODE_ENV
  - RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS
  - SSL_CERT_PATH/SSL_KEY_PATH (if you terminate TLS at the app; with Nginx, configure certs there instead)
  - LOG_LEVEL/LOG_FILE_PATH; HEALTH_CHECK_ENABLED/PATH; METRICS_ENABLED/PATH

Notes and gotchas
- README mentions npm run dev and npm start, but package.json currently defines only build and vercel-build. Use node signaling-server.js for dev/prod runs unless you add scripts.
- For local cross-device testing, you need HTTPS/WSS. Use docker compose with nginx, or change the client WebSocket URL to ws://localhost:8080 for non-TLS local development.
- The build script uses POSIX utilities (rm, cp, mkdir -p). On Windows, run in Git Bash/WSL or use the provided PowerShell equivalents.
- Redis is defined in docker-compose.yml but is not used by the current server code; it’s a placeholder for future scaling (sessions/rooms persistence).

