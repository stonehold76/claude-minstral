/**
 * Checks Routes
 * 
 * Provides endpoints for generic checks that work with ANY FoundryVTT game system.
 * This is system-agnostic - it discovers available attributes from the character
 * and allows checking any of them, regardless of the game system.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';
import {
    performAttributeCheck,
    performSavingThrow,
    performSimpleCheck,
    getAvailableChecks,
    discoverCharacterAttributes
} from '../../foundry/checks.js';

const router = Router();

/**
 * POST /checks/attribute - Perform a check on any character attribute
 * 
 * This is SYSTEM-AGNOSTIC and works with any FoundryVTT game system.
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "characterId": "character-id" (optional - if omitted, just rolls dice),
 *   "attribute": "attributes.agility" (path to the attribute in the character system),
 *   "dc": 15 (optional - target number to beat),
 *   "advantage": false (optional),
 *   "disadvantage": false (optional),
 *   "displayName": "Agility" (optional - custom display name)
 * }
 * 
 * Examples for different systems:
 * - Alien RPG: attribute = "attributes.stress", "attributes.composure"
 * - D&D 5e: attribute = "skills.stealth", "abilities.dexterity"
 * - Call of Cthulhu: attribute = "characteristics.str", "skills.persuade"
 */
router.post('/attribute', (req, res) => {
    try {
        const {
            worldId,
            userId,
            characterId,
            attribute,
            dc,
            advantage = false,
            disadvantage = false,
            displayName
        } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !attribute) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, attribute',
                code: 400,
            });
        }
        
        // Validate attribute path
        if (typeof attribute !== 'string' || attribute.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Invalid attribute: must be a non-empty string (e.g., "attributes.agility", "skills.stealth")',
                code: 400,
            });
        }
        
        // Perform the attribute check
        const result = performAttributeCheck(
            userId,
            characterId,
            attribute,
            dc,
            advantage,
            disadvantage,
            displayName
        );
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /checks/attribute:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to perform attribute check: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /checks/save - Perform a saving throw on any attribute
 * 
 * This is SYSTEM-AGNOSTIC - works with any game system's save/resistance mechanics.
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "characterId": "character-id" (optional),
 *   "attribute": "attributes.willpower" (path to the save attribute),
 *   "dc": 15 (required - target number),
 *   "advantage": false (optional),
 *   "disadvantage": false (optional),
 *   "displayName": "Willpower Save" (optional)
 * }
 */
router.post('/save', (req, res) => {
    try {
        const {
            worldId,
            userId,
            characterId,
            attribute,
            dc,
            advantage = false,
            disadvantage = false,
            displayName
        } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !attribute || dc === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, attribute, dc',
                code: 400,
            });
        }
        
        // Validate DC
        if (typeof dc !== 'number' || dc < 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid DC: must be a non-negative number',
                code: 400,
            });
        }
        
        // Perform the saving throw
        const result = performSavingThrow(
            userId,
            characterId,
            attribute,
            dc,
            advantage,
            disadvantage
        );
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /checks/save:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to perform saving throw: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /checks/simple - Perform a simple dice check (no character attributes)
 * 
 * Just rolls the specified dice expression and optionally compares to a target.
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "characterId": "character-id" (optional),
 *   "expression": "1d20 + 5",
 *   "dc": 15 (optional - target number),
 *   "displayName": "Custom Check" (optional)
 * }
 */
router.post('/simple', (req, res) => {
    try {
        const { worldId, userId, characterId, expression, dc, displayName } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !expression) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, expression',
                code: 400,
            });
        }
        
        // Perform the simple check
        const result = performSimpleCheck(userId, characterId, expression, dc);
        
        // Add display name if provided
        if (displayName) {
            result.displayName = displayName;
        }
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /checks/simple:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to perform simple check: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /checks/available/:characterId - Get all available check options for a character
 * 
 * Returns all attributes, skills, saves, and custom attributes that can be checked.
 * This allows the Matrix bridge to present users with valid options for their system.
 * 
 * @param {string} characterId - Character ID
 */
router.get('/available/:characterId', (req, res) => {
    try {
        const { characterId } = req.params;
        
        const result = getAvailableChecks(characterId);
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error,
                code: 404,
            });
        }
        
        res.json(result);
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /checks/available/:characterId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get available checks: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /checks/discover/:characterId - Discover character attributes (detailed)
 * 
 * Performs a deep scan of the character's system data to find all checkable attributes.
 * Returns the full hierarchy of what's available.
 * 
 * @param {string} characterId - Character ID
 */
router.get('/discover/:characterId', (req, res) => {
    try {
        const { characterId } = req.params;
        
        const character = game.actors.get(characterId);
        
        if (!character) {
            return res.status(404).json({
                success: false,
                error: `Character not found: ${characterId}`,
                code: 404,
            });
        }
        
        const attributes = discoverCharacterAttributes(character);
        
        res.json({
            success: true,
            data: {
                characterId,
                characterName: character.name,
                system: game.world.system,
                attributes,
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /checks/discover/:characterId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to discover attributes: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /checks/system - Get current game system information
 * 
 * Returns information about the current game system, which helps
 * the Matrix bridge understand what kind of attributes are available.
 */
router.get('/system', (req, res) => {
    try {
        const world = game.world;
        
        if (!world) {
            return res.status(404).json({
                success: false,
                error: 'No active world',
                code: 404,
            });
        }
        
        res.json({
            success: true,
            data: {
                systemId: world.system,
                systemTitle: world.title,
                systemVersion: world.version,
                worldId: world.id,
                worldTitle: world.title,
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /checks/system:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get system info',
            code: 500,
        });
    }
});

export { router as checksRouter };
