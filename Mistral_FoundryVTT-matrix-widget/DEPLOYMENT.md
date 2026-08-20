# Matrix-FoundryVTT Bridge Deployment Guide

> **Complete guide to deploying the Matrix-FoundryVTT bridge with scene background sync and license enforcement**

This guide walks you through deploying the bridge in production, using `foundry.cognitivecosmos.games:30000` as a reference example.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [FoundryVTT Module Setup](#foundryvtt-module-setup)
5. [Matrix Application Service Setup](#matrix-application-service-setup)
6. [Scene Background Sync](#scene-background-sync)
7. [License Enforcement](#license-enforcement)
8. [Running the Bridge](#running-the-bridge)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)
12. [Updating](#updating)

---

## Prerequisites

### Required Software

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 16+ | Runs the bridge server |
| npm or yarn | 8+ | Package management |
| FoundryVTT | v10 or v11 | The game platform |
| Matrix Homeserver | Synapse, Dendrite, or Conduit | Matrix server |
| Git | 2+ | Clone the repository |

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 512MB | 2GB+ |
| Storage | 100MB | 1GB+ |
| Bandwidth | 1Mbps | 10Mbps+ |

---

## Installation

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/stonehold76/claude-minstral.git
cd claude-minstral/Mistral_FoundryVTT-matrix-widget

# Install dependencies
npm install
```

### Step 2: Build the Project

```bash
# Build the TypeScript code
npm run build

# This creates the dist/ directory with compiled JavaScript
```

---

## Configuration

### Environment Variables

The bridge can be configured via environment variables or a `config.json` file.

#### Required Environment Variables

```bash
# FoundryVTT connection
export FOUNDRY_HOST=foundry.cognitivecosmos.games
export FOUNDRY_PORT=30000
export FOUNDRY_USE_SSL=true

# Matrix connection
export MATRIX_HOMESERVER=https://matrix.org
export MATRIX_USERNAME=@your-bot:matrix.org
export MATRIX_PASSWORD=your-bot-password

# Bridge server
export BRIDGE_PORT=3001

# License (optional - see License Enforcement section)
export LICENSED_ROOM_ID=!yourRoomId:matrix.org
export ENFORCE_LICENSE=true
```

#### Using a Configuration File

Create a `config.json` file:

```json
{
  "foundry": {
    "host": "foundry.cognitivecosmos.games",
    "port": 30000,
    "use_ssl": true,
    "socketio": true,
    "api_enabled": true,
    "api_port": 30001,
    "module_enabled": true,
    "enforce_license": true,
    "licensed_room_id": "!yourRoomId:matrix.org"
  },
  "matrix": {
    "homeserver": "https://matrix.org",
    "display_name": "FoundryVTT Bridge",
    "username": "@your-bot:matrix.org",
    "password": "your-bot-password"
  },
  "scene_sync": {
    "enabled": true,
    "check_interval": 5000,
    "sync_background": true,
    "thumbnail_mode": false,
    "max_image_size": 10485760
  },
  "room_mappings": {},
  "admin_users": [],
  "port": 3001,
  "log_level": "info",
  "debug_mode": false,
  "features": {
    "ghost_users": false,
    "dice_rolls": true,
    "character_sync": true,
    "item_sync": true,
    "scene_sync": true,
    "license_enforcement": true
  }
}
```

---

## FoundryVTT Module Setup

### Step 1: Install the Module in Foundry

1. Open FoundryVTT in your browser
2. Go to **Game Worlds** > **Manage Worlds** > **Install Module**
3. Upload the `foundry-module` directory as a ZIP file, or:
   ```bash
   # Create a ZIP of the module
   cd foundry-module
   zip -r ../matrix-bridge.zip .
   ```
4. Enable the module for your world

### Step 2: Configure the Module

1. In Foundry, go to **Game Settings** > **Manage Modules**
2. Find the "Matrix Bridge" module
3. Click **Configure**
4. Set the API token (optional - auto-generated if not set)
5. Set the API port (default: 30001)
6. Enable/disable features as needed

### Step 3: Verify Module API

Test that the module API is running:

```bash
# Check if the API is accessible
curl http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/health

# Get module info
curl http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/info
```

You should see JSON responses indicating the API is healthy.

---

## Matrix Application Service Setup

The bridge can run as:
1. **Application Service** - Recommended for production (requires AS registration)
2. **User Bot** - Simpler, uses a Matrix user account

### Option A: Application Service (Recommended)

#### Step 1: Create Application Service Registration File

Create a `registration.yaml` file:

```yaml
id: foundryvtt_bridge
url: http://your-bridge-server:3001
as_token: your_application_service_token
hs_token: your_homeserver_token
sender_localpart: _foundry_bridge
rate_limited: false
namespaces:
  users:
    - exclusive: true
      regex: '@foundry_.*:your-homeserver'
  rooms:
    - exclusive: true
      regex: '#foundry_.*:your-homeserver'
  aliases:
    - exclusive: true
      regex: '#foundry_.*:your-homeserver'
```

#### Step 2: Register with Matrix Homeserver

```bash
# For Synapse
admin register-app-service -c registration.yaml

# Or manually add to homeserver.yaml
```

#### Step 3: Configure Bridge

Update your configuration:

```json
{
  "matrix": {
    "homeserver": "https://matrix.org",
    "id": "foundryvtt_bridge",
    "sender_localpart": "_foundry_bridge"
  }
}
```

### Option B: User Bot (Simpler)

#### Step 1: Create a Matrix User

1. Register a new user on your Matrix homeserver (e.g., `@foundry-bridge:matrix.org`)
2. Save the username and password

#### Step 2: Configure Bridge

```json
{
  "matrix": {
    "homeserver": "https://matrix.org",
    "username": "@foundry-bridge:matrix.org",
    "password": "your-password"
  }
}
```

---

## Scene Background Sync

### How It Works

The widget automatically syncs with the current Foundry scene background:

1. **Polling**: The `SceneSyncManager` polls Foundry every 5 seconds (configurable)
2. **Background Fetch**: Gets the current scene's background image URL
3. **CSS Application**: Applies the background to the widget via CSS
4. **Real-time Updates**: Automatically updates when scenes change

### Configuration Options

```json
{
  "scene_sync": {
    "enabled": true,              // Enable/disable scene sync
    "check_interval": 5000,        // Polling interval in ms
    "sync_background": true,      // Sync background images
    "thumbnail_mode": false,      // Use thumbnails for smaller files
    "max_image_size": 10485760    // Max file size in bytes (10MB)
  }
}
```

### Testing Scene Sync

```bash
# Get current scene background
curl http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/scenes/current/background \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Get all scenes
curl http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/scenes \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### Expected Response

```json
{
  "success": true,
  "data": {
    "hasBackground": true,
    "src": "scenes/your-scene/background.jpg",
    "type": "image",
    "thumbnail": "scenes/your-scene/thumb.jpg",
    "color": null,
    "alpha": 1.0,
    "fullUrl": "/worlds/your-world/scenes/your-scene/background.jpg",
    "thumbnailUrl": "/worlds/your-world/scenes/your-scene/thumb.jpg"
  }
}
```

---

## License Enforcement

### How It Works

The bridge enforces that it can only be used in **one Matrix room at a time**:

1. **Room ID Validation**: Each request includes the Matrix room ID
2. **License Check**: The module validates the room ID against the licensed room
3. **Blocking**: Requests from unlicensed rooms are rejected with 403 Forbidden
4. **Widget Integration**: The widget shows a warning and disables sending if not licensed

### Setting the Licensed Room

```bash
# Set the licensed room ID
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/license/set \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "!yourRoomId:matrix.org",
    "enforce": true
  }'
```

### Validating a Room

```bash
# Check if a room is licensed
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/license/validate \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "!testRoom:matrix.org"
  }'
```

### Expected Response (Licensed)

```json
{
  "success": true,
  "is_licensed": true,
  "room_id": "!yourRoomId:matrix.org",
  "licensed_room_id": "!yourRoomId:matrix.org",
  "timestamp": 1234567890
}
```

### Expected Response (Not Licensed)

```json
{
  "success": false,
  "is_licensed": false,
  "room_id": "!testRoom:matrix.org",
  "licensed_room_id": "!yourRoomId:matrix.org",
  "error": "Room !testRoom:matrix.org is not licensed. Only room !yourRoomId:matrix.org is authorized.",
  "timestamp": 1234567890
}
```

### Disabling License Enforcement

```bash
# Disable license enforcement (allows all rooms)
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/license/enforce \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enforce": false}'
```

### Clearing the Licensed Room

```bash
# Remove license restriction (allows all rooms)
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/license/clear \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

---

## Running the Bridge

### Development Mode

```bash
# Run with hot-reload
npm run dev

# Or manually
node dist/index.js
```

### Production Mode

#### Using npm

```bash
# Build for production
npm run build

# Run the bridge
node dist/index.js
```

#### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the bridge
pm2 start dist/index.js --name "matrix-foundry-bridge"

# Save the process list
pm2 save

# Start on system boot
pm2 startup
```

#### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source
COPY dist/ ./dist/
COPY config.json .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
# Build the image
docker build -t matrix-foundry-bridge .

# Run the container
docker run -d \
  --name matrix-foundry-bridge \
  -p 3001:3001 \
  -e FOUNDRY_HOST=foundry.cognitivecosmos.games \
  -e FOUNDRY_PORT=30000 \
  -e MATRIX_HOMESERVER=https://matrix.org \
  matrix-foundry-bridge
```

---

## Testing

### Test Foundry Connection

```bash
# Check Foundry connection
curl http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/health

# Get module info
curl http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/info
```

### Test License System

```bash
# Set licensed room
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/license/set \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"room_id": "!testRoom:matrix.org"}'

# Validate room
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/license/validate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"room_id": "!testRoom:matrix.org"}'
```

### Test Scene Sync

```bash
# Get current scene background
curl http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/scenes/current/background \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Dice Rolls

```bash
# Roll dice
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/dice/roll \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "worldId": "your-world-id",
    "userId": "your-user-id",
    "expression": "1d20 + 5"
  }'
```

### Test Character Checks

```bash
# Perform an attribute check (system-agnostic)
curl -X POST http://foundry.cognitivecosmos.games:30001/api/matrix-bridge/checks/attribute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "worldId": "your-world-id",
    "userId": "your-user-id",
    "characterId": "your-character-id",
    "attribute": "attributes.stress",
    "dc": 12
  }'
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Connection refused to Foundry | Check Foundry is running, verify host/port |
| API returns 401 Unauthorized | Check API token in module configuration |
| API returns 403 Forbidden | Check license - room may not be licensed |
| No background sync | Verify scene sync is enabled in config |
| Widget doesn't load | Check browser console for errors |
| Matrix events not received | Verify Application Service registration |

### Debug Mode

Enable debug logging:

```bash
# Via environment variable
export LOG_LEVEL=debug

# Or in config.json
{
  "log_level": "debug"
}
```

### Check Logs

```bash
# If using PM2
pm2 logs matrix-foundry-bridge

# If running manually
# Logs are output to console
```

### Verify Foundry Module

1. In Foundry, open the browser console (F12)
2. Check for errors during module initialization
3. Verify the module is enabled for your world

### Verify Matrix Connection

```bash
# Test Matrix client connection
curl -X POST https://matrix.org/_matrix/client/v3/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "@your-bot:matrix.org",
    "password": "your-password"
  }'
```

---

## Security Considerations

### API Security

1. **Use HTTPS**: Always use HTTPS for production deployments
2. **API Tokens**: Use strong, random tokens for API authentication
3. **Rate Limiting**: Consider adding rate limiting to prevent abuse
4. **CORS**: Restrict CORS origins to your trusted domains

```json
{
  "corsOrigins": "https://your-matrix-server.com,https://your-widget-server.com"
}
```

### Network Security

1. **Firewall**: Restrict access to the bridge server
2. **Reverse Proxy**: Use nginx or Apache as a reverse proxy
3. **Authentication**: Require authentication for all endpoints

### Example nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name bridge.your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### License Security

1. **Keep licensed room ID secret**: Don't expose it in public repositories
2. **Use environment variables**: Store sensitive data in environment variables
3. **Rotate tokens**: Regularly rotate API tokens and passwords

---

## Updating

### Update the Bridge

```bash
# Pull the latest changes
cd claude-minstral/Mistral_FoundryVTT-matrix-widget
git pull

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Restart the bridge
pm2 restart matrix-foundry-bridge
```

### Update the Foundry Module

1. In Foundry, go to **Game Worlds** > **Manage Worlds** > **Modules**
2. Find "Matrix Bridge" module
3. Click **Update** or reinstall the module ZIP
4. Restart FoundryVTT

---

## Example: Complete Production Setup

Here's a complete example using `foundry.cognitivecosmos.games:30000`:

### 1. Foundry Server

- URL: `https://foundry.cognitivecosmos.games:30000/`
- Module API: `https://foundry.cognitivecosmos.games:30001/api/matrix-bridge`
- API Token: `your-secure-token`

### 2. Bridge Server

- Host: `bridge.your-domain.com`
- Port: 3001
- Configuration:

```json
{
  "foundry": {
    "host": "foundry.cognitivecosmos.games",
    "port": 30000,
    "use_ssl": true,
    "api_enabled": true,
    "api_port": 30001,
    "api_token": "your-secure-token",
    "licensed_room_id": "!yourRoomId:matrix.org",
    "enforce_license": true
  },
  "matrix": {
    "homeserver": "https://matrix.org",
    "username": "@foundry-bridge:matrix.org",
    "password": "your-bot-password"
  },
  "scene_sync": {
    "enabled": true,
    "check_interval": 5000
  },
  "port": 3001
}
```

### 3. Matrix Widget

```tsx
<MatrixWidgetContainer
    homeserver="https://matrix.org"
    roomId="!yourRoomId:matrix.org"
    asToken="your-app-service-token"
    showLicenseWarnings={true}
    style={{ height: '100vh', width: '100%' }}
/>
```

### 4. Verify Everything Works

```bash
# Check Foundry module
curl https://foundry.cognitivecosmos.games:30001/api/matrix-bridge/health

# Check license
curl -X POST https://foundry.cognitivecosmos.games:30001/api/matrix-bridge/license/validate \
  -H "Authorization: Bearer your-secure-token" \
  -d '{"room_id": "!yourRoomId:matrix.org"}'

# Check scene background
curl https://foundry.cognitivecosmos.games:30001/api/matrix-bridge/scenes/current/background \
  -H "Authorization: Bearer your-secure-token"
```

---

## Support

For issues or questions:

- **GitHub Issues**: [stonehold76/claude-minstral](https://github.com/stonehold76/claude-minstral/issues)
- **Matrix**: `@stonehold76:matrix.org`
- **Discord**: (if applicable)

---

## License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

---

*Deployment Guide for Matrix-FoundryVTT Bridge v1.0.0*
