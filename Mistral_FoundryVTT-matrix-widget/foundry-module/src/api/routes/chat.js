/**
 * Chat Routes
 * 
 * Provides endpoints for sending and receiving chat messages.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';
import { sendChatMessage, sendFormattedMessage, sendBridgeMessage } from '../../foundry/chat.js';

const router = Router();

/**
 * POST /chat/send - Send a chat message
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "content": "Hello from Matrix!",
 *   "formattedContent": "<p>Hello from Matrix!</p>" (optional),
 *   "type": "chat" | "whisper" | "emote" | "oob" (optional, default: "chat"),
 *   "whisperTo": ["user-id-1", "user-id-2"] (optional),
 *   "isBridge": true (optional, marks as from bridge)
 * }
 */
router.post('/send', (req, res) => {
    try {
        const { worldId, userId, content, formattedContent, type = 'chat', whisperTo = [], isBridge = false } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, content',
                code: 400,
            });
        }
        
        // Validate world
        const world = game.worlds.get(worldId);
        if (!world) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        // Validate user
        const user = game.users.get(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 404,
            });
        }
        
        // Send the message
        let message;
        if (formattedContent) {
            message = sendFormattedMessage(formattedContent, content, userId, whisperTo);
        } else {
            message = sendChatMessage(content, userId, whisperTo, type === 'emote');
        }
        
        // Wait for the message to be created
        message.then(msg => {
            res.json({
                success: true,
                data: {
                    id: msg.id,
                    worldId,
                    userId,
                    content: msg.content,
                    formattedContent: msg.formattedContent,
                    timestamp: msg.timestamp,
                },
            });
        }).catch(error => {
            console.error(`[${MODULE_ID}] Error sending message:`, error);
            res.status(500).json({
                success: false,
                error: `Failed to send message: ${error.message}`,
                code: 500,
            });
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /chat/send:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to send message: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /chat/history - Get recent chat messages
 */
router.get('/history', (req, res) => {
    try {
        const { worldId, limit = 20, userId, includeWhispers = false } = req.query;
        
        // Get the target world
        const targetWorld = worldId ? game.worlds.get(worldId) : game.world;
        if (!targetWorld) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        // Get recent messages
        let messages = game.messages;
        
        // Filter by world
        if (worldId) {
            messages = messages.filter(msg => msg.data.worldId === worldId);
        }
        
        // Filter by user if specified
        if (userId) {
            messages = messages.filter(msg => msg.user.id === userId);
        }
        
        // Filter out whispers unless requested
        if (!includeWhispers) {
            messages = messages.filter(msg => !msg.data.whisper || msg.data.whisper.length === 0);
        }
        
        // Sort by timestamp and limit
        messages = messages
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, Math.min(limit, 100));
        
        // Format messages
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            worldId: msg.data.worldId || game.world.id,
            userId: msg.user.id,
            userName: msg.user.name,
            content: msg.content,
            formattedContent: msg.data.content,
            timestamp: msg.timestamp,
            isRoll: msg.isRoll,
            isWhisper: msg.data.whisper && msg.data.whisper.length > 0,
            whisperTo: msg.data.whisper || [],
        }));
        
        res.json({
            success: true,
            data: formattedMessages,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /chat/history:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get chat history',
            code: 500,
        });
    }
});

/**
 * GET /chat/:messageId - Get a specific chat message
 */
router.get('/:messageId', (req, res) => {
    try {
        const { messageId } = req.params;
        
        // Find the message
        const message = game.messages.get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found',
                code: 404,
            });
        }
        
        res.json({
            success: true,
            data: {
                id: message.id,
                worldId: message.data.worldId || game.world.id,
                userId: message.user.id,
                userName: message.user.name,
                content: message.content,
                formattedContent: message.data.content,
                timestamp: message.timestamp,
                isRoll: message.isRoll,
                isWhisper: message.data.whisper && message.data.whisper.length > 0,
                whisperTo: message.data.whisper || [],
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /chat/:messageId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get message: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * DELETE /chat/:messageId - Delete a chat message (GM only)
 */
router.delete('/:messageId', (req, res) => {
    try {
        const { messageId } = req.params;
        const { userId } = req.body;
        
        // Validate user
        const user = game.users.get(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 404,
            });
        }
        
        // Check if user is GM
        if (!user.isGM) {
            return res.status(403).json({
                success: false,
                error: 'Only GMs can delete messages',
                code: 403,
            });
        }
        
        // Find and delete the message
        const message = game.messages.get(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found',
                code: 404,
            });
        }
        
        // Delete the message
        message.delete();
        
        res.json({
            success: true,
            data: {
                id: messageId,
                deleted: true,
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in DELETE /chat/:messageId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to delete message: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /chat/whisper - Send a whisper to specific users
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "content": "Secret message",
 *   "whisperTo": ["user-id-1", "user-id-2"]
 * }
 */
router.post('/whisper', (req, res) => {
    try {
        const { worldId, userId, content, whisperTo = [] } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !content || whisperTo.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, content, whisperTo',
                code: 400,
            });
        }
        
        // Validate world
        const world = game.worlds.get(worldId);
        if (!world) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        // Validate whisper targets
        for (const targetId of whisperTo) {
            const target = game.users.get(targetId);
            if (!target) {
                return res.status(404).json({
                    success: false,
                    error: `User not found: ${targetId}`,
                    code: 404,
                });
            }
        }
        
        // Send the whisper
        sendChatMessage(content, userId, whisperTo);
        
        res.json({
            success: true,
            data: {
                message: 'Whisper sent',
                worldId,
                userId,
                whisperTo,
                timestamp: Date.now(),
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /chat/whisper:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to send whisper: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /chat/emote - Send an emote message
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "content": "does a backflip"
 * }
 */
router.post('/emote', (req, res) => {
    try {
        const { worldId, userId, content } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, content',
                code: 400,
            });
        }
        
        // Send the emote
        sendChatMessage(content, userId, [], true);
        
        res.json({
            success: true,
            data: {
                message: 'Emote sent',
                worldId,
                userId,
                content,
                timestamp: Date.now(),
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /chat/emote:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to send emote: ${error.message}`,
            code: 500,
        });
    }
});

export { router as chatRouter };
