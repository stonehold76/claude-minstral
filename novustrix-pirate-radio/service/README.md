# Novustrix Pirate Radio Service

A broadcast service that receives audio from Matrix widgets via WebSocket and streams it to an Icecast server for internet radio broadcasting.

## Architecture

```
Matrix Room (Element Web)
    ↓ (Matrix Widget API)
Matrix Widget (Browser)
    ↓ (WebSocket /ws)
Broadcast Service (Node.js) --/WebSocket--> Matrix Widget
    ↓ (stdin pipe)
FFmpeg (Audio Encoding)
    ↓ (Icecast Source Protocol)
Icecast Server
    ↓ (HTTP Streaming)
Radio Listeners
```

## Quick Start

### 1. Install Dependencies

```bash
cd /opt/claude-minstral/novustrix-pirate-radio/service
npm install
```

### 2. Configure Environment

Copy the example environment file and edit:

```bash
cp .env.example .env
nano .env
```

Set at minimum:
- `ICECAST_HOST` - Icecast server hostname
- `ICECAST_PASSWORD` - Icecast source password
- `CORS_ORIGINS` - Allowed widget origins

### 3. Install FFmpeg

FFmpeg is required for audio encoding:

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Alpine Linux:**
```bash
apk add ffmpeg libshout
```

### 4. Run the Service

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The service will start on port 8082 by default.

## Docker Deployment

### Build and Run

```bash
# Build the image
docker-compose build

# Start all services (includes Icecast)
docker-compose up -d

# View logs
docker-compose logs -f pirate-radio-service
```

### Configuration

Edit `service/.env` for service settings and `docker-compose.yml` for container orchestration.

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8082 | HTTP server port |
| `HOST` | 0.0.0.0 | Bind address |
| `ICECAST_HOST` | localhost | Icecast server hostname |
| `ICECAST_PORT` | 8000 | Icecast server port |
| `ICECAST_MOUNT` | /stream | Mount point on Icecast |
| `ICECAST_USERNAME` | source | Icecast source username |
| `ICECAST_PASSWORD` | hackme | Icecast source password |
| `ICECAST_STREAM_NAME` | Novustrix Pirate Radio | Stream name |
| `AUDIO_FORMAT` | mp3 | Audio format (mp3, ogg, aac, opus) |
| `AUDIO_BITRATE` | 128000 | Audio bitrate in bps |
| `AUDIO_SAMPLE_RATE` | 44100 | Sample rate in Hz |
| `AUDIO_CHANNELS` | 2 | Number of audio channels |
| `CORS_ORIGINS` | - | Comma-separated allowed origins |
| `LOG_LEVEL` | info | Logging level (error, warn, info, debug) |
| `FFMPEG_PATH` | ffmpeg | Path to FFmpeg binary |
| `SHARE_SECRET` | - | Optional shared secret for widget auth |

### FFmpeg Codecs

The service automatically selects the appropriate codec for your audio format:

| Format | Codec | Notes |
|--------|-------|-------|
| mp3 | libmp3lame | Most compatible |
| ogg | libvorbis | Open format |
| aac | aac | AAC encoding |
| opus | libopus | Low latency, high quality |

## API Endpoints

### HTTP REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/stats` | Stream statistics |

### WebSocket API (`/ws`)

#### Message Types (Client → Service)

```json
// Join a Matrix room
{
  "type": "join_room",
  "data": {
    "roomId": "!roomId:matrix.org",
    "userId": "@user:matrix.org",
    "displayName": "User Name"
  }
}

// Leave a Matrix room
{
  "type": "leave_room",
  "data": {
    "roomId": "!roomId:matrix.org"
  }
}

// Start broadcasting (requires microphone access in widget)
{
  "type": "start_broadcast",
  "data": {}
}

// Stop broadcasting
{
  "type": "stop_broadcast",
  "data": {}
}

// Get current room state
{
  "type": "get_state",
  "data": {}
}

// Ping (keepalive)
{
  "type": "ping"
}
```

#### Message Types (Service → Client)

```json
// Room state update
{
  "type": "room_state",
  "data": {
    "roomId": "!roomId:matrix.org",
    "queue": [
      {
        "userId": "@user:matrix.org",
        "displayName": "User Name",
        "status": "waiting"
      }
    ],
    "currentBroadcaster": "@user:matrix.org",
    "isBroadcasting": true,
    "listenerCount": 5,
    "uptime": 1234
  }
}

// Queue update
{
  "type": "queue_update",
  "data": {
    "queue": [...],
    "currentBroadcaster": "@user:matrix.org"
  }
}

// Broadcast started
{
  "type": "broadcast_start",
  "data": {
    "userId": "@user:matrix.org",
    "displayName": "User Name"
  }
}

// Broadcast stopped
{
  "type": "broadcast_stop",
  "data": {
    "userId": "@user:matrix.org"
  }
}

// Stream statistics
{
  "type": "stream_stats",
  "data": {
    "isRunning": true,
    "isConnected": true,
    "bytesSent": 123456,
    "uptime": 123,
    "bitrate": 128
  }
}

// Error message
{
  "type": "error",
  "data": {
    "message": "Error description"
  }
}

// Pong (response to ping)
{
  "type": "pong"
}
```

#### Binary Messages

Audio chunks are sent as binary WebSocket messages (Buffer). The service forwards these directly to FFmpeg for encoding and streaming to Icecast.

## Icecast Setup

### Install Icecast

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install -y icecast2
```

**macOS:**
```bash
brew install icecast
```

### Configure Icecast

Edit `/etc/icecast2/icecast.xml`:

```xml
<icecast>
    <location>Earth</location>
    <admin>admin@pirate.radio</admin>
    
    <limits>
        <clients>100</clients>
        <sources>2</sources>
        <queue-size>524288</queue-size>
        <client-timeout>30</client-timeout>
        <header-timeout>15</header-timeout>
        <source-timeout>10</source-timeout>
    </limits>
    
    <authentication>
        <!-- Source authentication -->
        <source-password>hackme</source-password>
        
        <!-- Admin authentication -->
        <admin-user>admin</admin-user>
        <admin-password>admin</admin-password>
    </authentication>
    
    <listen-socket>
        <port>8000</port>
        <bind-address>0.0.0.0</bind-address>
    </listen-socket>
    
    <paths>
        <basedir>/usr/share/icecast2</basedir>
        <logdir>/var/log/icecast2</logdir>
        <webroot>/usr/share/icecast2/web</webroot>
        <adminroot>/usr/share/icecast2/admin</adminroot>
    </paths>
</icecast>
```

### Start Icecast

```bash
# Systemd
sudo systemctl start icecast2
sudo systemctl enable icecast2

# Manual
icecast2 -c /etc/icecast2/icecast.xml
```

## Widget Integration

Update your Matrix widget to connect to the broadcast service:

```javascript
// In your widget's index.ts
const socket = new WebSocket('ws://localhost:8082/ws');

socket.onopen = () => {
    // Join the room
    socket.send(JSON.stringify({
        type: 'join_room',
        data: {
            roomId: widgetApi.getRoomId(),
            userId: widgetApi.getUser().userId,
            displayName: widgetApi.getUser().displayName
        }
    }));
};

// Start broadcasting
socket.send(JSON.stringify({
    type: 'start_broadcast',
    data: {}
}));

// Send audio chunks (from MediaRecorder)
mediaRecorder.ondataavailable = (event) => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
    }
};
```

## Monitoring

### Service Metrics

```bash
# Health check
curl http://localhost:8082/health

# Statistics
curl http://localhost:8082/stats
```

### Logs

```bash
# View service logs
journalctl -u pirate-radio-service -f

# Or with Docker
docker logs -f pirate-radio-service
```

### Icecast Statistics

Visit `http://localhost:8000/stats` in your browser or:

```bash
curl http://localhost:8000/stats.xml
```

## Troubleshooting

### Common Issues

**1. FFmpeg not found**
```
Error: FFmpeg is not installed or not found in PATH
```

Install FFmpeg as shown above, or set `FFMPEG_PATH` in your `.env` file.

**2. Icecast connection refused**
```
Connection to server established
```

Verify Icecast is running and the host/port are correct. Check firewall settings.

**3. WebSocket connection fails**

Check CORS origins in your `.env` file. Ensure the widget URL is listed.

**4. No audio in stream**

- Verify microphone permissions in browser
- Check FFmpeg is receiving data (enable debug logging)
- Verify Icecast mount point exists

### Debug Logging

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

Or in `.env`:
```
LOG_LEVEL=debug
```

## Security Considerations

1. **CORS**: Only allow trusted origins in `CORS_ORIGINS`
2. **Icecast Password**: Use strong passwords for Icecast source authentication
3. **HTTPS**: Use a reverse proxy (Nginx) with SSL for production
4. **Authentication**: Consider implementing token-based authentication
5. **Rate Limiting**: The service doesn't currently rate-limit connections

## License

Apache License 2.0 - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- Matrix Room: `#novustrix-radio:matrix.org`
- GitHub Issues: [novustrix/pirate-radio-widget](https://github.com/novustrix/pirate-radio-widget)
