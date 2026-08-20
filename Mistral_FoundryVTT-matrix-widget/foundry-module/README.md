# Matrix-FoundryVTT Bridge Module for FoundryVTT

> **FoundryVTT module that enables tight integration with the Matrix bridge**

This module exposes a REST API that the Matrix-FoundryVTT bridge can use to interact with FoundryVTT at a deeper level, including:

- **Full dice roller integration** - Execute dice rolls with Foundry's dice roller
- **Generic attribute checks** - Perform checks on ANY character attribute (SYSTEM-AGNOSTIC)
- **Saving throws** - Roll saving throws against target numbers (SYSTEM-AGNOSTIC)
- **Character data access** - Retrieve character sheet information from any game system
- **Item/equipment access** - Search and retrieve item data
- **Custom commands** - Execute module-specific commands

## 🎯 System-Agnostic Design

**This module works with ANY FoundryVTT game system**, including:
- **Alien RPG** (stress, composure, agility, etc.)
- **D&D 5e** (strength, dexterity, constitution, intelligence, wisdom, charisma)
- **Call of Cthulhu** (strength, dexterity, intelligence, etc.)
- **Pathfinder 1e/2e** (strength, dexterity, constitution, etc.)
- **Starfinder**
- **Cyberpunk RED**
- **Shadowrun**
- **Any custom homebrew system**

The module **discovers available attributes at runtime** from each character's system data, rather than hardcoding specific attribute names. This means it automatically adapts to whatever game system you're using.

---

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [API Endpoints](#api-endpoints)
4. [System-Agnostic Checks](#system-agnostic-checks)
5. [Examples for Different Game Systems](#examples-for-different-game-systems)
6. [Module Development](#module-development)
7. [Event System](#event-system)
8. [Security](#security)
9. [Testing](#testing)
10. [License](#license)

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

---

## System-Agnostic Checks

The check endpoints are designed to work with **ANY** FoundryVTT game system. Instead of hardcoding attributes like "strength" or "dexterity", you specify the **path** to the attribute in the character's system data.

### Check Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checks/attribute` | Perform a check on ANY character attribute |
| POST | `/checks/save` | Perform a saving throw on ANY attribute |
| POST | `/checks/simple` | Perform a simple dice check |
| GET | `/checks/available/:characterId` | Get all available check options for a character |
| GET | `/checks/discover/:characterId` | Discover all attributes for a character |
| GET | `/checks/system` | Get current game system information |

### How It Works

1. **Attribute Path**: You specify the path to the attribute in the character's system data
   - Example: `"attributes.stress"` (Alien RPG), `"skills.stealth"` (D&D 5e)
   
2. **Automatic Discovery**: The module can scan a character and return all available attributes
   
3. **No Hardcoded Values**: The module never assumes what attributes exist - it reads them from the character

---

## Examples for Different Game Systems

### Alien RPG

In Alien RPG, characters have attributes like:
- `attributes.stress`
- `attributes.composure`
- `attributes.agility`

**Attribute Check:**
```json
POST /api/matrix-bridge/checks/attribute
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "attribute": "attributes.stress",
  "dc": 12,
  "displayName": "Stress Check"
}
```

**Saving Throw:**
```json
POST /api/matrix-bridge/checks/save
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "attribute": "attributes.composure",
  "dc": 10
}
```

### D&D 5e

In D&D 5e, characters have:
- Skills: `skills.stealth`, `skills.perception`, etc.
- Abilities: `abilities.strength`, `abilities.dexterity`, etc.
- Saves: `saves.dexterity`, `saves.constitution`, etc.

**Skill Check:**
```json
POST /api/matrix-bridge/checks/attribute
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "attribute": "skills.stealth",
  "dc": 15,
  "advantage": true
}
```

**Ability Check:**
```json
POST /api/matrix-bridge/checks/attribute
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "attribute": "abilities.dexterity",
  "dc": 15
}
```

**Saving Throw:**
```json
POST /api/matrix-bridge/checks/save
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "attribute": "abilities.constitution",
  "dc": 15
}
```

### Call of Cthulhu

In Call of Cthulhu, characters have:
- Characteristics: `characteristics.str`, `characteristics.dex`, etc.
- Skills: `skills.persuade`, `skills.sneak`, etc.

**Characteristic Roll:**
```json
POST /api/matrix-bridge/checks/attribute
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "attribute": "characteristics.dex",
  "dc": 50
}
```

**Skill Roll:**
```json
POST /api/matrix-bridge/checks/attribute
{
  "worldId": "world-id-123",
  "userId": "user-id-1",
  "characterId": "actor-id-123",
  "attribute": "skills.persuade",
  "dc": 40
}
```

### Discovering Available Attributes

You can discover all available attributes for a character:

**Request:**
```
GET /api/matrix-bridge/checks/available/actor-id-123
```

**Response (Alien RPG example):**
```json
{
  "success": true,
  "data": {
    "byCategory": {
      "attributes": [
        {"name": "stress", "path": "attributes.stress", "label": "Stress"},
        {"name": "composure", "path": "attributes.composure", "label": "Composure"},
        {"name": "agility", "path": "attributes.agility", "label": "Agility"}
      ],
      "skills": [
        {"name": "command", "path": "skills.command", "label": "Command"},
        {"name": "piloting", "path": "skills.piloting", "label": "Piloting"},
        {"name": "medicalAid", "path": "skills.medicalAid", "label": "Medical Aid"}
      ],
      "saves": [],
      "custom": []
    },
    "flatList": [
      {"name": "stress", "path": "attributes.stress", "label": "Stress", "category": "attribute"},
      {"name": "composure", "path": "attributes.composure", "label": "Composure", "category": "attribute"},
      {"name": "command", "path": "skills.command", "label": "Command", "category": "skill"}
    ],
    "system": "alienrpg"
  }
}
```

**Request:**
```
GET /api/matrix-bridge/checks/discover/actor-id-123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "characterId": "actor-id-123",
    "characterName": "Ellen Ripley",
    "system": "alienrpg",
    "attributes": {
      "attributes": [
        {"name": "stress", "path": "attributes.stress", "label": "Stress"},
        {"name": "composure", "path": "attributes.composure", "label": "Composure"}
      ],
      "skills": [
        {"name": "command", "path": "skills.command", "label": "Command"}
      ],
      "saves": [],
      "custom": []
    }
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
│   │   │   ├── checks.js    # Check routes (SYSTEM-AGNOSTIC)
│   │   │   ├── characters.js # Character routes
│   │   │   ├── items.js     # Item routes
│   │   │   ├── chat.js      # Chat routes
│   │   │   └── events.js    # Event routes
│   │   └── middleware/      # Middleware
│   │       └── auth.js      # Authentication
│   ├── foundry/              # Foundry integration
│   │   ├── hooks.js         # Foundry hooks
│   │   ├── dice.js          # Dice roller integration
│   │   ├── checks.js        # Check integration (SYSTEM-AGNOSTIC)
│   │   └── chat.js          # Chat handling
│   └── config.js            # Configuration
├── static/                   # Static files
│   └── styles.css           # Module styles
└── languages/               # Translations
    └── en.json              # English translations
```

### Key Design Principles

1. **System-Agnostic**: Never hardcode attribute names. Always use paths that are discovered from the character.
2. **Runtime Discovery**: Use the `/checks/available` and `/checks/discover` endpoints to find what's available.
3. **Flexible Paths**: Attribute paths can be any valid path in the character's system data.

---

## Event System

The module emits events that can be listened to via Server-Sent Events (SSE) or polled via REST API.

### Event Types

| Event Type | Description | Data |
|------------|-------------|------|
| `chatMessage` | A chat message was sent | `{ id, worldId, userId, content, timestamp }` |
| `diceRoll` | A dice roll was made | `{ id, userId, worldId, expression, result, rolls, timestamp }` |
| `attributeCheck` | An attribute check was performed | `{ id, userId, characterId, attribute, roll, dc, success, total, timestamp }` |
| `savingThrow` | A saving throw was performed | `{ id, userId, characterId, attribute, roll, dc, success, total, timestamp }` |
| `userJoined` | A user joined the world | `{ userId, worldId, userName, isGM }` |
| `userLeft` | A user left the world | `{ userId, worldId, userName }` |
| `worldReady` | The world is ready | `{ worldId, title, system }` |

### Event Streaming with SSE

```javascript
// Connect to event stream
const eventSource = new EventSource('http://localhost:30001/api/matrix-bridge/events/stream');

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Event:', data.type, data.data);
};

eventSource.onerror = (error) => {
    console.error('Event stream error:', error);
};
```

### Event Polling

```javascript
async function pollEvents() {
    const response = await fetch('http://localhost:30001/api/matrix-bridge/events/poll?since=1234567890', {
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

---

## License

This module is licensed under the **Apache License 2.0** - see the [LICENSE](../LICENSE) file for details.

---

## Support

For issues or questions:

- **GitHub Issues**: [stonehold76/claude-minstral](https://github.com/stonehold76/claude-minstral/issues)
- **Matrix**: `@stonehold76:matrix.org`

---

## Changelog

### v1.0.0
- Initial release
- REST API with all endpoints
- System-agnostic check system
- Dice roller integration
- Character data access
- Item search
- Chat message sending
- Event system (polling and SSE)
- Full documentation

---

*Documentation for Matrix-FoundryVTT Bridge Module v1.0.0*
