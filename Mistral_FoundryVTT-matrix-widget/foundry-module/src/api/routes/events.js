/**
 * Events Routes
 * 
 * Provides endpoints for event polling and WebSocket connections.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';

const router = Router();

// Event buffer to store recent events
const eventBuffer = [];
const MAX_EVENTS = 100;

/**
 * GET /events/poll - Poll for new events
 */
router.get('/poll', (req, res) => {
    try {
        const { since = 0, limit = 50 } = req.query;
        
        // Get events since the specified timestamp
        const events = eventBuffer.filter(e => e.timestamp > since);
        
        // Limit results
        const result = events.slice(-Math.min(limit, events.length));
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /events/poll:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to poll events',
            code: 500,
        });
    }
});

/**
 * GET /events/stream - Stream events using Server-Sent Events
 */
router.get('/stream', (req, res) => {
    try {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Send a welcome message
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
        
        // Add this connection to the event listeners
        const listeners = getEventListeners();
        listeners.push(res);
        
        // Handle client disconnect
        req.on('close', () => {
            const index = listeners.indexOf(res);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        });
        
        req.on('error', () => {
            const index = listeners.indexOf(res);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /events/stream:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to start event stream',
            code: 500,
        });
    }
});

/**
 * POST /events/emit - Emit a custom event
 * 
 * Request body:
 * {
 *   "type": "customEvent",
 *   "data": { ... },
 *   "worldId": "world-id" (optional)
 * }
 */
router.post('/emit', (req, res) => {
    try {
        const { type, data, worldId } = req.body;
        
        // Validate required fields
        if (!type || !data) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, data',
                code: 400,
            });
        }
        
        // Create the event
        const event = {
            type,
            data,
            worldId: worldId || game.world.id,
            timestamp: Date.now(),
        };
        
        // Add to buffer
        addEvent(event);
        
        // Send to all listeners
        sendToListeners(event);
        
        res.json({
            success: true,
            data: event,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /events/emit:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to emit event: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /events/history - Get event history
 */
router.get('/history', (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        const events = eventBuffer.slice(-Math.min(limit, eventBuffer.length));
        
        res.json({
            success: true,
            data: events,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /events/history:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get event history',
            code: 500,
        });
    }
});

/**
 * Add an event to the buffer
 * 
 * @param {Object} event - Event to add
 */
export function addEvent(event) {
    // Add timestamp if not present
    if (!event.timestamp) {
        event.timestamp = Date.now();
    }
    
    // Add to buffer
    eventBuffer.push(event);
    
    // Trim buffer if too large
    if (eventBuffer.length > MAX_EVENTS) {
        eventBuffer.shift();
    }
    
    // Send to all listeners
    sendToListeners(event);
}

/**
 * Get event listeners
 * 
 * @returns {Array} Array of response objects
 */
function getEventListeners() {
    if (!globalThis.eventListeners) {
        globalThis.eventListeners = [];
    }
    return globalThis.eventListeners;
}

/**
 * Send an event to all listeners
 * 
 * @param {Object} event - Event to send
 */
function sendToListeners(event) {
    const listeners = getEventListeners();
    const message = `data: ${JSON.stringify(event)}\n\n`;
    
    for (const res of listeners) {
        try {
            res.write(message);
        } catch (error) {
            // Remove broken connections
            const index = listeners.indexOf(res);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
}

/**
 * Emit a standard event
 * 
 * @param {string} type - Event type
 * @param {Object} data - Event data
 * @param {string} worldId - World ID
 */
export function emitEvent(type, data, worldId) {
    const event = {
        type,
        data,
        worldId: worldId || game.world.id,
        timestamp: Date.now(),
    };
    
    addEvent(event);
}

/**
 * Initialize event system
 */
export function initializeEvents() {
    // Listen for Foundry events and convert them to our event format
    Hooks.on('chatMessage', (message, content, msg) => {
        emitEvent('chatMessage', {
            id: message.id,
            worldId: message.data.worldId || game.world.id,
            userId: message.user.id,
            userName: message.user.name,
            content: message.content,
            formattedContent: message.data.content,
            timestamp: message.timestamp,
        });
    });
    
    Hooks.on('diceSoNiceRollComplete', (message, roll) => {
        emitEvent('diceRoll', {
            id: message.id,
            worldId: game.world.id,
            userId: message.user.id,
            expression: message.content,
            result: roll.total,
            rolls: roll.rolls,
            timestamp: Date.now(),
        });
    });
    
    Hooks.on('userConnected', (user) => {
        emitEvent('userJoined', {
            userId: user.id,
            worldId: game.world.id,
            userName: user.name,
            isGM: user.isGM,
        });
    });
    
    Hooks.on('userDisconnected', (user) => {
        emitEvent('userLeft', {
            userId: user.id,
            worldId: game.world.id,
            userName: user.name,
        });
    });
}

export { router as eventsRouter };
