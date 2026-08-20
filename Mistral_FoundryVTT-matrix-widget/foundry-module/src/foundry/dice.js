/**
 * Dice Roller Integration
 * 
 * Handles dice rolling with Foundry's Roll class and creates chat messages.
 */

import { MODULE_ID } from '../constants.js';

/**
 * Roll dice and create a chat message
 * 
 * @param {string} expression - Dice expression to roll
 * @param {string} userId - User ID who is rolling
 * @param {string} worldId - World ID
 * @param {string[]} whisperTo - User IDs to whisper to
 * @param {boolean} blind - Whether the roll is blind
 * @returns {Object} Roll result
 */
export function rollDice(expression, userId, worldId, whisperTo = [], blind = false) {
    try {
        // Validate expression
        if (!expression || typeof expression !== 'string') {
            throw new Error('Invalid dice expression');
        }
        
        // Create and roll the dice
        const roll = new Roll(expression);
        const result = roll.roll();
        
        // Get the user
        const user = game.users.get(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        
        // Get the world
        const world = game.worlds.get(worldId);
        if (!world) {
            throw new Error(`World not found: ${worldId}`);
        }
        
        // Create chat message data
        const messageData = {
            speaker: {
                user: userId,
            },
            content: `/r ${expression}`,
            roll: result,
            whisper: whisperTo.length > 0 ? whisperTo : undefined,
            blind: blind,
        };
        
        // Send to chat (this will trigger the dice roll in Foundry)
        ChatMessage.create(messageData);
        
        // Return the result
        const rollResult = {
            id: result.id,
            userId,
            worldId,
            expression,
            result: roll.total,
            rolls: result.rolls,
            whisperTo,
            blind,
            timestamp: Date.now(),
        };
        
        console.log(`[${MODULE_ID}] Dice rolled: ${user.name} rolled ${expression} = ${roll.total}`);
        
        return rollResult;
    } catch (error) {
        console.error(`[${MODULE_ID}] Error rolling dice:`, error);
        throw error;
    }
}

/**
 * Evaluate a dice expression without creating a chat message
 * 
 * @param {string} expression - Dice expression to evaluate
 * @returns {Object} Evaluation result
 */
export function evaluateDice(expression) {
    try {
        const roll = new Roll(expression);
        const result = roll.roll();
        
        return {
            expression,
            result: roll.total,
            rolls: result.rolls,
            formula: roll.formula,
            terms: roll.terms.map(t => ({
                type: t.constructor.name,
                value: t.value,
                evaluated: t.evaluated,
            })),
            timestamp: Date.now(),
        };
    } catch (error) {
        console.error(`[${MODULE_ID}] Error evaluating dice:`, error);
        throw error;
    }
}

/**
 * Handle dice roll events from Foundry
 * 
 * @param {Object} message - Chat message
 * @param {Object} roll - Roll object
 */
export function handleDiceRoll(message, roll) {
    // Only process rolls from players
    if (!message.isRoll || !message.user) {
        return;
    }
    
    const userId = message.user.id;
    const worldId = game.world.id;
    const expression = message.content.match(/\/r\s+(.+)/i)?.[1] || message.content;
    
    console.log(`[${MODULE_ID}] Dice roll event: ${userId} rolled ${expression}`);
    
    // Emit event for API to pick up
    if (game.socket) {
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
}

/**
 * Roll multiple dice expressions at once
 * 
 * @param {Array} expressions - Array of dice expressions
 * @param {string} userId - User ID
 * @param {string} worldId - World ID
 * @returns {Array} Array of roll results
 */
export function rollMultiple(expressions, userId, worldId) {
    const results = [];
    
    for (const expression of expressions) {
        try {
            const result = rollDice(expression, userId, worldId, [], false);
            results.push(result);
        } catch (error) {
            console.error(`[${MODULE_ID}] Error rolling expression "${expression}":`, error);
            results.push({
                expression,
                error: error.message,
            });
        }
    }
    
    return results;
}
