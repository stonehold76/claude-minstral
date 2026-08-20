# Matrix-FoundryVTT Bridge Module for FoundryVTT

> **FoundryVTT module that enables tight integration with the Matrix bridge**

This module exposes a REST API that the Matrix-FoundryVTT bridge can use to interact with FoundryVTT at a deeper level, including:

- **Full dice roller integration** - Execute dice rolls with Foundry's dice roller
- **Skill checks** - Perform skill checks with character modifiers
- **Ability checks** - Perform ability checks with character modifiers  
- **Saving throws** - Roll saving throws against DCs
- **Character data access** - Retrieve character sheet information
- **Item/equipment access** - Search and retrieve item data
- **Custom commands** - Execute module-specific commands

---

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [API Endpoints](#api-endpoints)
4. [Module Development](#module-development)
5. [Event System](#event-system)
6. [Security](#security)
7. [Testing](#testing)
8. [License](#license)

---

## Installation

### Prerequisites

- FoundryVTT v10 or v11
- Node.js 16+ (for module development)
- The Matrix-FoundryVTT bridge running

### Installing the Module

1. **Download the module**:
   - Download the latest release from the repository
   - Or clone this repository and build it yourself

2. **Install in Foundry**:
   - Open FoundryVTT
   - Go to **Game Worlds** > **Manage Worlds** > **Install Module**
   - Select the module ZIP file
   - Enable the module for your world

3. **Configure the module**:
   - In Foundry, go to **Game Settings** > **Manage Modules**
   - Find "Matrix Bridge" module
   - Click **Configure** and set your API token

4. **Restart Foundry**:
   - Restart FoundryVTT to activate the module

---

## Configuration

### Module Settings

The module has the following configurable settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `apiEnabled` | Boolean | `true` | Enable/disable the REST API |
| `apiPort` | Number | `30001` | Port for the API server |
| `apiToken` | String | (random) | API authentication token |
| `allowCORS` | Boolean | `true` | Allow CORS for API requests |
| `corsOrigins` | String | `*` | Allowed CORS origins (comma-separated) |
| `logLevel` | String | `info` | Logging level (debug, info, warn, error) |
| `maxConnections` | Number | `10` | Maximum concurrent connections |

### Configuration File

The module creates a configuration file at:
```
FoundryVTT/Data/modules/matrix-bridge/config.json
```

Example configuration:
```json
{
  "apiEnabled": true,
  "apiPort": 30001,
  "apiToken": "your_secure_token_here",
  "allowCORS": true,
  "corsOrigins": "http://localhost:8008,https://your-bridge-server.com",
  "logLevel": "info",
  "maxConnections": 10
}
```

---

## API Endpoints

The module exposes the following REST API endpoints:

### Base URL
```
http://localhost:30001/api/matrix-bridge
```

(Replace `localhost:30001` with your Foundry server's host and configured port)

### Authentication

All endpoints require an `Authorization: Bearer <token>` header with your API token.

### Module Information

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/info` | Get module information |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "matrix-bridge",
    "title": "Matrix Bridge",
    "description": "FoundryVTT module for Matrix integration",
    "version": "1.0.0",
    "author": "stonehold76",
    "compatibleCoreVersion": "11.0.0",
    "minimumCoreVersion": "10.0.0"
  }
}
```

### Worlds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/worlds` | Get all worlds |
| GET | `/worlds/{worldId}` | Get a specific world |
| GET | `/worlds/{worldId}/users` | Get users in a world |

**Response (list worlds):**
```json
{
  "success": true,
  "data": [
    {
      "id": "world-id-123",
      "title": "D&D Campaign",
      "system": "dnd5e",
      "isActive": true,
      "players": [
        {
          "id": "user-id-1",
          "name": "Alice",
          "isGM": true
        }
      ],
      "gmIds": ["user-id-1"]
    }
  ]
}
```

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{userId}` | Get a specific user |
| GET | `/users/{userId}/current-world` | Get current world for user |
| GET | `/users/{userId}/characters` | Get characters for user |

**Response (get user):**
```json
{
  "success": true,
  "data": {
    "id": "user-id-1",
    "name": "Alice",
    "isGM": true,
    "avatar": "icons/svg/mystery-man.svg",
    "color": "#FF0000"
  }
}
```

### Dice Rolls

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/dice/roll` | Execute a dice roll |

**Request:**
```json
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "expression": "1d20 + 5",
  "whisperTo": ["user-id-2"],
  "blind": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "roll-id-123",
    "userId": "user-id-1",
    "worldId": "world-id-123",
    "expression": "1d20 + 5",
    "result": "1d20 + 5 = 15 + 5 = 20",
    "total": 20,
    "rolls": [[15]],
    "whisperTo": ["user-id-2"],
    "blind": false,
    "timestamp": 1234567890
  }
}
```

### Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checks/skill` | Perform a skill check |
| POST | `/checks/ability` | Perform an ability check |
| POST | `/checks/save` | Perform a saving throw |

**Request (skill check):**
```json
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "skill": "stealth",
  "dc": 15,
  "advantage": false,
  "disadvantage": false
}
```

**Response (skill check):**
```json
{
  "success": true,
  "data": {
    "id": "check-id-123",
    "userId": "user-id-1",
    "characterId": "actor-id-123",
    "skill": "stealth",
    "roll": 18,
    "dc": 15,
    "success": true,
    "criticalSuccess": false,
    "criticalFailure": false,
    "total": 23,
    "breakdown": "1d20 (18) + Dexterity (5) = 23",
    "timestamp": 1234567890
  }
}
```

**Request (ability check):**
```json
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "ability": "str",
  "dc": 15,
  "advantage": true,
  "disadvantage": false
}
```

**Request (saving throw):**
```json
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "ability": "dex",
  "dc": 15,
  "advantage": false,
  "disadvantage": false
}
```

### Character Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/characters/get` | Get character data |

**Request:**
```json
{
  "worldId": "world-id-123",
  "characterId": "actor-id-123",
  "fields": ["name", "system.attributes.hp", "system.skills.stealth"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "actor-id-123",
    "name": "Gandalf",
    "system": "dnd5e",
    "data": {
      "name": "Gandalf",
      "system": {
        "attributes": {
          "hp": {
            "value": 45,
            "max": 45
          }
        },
        "skills": {
          "stealth": {
            "value": 5,
            "mod": 5
          }
        }
      }
    },
    "timestamp": 1234567890
  }
}
```

### Items/Equipment

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/items/search` | Search for items |

**Request:**
```json
{
  "worldId": "world-id-123",
  "characterId": "actor-id-123",
  "itemName": "Longsword",
  "type": "weapon"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "item-id-123",
      "name": "Longsword",
      "type": "weapon",
      "data": {
        "description": "A sharp longsword",
        "damage": "1d8",
        "properties": ["versatile"]
      },
      "ownerId": "actor-id-123",
      "timestamp": 1234567890
    }
  ]
}
```

### Chat Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/send` | Send a chat message |

**Request:**
```json
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "content": "Hello from Matrix!",
  "formattedContent": "<p>Hello from Matrix!</p>",
  "type": "chat",
  "whisperTo": ["user-id-2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "message-id-123",
    "worldId": "world-id-123",
    "userId": "user-id-1",
    "content": "Hello from Matrix!",
    "formattedContent": "<p>Hello from Matrix!</p>",
    "timestamp": 1234567890
  }
}
```

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events/poll` | Poll for new events |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "chatMessage",
      "data": {
        "id": "message-id-123",
        "worldId": "world-id-123",
        "userId": "user-id-1",
        "content": "Hello from Foundry!"
      }
    },
    {
      "type": "diceRoll",
      "data": {
        "id": "roll-id-123",
        "userId": "user-id-1",
        "expression": "1d20",
        "total": 15
      }
    }
  ]
}
```

### Custom Commands

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/commands/{command}` | Execute a custom command |

**Request:**
```json
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "data": {
    "action": "playSound",
    "sound": "dnd5e.spell.fireball"
  }
}
```

---

## Module Development

### Project Structure

```
matrix-bridge/
├── module.json              # Module manifest
├── template.json            # Template for module installation
├── README.md                # This file
├── src/
│   ├── index.js             # Module entry point
│   ├── api/                 # API server
│   │   ├── server.js        # Express server
│   │   ├── routes/          # API routes
│   │   │   ├── index.js     # Main routes
│   │   │   ├── worlds.js    # World routes
│   │   │   ├── users.js     # User routes
│   │   │   ├── dice.js      # Dice routes
│   │   │   ├── checks.js    # Check routes
│   │   │   ├── characters.js # Character routes
│   │   │   ├── items.js     # Item routes
│   │   │   ├── chat.js      # Chat routes
│   │   │   └── events.js    # Event routes
│   │   └── middleware/      # Middleware
│   │       └── auth.js      # Authentication
│   ├── foundry/              # Foundry integration
│   │   ├── hooks.js         # Foundry hooks
│   │   ├── dice.js          # Dice roller integration
│   │   ├── checks.js        # Check integration
│   │   └── utils.js         # Utilities
│   └── config.js            # Configuration
├── static/                   # Static files
│   └── styles.css           # Module styles
└── languages/               # Translations
    └── en.json              # English translations
```

### Module Manifest (module.json)

```json
{
  "name": "matrix-bridge",
  "title": "Matrix Bridge",
  "description": "Enables integration with Matrix chat via the Matrix-FoundryVTT bridge",
  "version": "1.0.0",
  "author": "stonehold76",
  "compatibleCoreVersion": "11.0.0",
  "minimumCoreVersion": "10.0.0",
  "url": "https://github.com/stonehold76/claude-minstral/tree/main/Mistral_FoundryVTT-matrix-widget/foundry-module",
  "manifest": "https://raw.githubusercontent.com/stonehold76/claude-minstral/main/Mistral_FoundryVTT-matrix-widget/foundry-module/module.json",
  "download": "https://github.com/stonehold76/claude-minstral/releases/download/v1.0.0/matrix-bridge.zip",
  "readme": "https://raw.githubusercontent.com/stonehold76/claude-minstral/main/Mistral_FoundryVTT-matrix-widget/foundry-module/README.md",
  "changelog": "https://raw.githubusercontent.com/stonehold76/claude-minstral/main/Mistral_FoundryVTT-matrix-widget/foundry-module/CHANGELOG.md",
  "license": "Apache-2.0",
  "esmodules": [
    "src/index.js"
  ],
  "styles": [
    "static/styles.css"
  ],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "languages/en.json"
    }
  ],
  "socket": true,
  "library": false
}
```

### Module Entry Point (src/index.js)

```javascript
// Import FoundryVTT APIs
import { registerModule } from './foundry/hooks.js';
import { startApiServer } from './api/server.js';
import { loadConfig } from './config.js';

// Module metadata
const MODULE_ID = 'matrix-bridge';

// Initialize module
Hooks.once('init', () => {
    console.log(`[${MODULE_ID}] Initializing Matrix Bridge module...`);
    
    // Load configuration
    const config = loadConfig();
    
    // Register Foundry hooks
    registerModule(config);
    
    // Start API server if enabled
    if (config.apiEnabled) {
        startApiServer(config);
    }
    
    console.log(`[${MODULE_ID}] Matrix Bridge module initialized`);
});

// Cleanup on close
Hooks.once('close', () => {
    console.log(`[${MODULE_ID}] Cleaning up Matrix Bridge module...`);
    // Cleanup logic here
});
```

### Foundry Hooks (src/foundry/hooks.js)

```javascript
import { MODULE_ID } from '../constants.js';
import { handleChatMessage } from './chat.js';
import { handleDiceRoll } from './dice.js';

export function registerModule(config) {
    // Listen for chat messages
    Hooks.on('chatMessage', (html, content, msg) => {
        handleChatMessage(html, content, msg, config);
    });
    
    // Listen for dice rolls
    Hooks.on('diceSoNiceRollComplete', (message, roll) => {
        handleDiceRoll(message, roll, config);
    });
    
    // Listen for user connections
    Hooks.on('userConnected', (user) => {
        console.log(`[${MODULE_ID}] User connected: ${user.name}`);
    });
    
    // Listen for user disconnections
    Hooks.on('userDisconnected', (user) => {
        console.log(`[${MODULE_ID}] User disconnected: ${user.name}`);
    });
    
    // Listen for world ready
    Hooks.once('ready', () => {
        console.log(`[${MODULE_ID}] World ready`);
        
        // Initialize module for this world
        initializeWorld(config);
    });
}

function initializeWorld(config) {
    // Get current world
    const world = game.world;
    console.log(`[${MODULE_ID}] Initialized for world: ${world.title} (${world.id})`);
    
    // Store world info for API access
    // ...
}
```

### API Server (src/api/server.js)

```javascript
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { MODULE_ID } from '../constants.js';
import { authMiddleware } from './middleware/auth.js';
import { setupRoutes } from './routes/index.js';

let server = null;

export function startApiServer(config) {
    const app = express();
    
    // Middleware
    app.use(cors({
        origin: config.corsOrigins || '*',
    }));
    app.use(bodyParser.json());
    app.use(authMiddleware(config.apiToken));
    
    // Routes
    setupRoutes(app);
    
    // Start server
    server = app.listen(config.apiPort, () => {
        console.log(`[${MODULE_ID}] API server listening on port ${config.apiPort}`);
    });
    
    return server;
}

export function stopApiServer() {
    if (server) {
        server.close();
        server = null;
        console.log(`[${MODULE_ID}] API server stopped`);
    }
}
```

### Dice Roller Integration (src/foundry/dice.js)

```javascript
import { MODULE_ID } from '../constants.js';

export function handleDiceRoll(message, roll, config) {
    // Only process rolls from players (not NPCs)
    if (!message.isRoll || !message.user) {
        return;
    }
    
    const userId = message.user.id;
    const worldId = game.world.id;
    const expression = message.content.match(/\/r\s+(.+)/i)?.[1] || '';
    
    console.log(`[${MODULE_ID}] Dice roll: ${userId} rolled ${expression}`);
    
    // Emit event for API to pick up
    game.socket.emit(`module.${MODULE_ID}`, {
        type: 'diceRoll',
        data: {
            userId,
            worldId,
            expression,
            result: roll.total,
            rolls: roll.rolls,
            timestamp: Date.now(),
        },
    });
}

export function rollDice(expression, userId, worldId, whisperTo = [], blind = false) {
    // Use Foundry's dice roller
    const roll = new Roll(expression);
    const result = roll.roll();
    
    // Create chat message
    const messageData = {
        speaker: {
            user: userId,
        },
        content: `/r ${expression}`,
        whisper: whisperTo,
        blind: blind,
    };
    
    // Send to chat
    ChatMessage.create(messageData);
    
    return {
        expression,
        result: roll.total,
        rolls: result.rolls,
        userId,
        worldId,
        whisperTo,
        blind,
        timestamp: Date.now(),
    };
}
```

### Check Integration (src/foundry/checks.js)

```javascript
import { MODULE_ID } from '../constants.js';

export function performSkillCheck(userId, characterId, skill, dc, advantage = false, disadvantage = false) {
    const character = game.actors.get(characterId);
    if (!character) {
        throw new Error(`Character not found: ${characterId}`);
    }
    
    const skillData = character.system.skills?.[skill];
    if (!skillData) {
        throw new Error(`Skill not found: ${skill}`);
    }
    
    // Get the skill modifier
    const modifier = skillData.mod || 0;
    
    // Roll the dice
    const roll = new Roll(`1d20 + ${modifier}`);
    const result = roll.roll();
    const total = result.total;
    
    // Determine success
    const success = total >= dc;
    const criticalSuccess = total === 20;
    const criticalFailure = total === 1;
    
    // Create chat message
    const messageData = {
        speaker: {
            user: userId,
            actor: characterId,
        },
        content: `${skill} check: ${total} (DC ${dc}) - ${success ? 'Success' : 'Failure'}`,
    };
    
    ChatMessage.create(messageData);
    
    return {
        userId,
        characterId,
        skill,
        roll: result.total,
        dc,
        success,
        criticalSuccess,
        criticalFailure,
        modifier,
        total,
        breakdown: `1d20 (${result.rolls[0][0]}) + ${modifier} = ${total}`,
        timestamp: Date.now(),
    };
}

export function performAbilityCheck(userId, characterId, ability, dc, advantage = false, disadvantage = false) {
    const character = game.actors.get(characterId);
    if (!character) {
        throw new Error(`Character not found: ${characterId}`);
    }
    
    const abilityData = character.system.abilities?.[ability];
    if (!abilityData) {
        throw new Error(`Ability not found: ${ability}`);
    }
    
    // Get the ability modifier
    const modifier = abilityData.mod || 0;
    
    // Roll the dice (with advantage/disadvantage)
    let rollExpression = `1d20 + ${modifier}`;
    if (advantage) {
        rollExpression = `2d20kh1 + ${modifier}`;
    } else if (disadvantage) {
        rollExpression = `2d20kl1 + ${modifier}`;
    }
    
    const roll = new Roll(rollExpression);
    const result = roll.roll();
    const total = result.total;
    
    // Determine success
    const success = total >= dc;
    const criticalSuccess = result.rolls[0].includes(20);
    const criticalFailure = result.rolls[0].includes(1);
    
    // Create chat message
    const messageData = {
        speaker: {
            user: userId,
            actor: characterId,
        },
        content: `${ability.toUpperCase()} check: ${total} (DC ${dc}) - ${success ? 'Success' : 'Failure'}`,
    };
    
    ChatMessage.create(messageData);
    
    return {
        userId,
        characterId,
        ability,
        roll: result.total,
        dc,
        success,
        criticalSuccess,
        criticalFailure,
        modifier,
        total,
        breakdown: `${rollExpression} = ${total}`,
        timestamp: Date.now(),
    };
}

export function performSavingThrow(userId, characterId, ability, dc, advantage = false, disadvantage = false) {
    // Similar to ability check but with saving throw logic
    // ...
}
```

---

## Event System

The module emits events that can be listened to via the Socket.IO connection or polled via the REST API.

### Event Types

| Event Type | Description | Data |
|------------|-------------|------|
| `chatMessage` | A chat message was sent | `{ id, worldId, userId, content, formattedContent, timestamp }` |
| `diceRoll` | A dice roll was made | `{ id, userId, worldId, expression, result, rolls, timestamp }` |
| `skillCheck` | A skill check was performed | `{ id, userId, characterId, skill, roll, dc, success, total, breakdown, timestamp }` |
| `abilityCheck` | An ability check was performed | `{ id, userId, characterId, ability, roll, dc, success, total, breakdown, timestamp }` |
| `savingThrow` | A saving throw was performed | `{ id, userId, characterId, ability, roll, dc, success, total, breakdown, timestamp }` |
| `userJoined` | A user joined the world | `{ userId, worldId, userName, isGM }` |
| `userLeft` | A user left the world | `{ userId, worldId, userName }` |
| `userTyping` | A user is typing | `{ userId, worldId, isTyping }` |
| `worldReady` | The world is ready | `{ worldId, title, system }` |

### Listening to Events

```javascript
// Via WebSocket (recommended)
const socket = io('http://localhost:30001', {
    query: { token: 'your_api_token' }
});

socket.on('connect', () => {
    console.log('Connected to module events');
});

socket.on('chatMessage', (data) => {
    console.log('New chat message:', data);
});

socket.on('diceRoll', (data) => {
    console.log('Dice roll:', data);
});

// Via REST API polling
async function pollEvents() {
    const response = await fetch('http://localhost:30001/api/matrix-bridge/events/poll', {
        headers: {
            'Authorization': 'Bearer your_api_token'
        }
    });
    const events = await response.json();
    // Process events...
}

setInterval(pollEvents, 5000);
```

---

## Security

### Authentication

The module uses token-based authentication:

1. **API Token**: A secure token is generated on first run and stored in the config
2. **Bearer Token**: All API requests must include `Authorization: Bearer <token>` header
3. **Token Rotation**: Tokens can be rotated via the configuration

### Security Best Practices

1. **Use HTTPS**: Always use HTTPS in production
2. **Restrict CORS**: Limit CORS origins to your bridge server only
3. **Rate Limiting**: Consider adding rate limiting to prevent abuse
4. **Input Validation**: All inputs are validated before processing
5. **Error Handling**: Errors don't expose sensitive information

### Configuration Security

```json
{
  "apiEnabled": true,
  "apiPort": 30001,
  "apiToken": "your_very_secure_token_here",
  "allowCORS": true,
  "corsOrigins": "https://your-bridge-server.com",
  "maxConnections": 10
}
```

---

## Testing

### Running Tests

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── unit/
│   ├── api/
│   │   └── routes.test.js
│   ├── foundry/
│   │   ├── dice.test.js
│   │   └── checks.test.js
│   └── utils.test.js
├── integration/
│   ├── api.test.js
│   └── foundry.test.js
└── e2e/
    └── full-flow.test.js
```

---

## License

This module is licensed under the **Apache License 2.0** - see the [LICENSE](../LICENSE) file for details.

---

## Support

For issues or questions:

- **GitHub Issues**: [stonehold76/claude-minstral](https://github.com/stonehold76/claude-minstral/issues)
- **Matrix**: `@stonehold76:matrix.org`
- **Discord**: (if applicable)

---

## Changelog

### v1.0.0
- Initial release
- REST API with all endpoints
- Dice roller integration
- Skill/ability check integration
- Character data access
- Item search
- Chat message sending
- Event system

---

*Documentation for Matrix-FoundryVTT Bridge Module v1.0.0*
