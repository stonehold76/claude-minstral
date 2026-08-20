/**
 * Dice Routes
 * 
 * Provides endpoints for rolling dice using Foundry's dice roller.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';
import { rollDice } from '../../foundry/dice.js';

const router = Router();

/**
 * POST /dice/roll - Execute a dice roll
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "expression": "1d20 + 5",
 *   "whisperTo": ["user-id-1", "user-id-2"],
 *   "blind": false
 * }
 */
router.post('/roll', (req, res) => {
    try {
        const { worldId, userId, expression, whisperTo = [], blind = false } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !expression) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, expression',
                code: 400,
            });
        }
        
        // Validate expression
        if (typeof expression !== 'string' || expression.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Invalid expression: must be a non-empty string',
                code: 400,
            });
        }
        
        // Roll the dice
        const result = rollDice(expression, userId, worldId, whisperTo, blind);
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /dice/roll:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to roll dice: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /dice/evaluate - Evaluate a dice expression without creating a chat message
 * 
 * Request body:
 * {
 *   "expression": "1d20 + 5"
 * }
 */
router.post('/evaluate', (req, res) => {
    try {
        const { expression } = req.body;
        
        if (!expression) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: expression',
                code: 400,
            });
        }
        
        // Create a roll and evaluate it
        const roll = new Roll(expression);
        const result = roll.roll();
        
        res.json({
            success: true,
            data: {
                expression,
                result: roll.total,
                rolls: result.rolls,
                formula: roll.formula,
                terms: roll.terms.map(t => ({
                    type: t.constructor.name,
                    value: t.value,
                    evaluated: t.evaluated,
                })),
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /dice/evaluate:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to evaluate expression: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /dice/history - Get recent dice rolls (from chat)
 */
router.get('/history', (req, res) => {
    try {
        const { limit = 10, worldId } = req.query;
        
        // Get recent chat messages that are dice rolls
        const messages = game.messages.filter(msg => {
            return msg.isRoll && (!worldId || msg.data.worldId === worldId);
        }).slice(-Math.min(limit, 100));
        
        const rolls = messages.map(msg => ({
            id: msg.id,
            userId: msg.user.id,
            worldId: msg.data.worldId,
            expression: msg.data.content,
            result: msg.data.roll.total,
            rolls: msg.data.roll.rolls,
            timestamp: msg.timestamp,
        }));
        
        res.json({
            success: true,
            data: rolls,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /dice/history:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get dice history',
            code: 500,
        });
    }
});

export { router as diceRouter };
