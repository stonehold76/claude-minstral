/**
 * Chat Integration
 * 
 * Handles chat messages and provides utilities for sending messages.
 */

import { MODULE_ID } from '../constants.js';

/**
 * Handle chat message creation
 * 
 * @param {Object} message - Chat message
 * @param {Object} options - Creation options
 * @param {string} userId - User ID who created the message
 */
export function handleChatMessage(message, options, userId) {
    try {
        // Don't process our own messages
        if (message.flags?.[MODULE_ID]?.fromBridge) {
            return;
        }
        
        // Check if this is a command for the bridge
        if (isBridgeCommand(message.content)) {
            handleBridgeCommand(message, userId);
            return;
        }
        
        // Emit chat message event for API
        if (game.socket) {
            game.socket.emit(`module.${MODULE_ID}`, {
                type: 'chatMessage',
                data: {
                    id: message.id,
                    worldId: message.data.worldId || game.world.id,
                    userId: userId,
                    userName: message.user?.name || 'Unknown',
                    content: message.content,
                    formattedContent: message.data.content,
                    timestamp: message.timestamp,
                    isRoll: message.isRoll,
                    isWhisper: message.data.whisper?.length > 0,
                },
            });
        }
        
        console.log(`[${MODULE_ID}] Chat message: ${userId} - ${message.content.substring(0, 50)}...`);
    } catch (error) {
        console.error(`[${MODULE_ID}] Error handling chat message:`, error);
    }
}

/**
 * Check if a message is a bridge command
 * 
 * @param {string} content - Message content
 * @returns {boolean} Whether it's a bridge command
 */
function isBridgeCommand(content) {
    // Commands start with !matrix or @MatrixBridge
    return content.startsWith('!matrix') || 
           content.startsWith('@MatrixBridge') ||
           content.includes(`@${MODULE_ID}`);
}

/**
 * Handle bridge-specific commands
 * 
 * @param {Object} message - Chat message
 * @param {string} userId - User ID
 */
function handleBridgeCommand(message, userId) {
    const content = message.content.trim();
    
    // Remove mention
    let command = content;
    if (content.startsWith(`@${MODULE_ID}`)) {
        command = content.substring(`@${MODULE_ID}`.length).trim();
    } else if (content.startsWith('!matrix')) {
        command = content.substring('!matrix'.length).trim();
    }
    
    // Parse command
    const parts = command.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    console.log(`[${MODULE_ID}] Bridge command: ${cmd} ${args.join(' ')}`);
    
    // Handle different commands
    switch (cmd) {
        case 'help':
            sendHelpMessage(userId);
            break;
        case 'roll':
        case 'r':
            handleRollCommand(userId, args);
            break;
        case 'check':
            handleCheckCommand(userId, args);
            break;
        case 'status':
            sendStatusMessage(userId);
            break;
        case 'ping':
            sendPongMessage(userId);
            break;
        default:
            sendUnknownCommandMessage(userId, cmd);
    }
}

/**
 * Send a chat message
 * 
 * @param {string} content - Message content
 * @param {string} userId - User ID to send as
 * @param {string[]} whisperTo - User IDs to whisper to
 * @param {boolean} isEmote - Whether this is an emote
 * @returns {Promise<Object>} Created message
 */
export function sendChatMessage(content, userId, whisperTo = [], isEmote = false) {
    try {
        const messageData = {
            speaker: {
                user: userId,
            },
            content,
            whisper: whisperTo.length > 0 ? whisperTo : undefined,
            type: isEmote ? CONST.CHAT_MESSAGE_TYPES.EMOTE : CONST.CHAT_MESSAGE_TYPES.CHAT,
            flags: {
                [MODULE_ID]: {
                    fromBridge: true,
                },
            },
        };
        
        return ChatMessage.create(messageData);
    } catch (error) {
        console.error(`[${MODULE_ID}] Error sending chat message:`, error);
        throw error;
    }
}

/**
 * Send a formatted chat message
 * 
 * @param {string} formattedContent - HTML formatted content
 * @param {string} plainContent - Plain text content
 * @param {string} userId - User ID to send as
 * @param {string[]} whisperTo - User IDs to whisper to
 * @returns {Promise<Object>} Created message
 */
export function sendFormattedMessage(formattedContent, plainContent, userId, whisperTo = []) {
    try {
        const messageData = {
            speaker: {
                user: userId,
            },
            content: plainContent,
            formattedContent,
            whisper: whisperTo.length > 0 ? whisperTo : undefined,
            flags: {
                [MODULE_ID]: {
                    fromBridge: true,
                },
            },
        };
        
        return ChatMessage.create(messageData);
    } catch (error) {
        console.error(`[${MODULE_ID}] Error sending formatted message:`, error);
        throw error;
    }
}

/**
 * Send help message
 * 
 * @param {string} userId - User ID to send to
 */
function sendHelpMessage(userId) {
    const helpText = `
        <h3>Matrix Bridge Commands</h3>
        <ul>
            <li><strong>!matrix help</strong> - Show this help</li>
            <li><strong>!matrix roll &lt;expression&gt;</strong> - Roll dice (e.g., !matrix roll 1d20+5)</li>
            <li><strong>!matrix check &lt;skill&gt; [dc]</strong> - Skill check (e.g., !matrix check stealth 15)</li>
            <li><strong>!matrix status</strong> - Show bridge status</li>
            <li><strong>!matrix ping</strong> - Test connection</li>
        </ul>
    `;
    
    sendFormattedMessage(
        helpText,
        'Matrix Bridge Commands: !matrix help, !matrix roll, !matrix check, !matrix status, !matrix ping',
        userId,
        []
    );
}

/**
 * Handle roll command
 * 
 * @param {string} userId - User ID
 * @param {string[]} args - Command arguments
 */
function handleRollCommand(userId, args) {
    if (args.length === 0) {
        sendChatMessage(
            'Usage: !matrix roll <expression> (e.g., !matrix roll 1d20+5)',
            userId,
            []
        );
        return;
    }
    
    const expression = args.join(' ');
    
    try {
        // Import rollDice dynamically to avoid circular dependency
        import('./dice.js').then(module => {
            const result = module.rollDice(expression, userId, game.world.id, [], false);
            
            // Send result as message
            sendChatMessage(
                `Rolled: ${expression} = ${result.total}`,
                userId,
                []
            );
        });
    } catch (error) {
        sendChatMessage(
            `Error rolling dice: ${error.message}`,
            userId,
            []
        );
    }
}

/**
 * Handle check command
 * 
 * @param {string} userId - User ID
 * @param {string[]} args - Command arguments
 */
function handleCheckCommand(userId, args) {
    if (args.length === 0) {
        sendChatMessage(
            'Usage: !matrix check <skill|ability> [dc] (e.g., !matrix check stealth 15)',
            userId,
            []
        );
        return;
    }
    
    const checkType = args[0].toLowerCase();
    const dc = args.length > 1 ? parseInt(args[1]) : undefined;
    
    // Check if this is a skill or ability
    const skills = ['acrobatics', 'animal handling', 'arcana', 'athletics', 'deception', 
                    'history', 'insight', 'intimidation', 'investigation', 'medicine',
                    'nature', 'perception', 'performance', 'persuasion', 'religion',
                    'sleight of hand', 'stealth', 'survival'];
    
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha',
                       'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    
    try {
        // Import check functions dynamically
        import('./checks.js').then(module => {
            if (skills.includes(checkType)) {
                // Skill check
                const result = module.performSkillCheck(userId, null, checkType, dc);
                sendChatMessage(
                    `${checkType} check: ${result.total}` + (dc ? ` vs DC ${dc}` : ''),
                    userId,
                    []
                );
            } else if (abilities.includes(checkType)) {
                // Ability check
                const result = module.performAbilityCheck(userId, null, checkType, dc);
                sendChatMessage(
                    `${checkType.toUpperCase()} check: ${result.total}` + (dc ? ` vs DC ${dc}` : ''),
                    userId,
                    []
                );
            } else {
                sendChatMessage(
                    `Unknown skill/ability: ${checkType}`,
                    userId,
                    []
                );
            }
        });
    } catch (error) {
        sendChatMessage(
            `Error performing check: ${error.message}`,
            userId,
            []
        );
    }
}

/**
 * Send status message
 * 
 * @param {string} userId - User ID to send to
 */
function sendStatusMessage(userId) {
    const config = globalThis.MatrixBridge?.getConfig?.() || {};
    
    const status = `
        <h3>Matrix Bridge Status</h3>
        <ul>
            <li><strong>Module:</strong> ${MODULE_ID} v1.0.0</li>
            <li><strong>API:</strong> ${config.apiEnabled ? 'Enabled' : 'Disabled'}</li>
            <li><strong>Port:</strong> ${config.apiPort || 'Not set'}</li>
            <li><strong>World:</strong> ${game.world.title}</li>
            <li><strong>Users:</strong> ${game.users.size}</li>
        </ul>
    `;
    
    sendFormattedMessage(
        status,
        `Matrix Bridge Status: Module running, API ${config.apiEnabled ? 'Enabled' : 'Disabled'}, Port ${config.apiPort || 'Not set'}`,
        userId,
        []
    );
}

/**
 * Send pong message
 * 
 * @param {string} userId - User ID to send to
 */
function sendPongMessage(userId) {
    sendChatMessage('Pong!', userId, []);
}

/**
 * Send unknown command message
 * 
 * @param {string} userId - User ID to send to
 * @param {string} command - Unknown command
 */
function sendUnknownCommandMessage(userId, command) {
    sendChatMessage(
        `Unknown command: ${command}. Type !matrix help for available commands.`,
        userId,
        []
    );
}

/**
 * Send a message from the Matrix bridge (marked as from bridge)
 * 
 * @param {string} content - Message content
 * @param {string} userId - User ID to send as (optional)
 * @param {string[]} whisperTo - User IDs to whisper to
 * @returns {Promise<Object>} Created message
 */
export function sendBridgeMessage(content, userId, whisperTo = []) {
    return sendChatMessage(content, userId || 'matrix-bridge', whisperTo);
}
