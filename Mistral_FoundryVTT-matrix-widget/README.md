# Matrix-FoundryVTT Bridge

> **A bidirectional bridge between Matrix homeservers and FoundryVTT game instances**

This project enables Matrix users to participate in FoundryVTT game sessions through their preferred Matrix clients, with full support for chat, dice rolls, whispers, file sharing, and presence synchronization.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Quick Start](#quick-start)
5. [Configuration](#configuration)
6. [Development](#development)
7. [API Reference](#api-reference)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)
10. [Contributing](#contributing)
11. [License](#license)

---

## Overview

### What is this?

The Matrix-FoundryVTT Bridge is an **Application Service** that connects a Matrix homeserver (Synapse, Dendrite, Conduct, etc.) with a FoundryVTT game instance, allowing players and Game Masters to use Matrix as an alternative interface for their tabletop RPG sessions.

### Why use this bridge?

- **Flexibility**: Use your favorite Matrix client (Element, FluffyChat, Cinny, etc.)
- **Decentralization**: Matrix's federated nature means no single point of failure
- **Integration**: Bring your existing Matrix community into FoundryVTT
- **Accessibility**: Mobile-friendly, screen-reader compatible clients available
- **Persistence**: Chat history preserved in both systems

### Use Cases

- Remote gaming groups using Matrix for communication
- Large communities wanting to host multiple Foundry games
- Players who prefer Matrix's interface over Foundry's chat
- Cross-platform gaming (desktop, mobile, web)

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MATRIX SIDE                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Matrix Homeserver                              ││
│  │  ┌─────────────┐    ┌─────────────────────┐    ┌─────────────┐  ││
│  │  │ Matrix Room │    │ Application Service  │    │ Bridge Bot  │  ││
│  │  │  (Users)    │◄──►│  (This Project)      │◄──►│  (User)     │  ││
│  │  └─────────────┘    └─────────────────────┘    └─────────────┘  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FOUNDRYVTT SIDE                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                   FoundryVTT Instance                              ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  ││
│  │  │  Game World │    │ Socket.IO   │    │ Custom Module API   │  ││
│  │  │  (Players)  │◄──►│  Server     │◄──►│  (Optional)         │  ││
│  │  └─────────────┘    └─────────────┘    └─────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Component Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Matrix App Service** | Node.js + matrix-js-sdk | Handles Matrix protocol communication |
| **Foundry Client** | Socket.IO / Module API | Connects to FoundryVTT instance |
| **Message Translator** | TypeScript | Converts between Matrix and Foundry formats |
| **User Mapper** | TypeScript | Maps user identities between systems |
| **State Sync** | TypeScript | Synchronizes presence, membership, etc. |

### Data Flow

#### Matrix → FoundryVTT

```
1. User types message in Matrix client
2. Matrix homeserver sends event to Application Service
3. Bridge receives m.room.message event
4. Bridge parses message content and metadata
5. Bridge looks up room mapping (Matrix room → Foundry world)
6. Bridge translates message format (Matrix HTML → Foundry HTML)
7. Bridge looks up sender (Matrix user → Foundry user)
8. Bridge sends message to Foundry via Socket.IO or Module API
9. Foundry displays message to all players in the game
```

#### FoundryVTT → Matrix

```
1. Player sends chat message in Foundry
2. Foundry emits chatMessage event via Socket.IO
3. Bridge module captures the event
4. Bridge translates message to Matrix format
5. Bridge looks up sender (Foundry user → Matrix user)
6. Bridge looks up room mapping (Foundry world → Matrix room)
7. Bridge sends m.room.message event via App Service
8. Matrix homeserver delivers message to room members
9. Matrix clients display the message
```

---

## Features

### Core Features (Phase 1 - MVP)

- [x] **Basic Message Forwarding**: Text messages flow bidirectionally
- [x] **Room Mapping**: Configure which Matrix rooms connect to which Foundry worlds
- [x] **User Mapping**: Map Matrix users to Foundry users
- [x] **Configuration Management**: YAML-based configuration
- [x] **Application Service Registration**: Proper Matrix AS integration

### Enhanced Features (Phase 2)

- [ ] **Rich Text Formatting**: Preserve bold, italics, links, etc.
- [ ] **Dice Roll Support**: Parse and execute `/roll` commands from Matrix
- [ ] **Multiple Room Support**: Bridge multiple games simultaneously
- [ ] **User Presence Sync**: Show who's online in both systems
- [ ] **File/Attachment Bridging**: Share images and files between systems

### Advanced Features (Phase 3)

- [ ] **Whisper/DM Support**: Private messages between systems
- [ ] **Typing Indicators**: Show when users are typing
- [ ] **Read Receipts**: Sync read status between systems
- [ ] **Reaction Support**: Map emoji reactions between systems
- [ ] **Ghost User Management**: Create synthetic users for Matrix-only participants
- [ ] **Custom Command Handling**: Support Foundry-specific commands from Matrix

### Future Enhancements

- [ ] **Multi-world Support**: Single bridge serving multiple Foundry instances
- [ ] **Character Integration**: Link Matrix users to Foundry character sheets
- [ ] **Initiative Tracking**: Sync combat initiative to Matrix
- [ ] **Map Sharing**: Share Foundry maps as Matrix images
- [ ] **Voice Bridge**: Bridge voice chat (complex, lower priority)
- [ ] **Bot Commands**: Matrix bot commands to control Foundry
- [ ] **Webhook Support**: Allow Foundry modules to send custom events to Matrix

---

## Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 18 or higher
- **npm** or **yarn**
- A **Matrix homeserver** (Synapse, Dendrite, Conduct, etc.)
- A **FoundryVTT** instance (v10 or v11)
- Administrative access to both systems

### Installation

#### 1. Clone the Repository

```bash
cd /workspace/claude-minstral/Mistral_FoundryVTT-matrix-widget
git init
git remote add origin git@github.com:stonehold76/claude-minstral.git
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Matrix Application Service

Edit `config/registration.yaml`:

```yaml
id: foundryvtt-bridge
url: http://localhost:8008
as_token: "your_app_service_token_here"
hs_token: "your_homeserver_token_here"
sender_localpart: "_foundry_bridge"
namespaces:
  users:
    - exclusive: true
      regex: "@_foundry_.*:your\.homeserver"
  rooms: []
  aliases: []
```

Register the App Service with your Matrix homeserver:

```bash
# For Synapse
admin register-app-service -c config/registration.yaml -u http://localhost:8008 -f registration.yaml

# Or manually place the file in Synapse's app_service_config_files directory
```

#### 4. Configure the Bridge

Edit `config/config.yaml`:

```yaml
matrix:
  homeserver: "https://matrix.yourserver.com"
  as_registration: "/path/to/registration.yaml"

foundry:
  host: "localhost"
  port: 30000
  socketio: true
  use_ssl: false

bridge:
  port: 8008
  admin_users:
    - "@admin:yourserver.com"
  room_mappings:
    "#game-room:yourserver.com": "foundry-world-id"
  default_world: "default-world"

features:
  dice_rolls: true
  file_upload: true
  presence_sync: true
  typing_indicators: true
  ghost_users: true
```

Or use environment variables:

```bash
# .env file
export MATRIX_HS_URL=https://matrix.yourserver.com
export MATRIX_AS_TOKEN=your_app_service_token
export FOUNDRY_HOST=localhost
export FOUNDRY_PORT=30000
export BRIDGE_PORT=8008
export NODE_ENV=production
```

#### 5. Set Up FoundryVTT Connection

**Option A: Socket.IO (Recommended for external bridge)**

1. Ensure Foundry's Socket.IO is accessible from the bridge
2. Configure CORS if needed in Foundry's `foundryconfig.json`:

```json
{
  "socketio": {
    "cors": ["http://localhost:8008"]
  }
}
```

**Option B: Foundry Module (For tighter integration)**

1. Create a FoundryVTT module that exposes an API
2. Install the module in your Foundry instance
3. Configure the module to accept connections from the bridge

#### 6. Start the Bridge

```bash
# Development
npm run dev

# Production
npm run build
npm start

# With Docker
docker-compose up -d
```

#### 7. Test the Connection

1. Join the configured Matrix room
2. Send a test message
3. Verify it appears in FoundryVTT
4. Send a message from Foundry
5. Verify it appears in Matrix

---

## Configuration

### Configuration Files

| File | Purpose | Required |
|------|---------|----------|
| `config/registration.yaml` | Matrix App Service registration | Yes |
| `config/config.yaml` | Main bridge configuration | Yes |
| `.env` | Environment variables | No (can use config.yaml) |

### Main Configuration Options

#### Matrix Settings

```yaml
matrix:
  # URL of your Matrix homeserver
  homeserver: "https://matrix.yourserver.com"
  
  # Path to App Service registration file
  as_registration: "/path/to/registration.yaml"
  
  # Optional: Bot user credentials (if not using AS)
  bot_username: "@foundry-bridge:yourserver.com"
  bot_password: "${BOT_PASSWORD}"
```

#### FoundryVTT Settings

```yaml
foundry:
  # Foundry server hostname or IP
  host: "localhost"
  
  # Foundry server port
  port: 30000
  
  # Use Socket.IO for connection
  socketio: true
  
  # Use SSL/TLS for connection
  use_ssl: false
  
  # API token (if using Module API)
  api_token: "${FOUNDRY_API_TOKEN}"
  
  # Path to Foundry data directory (for module approach)
  data_path: "/path/to/foundry/data"
```

#### Bridge Settings

```yaml
bridge:
  # Port for the bridge server
  port: 8008
  
  # Matrix user IDs with admin privileges
  admin_users:
    - "@admin:yourserver.com"
    - "@gm:yourserver.com"
  
  # Map Matrix rooms to Foundry worlds
  room_mappings:
    "#dnd-game:yourserver.com": "world-id-123"
    "#call-of-cthulhu:yourserver.com": "world-id-456"
  
  # Default Foundry world for unmapped rooms
  default_world: "default-world"
  
  # Logging level (error, warn, info, debug)
  log_level: "info"
  
  # Path to log file
  log_file: "/var/log/foundry-bridge.log"
```

#### Feature Toggles

```yaml
features:
  # Enable dice roll parsing and execution
  dice_rolls: true
  
  # Enable file/attachment bridging
  file_upload: true
  
  # Maximum file size in MB
  max_file_size_mb: 10
  
  # Enable user presence synchronization
  presence_sync: true
  
  # Enable typing indicators
  typing_indicators: true
  
  # Enable ghost user creation for Matrix-only users
  ghost_users: true
  
  # Enable whisper/DM support
  whispers: true
  
  # Enable reaction support
  reactions: true
  
  # Enable read receipt synchronization
  read_receipts: false
```

#### Rate Limiting

```yaml
limits:
  # Maximum message length in characters
  max_message_length: 4096
  
  # Maximum file size in MB
  max_file_size_mb: 10
  
  # Messages per minute per user
  rate_limit_messages_per_minute: 60
  
  # API calls per second
  rate_limit_api_calls_per_second: 10
  
  # Maximum retry attempts for failed messages
  max_retries: 3
  
  # Retry backoff settings
  retry:
    initial_delay_ms: 1000
    max_delay_ms: 30000
    multiplier: 2
```

### User Mapping Configuration

Create a `users.yaml` file to explicitly map users:

```yaml
# users.yaml
mappings:
  # Matrix user -> Foundry user
  "@alice:matrix.server.com": "Alice"
  "@bob:matrix.server.com": "Bob"
  "@gm:matrix.server.com": "GameMaster"
  
  # Foundry user -> Matrix user (bidirectional)
  "Charlie": "@charlie:matrix.server.com"
  "Diana": "@diana:matrix.server.com"

# Default behavior for unmapped users
default:
  # Strategy: "create_ghost", "ignore", or "error"
  strategy: "create_ghost"
  
  # Ghost user settings
  ghost:
    prefix: "Matrix_"
    permissions: ["chat"]
```

### Room Mapping Configuration

Configure which Matrix rooms connect to which Foundry worlds:

```yaml
# rooms.yaml
mappings:
  - matrix_room: "#dnd-campaign:matrix.server.com"
    foundry_world: "dnd-world-123"
    direction: "both"  # "matrix_to_foundry", "foundry_to_matrix", or "both"
    
  - matrix_room: "#gm-only:matrix.server.com"
    foundry_world: "dnd-world-123"
    direction: "matrix_to_foundry"  # GMs can send to Foundry, but Foundry doesn't send to GM room
    
  - matrix_room: "#ooc-chat:matrix.server.com"
    foundry_world: "dnd-world-123"
    direction: "both"
    
# Default settings for unmapped rooms
default:
  enabled: false
  direction: "both"
```

---

## Development

### Project Structure

```
Mistral_FoundryVTT-matrix-widget/
├── src/
│   ├── matrix/                    # Matrix integration
│   │   ├── MatrixClient.ts        # Matrix client wrapper
│   │   ├── AppService.ts          # Application Service implementation
│   │   └── MatrixEventHandler.ts  # Matrix event processing
│   │
│   ├── foundry/                   # FoundryVTT integration
│   │   ├── FoundryClient.ts       # Foundry client interface
│   │   ├── SocketIOHandler.ts     # Socket.IO connection handler
│   │   └── ModuleAPI.ts           # Module API handler
│   │
│   ├── core/                      # Core bridge functionality
│   │   ├── MessageTranslator.ts   # Message format conversion
│   │   ├── UserMapper.ts          # User identity mapping
│   │   ├── StateSync.ts           # State synchronization
│   │   └── BridgeConfig.ts        # Configuration management
│   │
│   ├── models/                    # Data models
│   │   ├── MatrixEvent.ts         # Matrix event types
│   │   ├── FoundryMessage.ts      # Foundry message types
│   │   └── UserMapping.ts         # User mapping types
│   │
│   ├── utils/                     # Utilities
│   │   ├── Logger.ts              # Logging utility
│   │   ├── ErrorHandler.ts        # Error handling
│   │   └── RetryQueue.ts          # Message retry queue
│   │
│   └── index.ts                   # Main entry point
│
├── config/
│   ├── registration.yaml.template # App Service registration template
│   ├── config.yaml.template       # Main config template
│   └── users.yaml.template        # User mapping template
│
├── tests/
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
│
├── docs/
│   ├── SETUP.md                   # Setup guide
│   ├── CONFIGURATION.md           # Configuration reference
│   ├── API.md                     # API documentation
│   └── DEVELOPMENT.md             # Development guide
│
├── .env.example                   # Environment variables template
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### Setting Up Development Environment

#### 1. Clone and Install

```bash
cd /workspace/claude-minstral/Mistral_FoundryVTT-matrix-widget
git init
git remote add origin git@github.com:stonehold76/claude-minstral.git
npm install
```

#### 2. Set Up Local Matrix Server

For development, we recommend using [matrix-docker-ansible-deploy](https://github.com/spantaleev/matrix-docker-ansible-deploy):

```bash
# Clone the deploy repository
git clone https://github.com/spantaleev/matrix-docker-ansible-deploy.git
cd matrix-docker-ansible-deploy

# Configure and install
cp inventory/hosts.yml.example inventory/hosts.yml
# Edit inventory/hosts.yml with your settings
ansible-playbook -i inventory/hosts.yml setup.yml
```

#### 3. Set Up Local FoundryVTT

1. Download FoundryVTT from the official website
2. Extract and run locally
3. Enable developer mode in Foundry settings

#### 4. Configure Development Settings

Create a `.env.development` file:

```bash
# .env.development
NODE_ENV=development
MATRIX_HS_URL=http://localhost:8008
MATRIX_AS_TOKEN=dev_app_service_token
FOUNDRY_HOST=localhost
FOUNDRY_PORT=30000
BRIDGE_PORT=3001
LOG_LEVEL=debug
```

#### 5. Run in Development Mode

```bash
npm run dev
```

This starts the bridge with:
- Hot reloading (TypeScript files)
- Debug logging
- Automatic restart on crashes

### Building for Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### Docker Development

#### Build the Docker Image

```bash
docker build -t foundry-matrix-bridge .
```

#### Run with Docker Compose

```bash
docker-compose up -d
```

#### View Logs

```bash
docker-compose logs -f
```

---

## API Reference

### REST API (Admin)

The bridge exposes a REST API for administration:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check endpoint |
| GET | `/api/status` | Bridge status and statistics |
| GET | `/api/rooms` | List all bridged rooms |
| GET | `/api/rooms/:roomId` | Get room mapping details |
| POST | `/api/rooms` | Create new room mapping |
| PUT | `/api/rooms/:roomId` | Update room mapping |
| DELETE | `/api/rooms/:roomId` | Remove room mapping |
| GET | `/api/users` | List all user mappings |
| GET | `/api/users/:userId` | Get user mapping details |
| POST | `/api/users` | Create new user mapping |
| PUT | `/api/users/:userId` | Update user mapping |
| DELETE | `/api/users/:userId` | Remove user mapping |
| POST | `/api/send` | Manually send a message (admin only) |
| GET | `/api/logs` | Get bridge logs |

### WebSocket API

For real-time monitoring and control:

```javascript
const socket = new WebSocket('ws://localhost:8008/api/ws');

socket.on('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Bridge event:', data);
});

// Subscribe to events
socket.send(JSON.stringify({
  action: 'subscribe',
  events: ['message', 'error', 'status']
}));
```

### Matrix Event Types

The bridge handles the following Matrix event types:

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `m.room.message` | Both | Chat messages |
| `m.room.member` | Both | Room membership changes |
| `m.typing` | Both | Typing indicators |
| `m.reaction` | Both | Message reactions |
| `m.receipt` | Matrix → Foundry | Read receipts |

### FoundryVTT Event Types

The bridge handles the following FoundryVTT events:

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `chatMessage` | Both | Chat messages |
| `userJoined` | Foundry → Matrix | User joined game |
| `userLeft` | Foundry → Matrix | User left game |
| `userTyping` | Foundry → Matrix | User is typing |
| `rollDice` | Foundry → Matrix | Dice roll result |

---

## Security

### Authentication

#### Matrix Side

- **Application Service Tokens**: The bridge uses AS tokens for authentication
- **No User Passwords**: Never store Matrix user passwords
- **Token Rotation**: Regularly rotate AS tokens

#### Foundry Side

- **API Tokens**: Use FoundryVTT API tokens with limited permissions
- **Socket.IO Authentication**: Validate Socket.IO connections
- **Module Security**: If using a module, ensure proper access controls

### Authorization

#### Matrix Users

Configure which Matrix users can use the bridge:

```yaml
bridge:
  allowed_users:
    - "@alice:matrix.server.com"
    - "@bob:matrix.server.com"
    - "*@matrix.server.com"  # Allow all users from this server
  
  blocked_users:
    - "@spammer:matrix.server.com"
```

#### Foundry Permissions

Control what ghost users can do:

```yaml
ghost_users:
  permissions:
    - "chat"           # Send and receive chat messages
    - "view_dice"      # See dice roll results
    - "whisper"        # Send and receive whispers
    - "upload_files"   # Upload files/attachments
  
  # Restrict by default
  default_permissions: ["chat"]
```

### Data Protection

#### Encryption

- **Matrix E2E Encryption**: The bridge cannot decrypt E2E encrypted rooms
  - Solution: Warn users that encrypted rooms won't be bridged
  - Alternative: Require bot to be in room (but bot cannot decrypt)

#### Logging

- **Sensitive Data**: Never log message content in production
- **Audit Logs**: Log administrative actions only
- **Retention**: Configure log retention policies

```yaml
logging:
  # What to log
  log_level: "info"
  log_messages: false  # Don't log message content
  log_metadata: true   # Log room IDs, user IDs, timestamps
  
  # Where to log
  console: true
  file: "/var/log/foundry-bridge.log"
  
  # Log rotation
  rotate:
    enabled: true
    max_files: 7
    max_size_mb: 100
```

#### Privacy

- **GDPR Compliance**: Allow users to delete their data
- **Data Export**: Provide users with their data on request
- **Anonymization**: Option to anonymize bridged messages

### Network Security

- **TLS**: Always use HTTPS for Matrix connections
- **Firewall**: Restrict access to bridge ports
- **CORS**: Configure CORS properly for Socket.IO
- **Rate Limiting**: Protect against abuse

```yaml
security:
  # TLS settings
  tls:
    enabled: true
    cert_file: "/path/to/cert.pem"
    key_file: "/path/to/key.pem"
  
  # CORS settings
  cors:
    origins:
      - "https://matrix.yourserver.com"
      - "http://localhost:3000"
    methods:
      - "GET"
      - "POST"
      - "PUT"
      - "DELETE"
  
  # IP restrictions
  allowed_ips:
    - "192.168.1.0/24"
    - "10.0.0.0/8"
```

---

## Troubleshooting

### Common Issues

#### Bridge Not Starting

**Symptom**: Bridge fails to start with authentication errors

**Solutions**:
1. Verify App Service registration file is correct
2. Check that tokens match between registration.yaml and homeserver
3. Ensure homeserver can reach the bridge URL
4. Check logs for specific error messages

```bash
# Check logs
tail -f /var/log/foundry-bridge.log

# Verify registration
curl -X GET http://localhost:8008/api/health
```

#### Messages Not Appearing in Foundry

**Symptom**: Messages sent from Matrix don't appear in Foundry

**Solutions**:
1. Verify room mapping is correct
2. Check that the Matrix user is mapped to a Foundry user
3. Ensure Foundry server is running and accessible
4. Check Foundry console for errors
5. Verify Socket.IO connection is established

```bash
# Test Socket.IO connection
curl -I http://localhost:30000/socket.io/?EIO=4&transport=polling
```

#### Messages Not Appearing in Matrix

**Symptom**: Messages sent from Foundry don't appear in Matrix

**Solutions**:
1. Verify room mapping is correct
2. Check that the Foundry user is mapped to a Matrix user
3. Ensure Matrix homeserver is running
4. Check Matrix homeserver logs for errors
5. Verify App Service is registered correctly

#### Dice Rolls Not Working

**Symptom**: `/roll 1d20` commands from Matrix don't execute in Foundry

**Solutions**:
1. Enable dice_rolls feature in config
2. Verify dice roll syntax is correct
3. Check that the Matrix user has permission to roll dice
4. Ensure Foundry's dice roller module is installed (if using one)

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# In config.yaml
log_level: debug
log_messages: true  # Only in debug mode!

# Or via environment variable
LOG_LEVEL=debug npm start
```

### Getting Help

1. **Check Logs**: Always start with the bridge logs
2. **Review Configuration**: Verify all configuration files
3. **Test Connections**: Ensure Matrix and Foundry are accessible
4. **Consult Documentation**: Check this README and the docs directory
5. **Open an Issue**: If all else fails, open a GitHub issue

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Code of Conduct

This project adheres to the [Contributor Covenant](https://www.contributor-covenant.org/). By participating, you agree to abide by its terms.

### How to Contribute

1. **Fork the Repository**: Create your own fork
2. **Create a Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Make Changes**: Implement your feature or bug fix
4. **Add Tests**: Ensure your changes are covered by tests
5. **Update Documentation**: Update README and docs as needed
6. **Commit Changes**: `git commit -m 'Add amazing feature'`
7. **Push to Branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**: Submit to the main repository

### Pull Request Guidelines

- Follow the existing code style
- Add tests for new functionality
- Update documentation
- Keep commits atomic and well-described
- Reference any related issues

### Development Standards

- **Code Style**: Use Prettier for formatting
- **Linting**: ESLint for TypeScript
- **Testing**: Jest for tests, aim for >80% coverage
- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/)

### Code Review Process

1. All PRs require at least one approval
2. CI checks must pass
3. Tests must pass
4. Documentation must be updated

---

## License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

```
Copyright 2024 stonehold76

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## Acknowledgments

- [Matrix.org](https://matrix.org/) for the Matrix protocol
- [FoundryVTT](https://foundryvtt.com/) for the amazing virtual tabletop
- [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) for Matrix integration
- [Socket.IO](https://socket.io/) for real-time communication
- All contributors and testers

---

## Changelog

### Unreleased

- Initial project structure and documentation
- Matrix Application Service setup
- FoundryVTT integration layer
- Message translation engine
- User mapping system

---

## Contact

- **GitHub**: [stonehold76/claude-minstral](https://github.com/stonehold76/claude-minstral)
- **Matrix**: `@stonehold76:matrix.org` (example)
- **Email**: stonehold76@example.com (example)

---

*Documentation generated for Matrix-FoundryVTT Bridge v1.0.0*
