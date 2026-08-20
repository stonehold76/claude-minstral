/**
 * Characters Routes
 * 
 * Provides endpoints for querying character data.
 * This is SYSTEM-AGNOSTIC and works with any FoundryVTT game system.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';

const router = Router();

/**
 * POST /characters/get - Get character data
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "characterId": "character-id",
 *   "fields": ["name", "system.attributes.hp"] (optional - specific paths to extract)
 * }
 * 
 * Returns the character's data. The structure depends on the game system.
 */
router.post('/get', (req, res) => {
    try {
        const { worldId, characterId, fields = [] } = req.body;
        
        // Validate required fields
        if (!worldId || !characterId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, characterId',
                code: 400,
            });
        }
        
        // Get the world
        const world = game.worlds.get(worldId);
        if (!world) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        // Get the character
        const character = game.actors.get(characterId);
        if (!character) {
            return res.status(404).json({
                success: false,
                error: 'Character not found',
                code: 404,
            });
        }
        
        // Extract the requested data
        const characterData = extractCharacterData(character, fields);
        
        res.json({
            success: true,
            data: {
                id: character.id,
                name: character.name,
                type: character.type,
                system: game.world.system, // The game system (e.g., "alienrpg", "dnd5e")
                data: characterData,
                timestamp: Date.now(),
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /characters/get:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get character: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /characters - Get all characters in the current world
 * 
 * Query parameters:
 * - worldId: Specific world ID (optional, defaults to current world)
 * - type: Filter by character type (optional)
 */
router.get('/', (req, res) => {
    try {
        const { worldId, type } = req.query;
        const targetWorld = worldId ? game.worlds.get(worldId) : game.world;
        
        if (!targetWorld) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        // Get all characters
        const characters = game.actors.filter(actor => {
            // Filter by world
            if (actor.data.worldId !== targetWorld.id) return false;
            // Filter by type if specified
            if (type && actor.type !== type) return false;
            return true;
        }).map(actor => ({
            id: actor.id,
            name: actor.name,
            type: actor.type,
            system: game.world.system,
            img: actor.img,
            ownerId: actor.data.owner,
            permission: actor.permission,
        }));
        
        res.json({
            success: true,
            data: characters,
            system: game.world.system,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /characters:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get characters',
            code: 500,
        });
    }
});

/**
 * GET /characters/:characterId - Get a specific character
 * 
 * Query parameters:
 * - worldId: Specific world ID (optional)
 * - fields: Comma-separated list of fields to extract (optional)
 */
router.get('/:characterId', (req, res) => {
    try {
        const { characterId } = req.params;
        const { worldId, fields = '' } = req.query;
        const fieldArray = fields ? fields.split(',') : [];
        
        // Get the character
        const character = game.actors.get(characterId);
        if (!character) {
            return res.status(404).json({
                success: false,
                error: 'Character not found',
                code: 404,
            });
        }
        
        // Check world if specified
        if (worldId) {
            const world = game.worlds.get(worldId);
            if (!world || character.data.worldId !== worldId) {
                return res.status(404).json({
                    success: false,
                    error: 'Character not found in specified world',
                    code: 404,
                });
            }
        }
        
        // Extract the requested data
        const characterData = extractCharacterData(character, fieldArray);
        
        res.json({
            success: true,
            data: {
                id: character.id,
                name: character.name,
                type: character.type,
                system: game.world.system,
                data: characterData,
                timestamp: Date.now(),
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /characters/:characterId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get character: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /characters/:characterId/system - Get character's full system data
 * 
 * Returns the complete system data for the character, which contains all
 * game-system-specific attributes, skills, etc.
 */
router.get('/:characterId/system', (req, res) => {
    try {
        const { characterId } = req.params;
        
        // Get the character
        const character = game.actors.get(characterId);
        if (!character) {
            return res.status(404).json({
                success: false,
                error: 'Character not found',
                code: 404,
            });
        }
        
        res.json({
            success: true,
            data: {
                id: character.id,
                name: character.name,
                type: character.type,
                system: game.world.system,
                systemData: character.system || {},
                timestamp: Date.now(),
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /characters/:characterId/system:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get character system data: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /characters/:characterId/attributes - Get all system attributes for a character
 * 
 * This is SYSTEM-AGNOSTIC - returns whatever attributes the character's
 * game system defines.
 */
router.get('/:characterId/attributes', (req, res) => {
    try {
        const { characterId } = req.params;
        
        // Get the character
        const character = game.actors.get(characterId);
        if (!character) {
            return res.status(404).json({
                success: false,
                error: 'Character not found',
                code: 404,
            });
        }
        
        // Get the system data
        const systemData = character.system || {};
        
        // Extract all attributes - this works with any system
        const attributes = extractAllAttributes(systemData);
        
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
        console.error(`[${MODULE_ID}] Error in GET /characters/:characterId/attributes:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get attributes: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * Extract character data based on requested fields
 * Supports nested paths like "system.attributes.hp.value"
 * 
 * @param {Object} character - Character object
 * @param {string[]} fields - Fields to extract
 * @returns {Object} Extracted data
 */
function extractCharacterData(character, fields) {
    if (fields.length === 0) {
        // Return all data if no specific fields requested
        return character.data || {};
    }
    
    const data = {};
    
    for (const field of fields) {
        const path = field.split('.');
        let value = character;
        
        for (const part of path) {
            if (value && value[part] !== undefined) {
                value = value[part];
            } else {
                value = null;
                break;
            }
        }
        
        // Set the value at the field path
        let current = data;
        for (let i = 0; i < path.length - 1; i++) {
            const part = path[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        current[path[path.length - 1]] = value;
    }
    
    return data;
}

/**
 * Extract all attributes from system data
 * This recursively traverses the system object to find all attributes
 * that could be used for checks.
 * 
 * @param {Object} systemData - The character's system data
 * @param {string} prefix - Current path prefix
 * @returns {Object} All attributes found
 */
function extractAllAttributes(systemData, prefix = '') {
    const attributes = {};
    
    if (!systemData || typeof systemData !== 'object') {
        return attributes;
    }
    
    for (const [key, value] of Object.entries(systemData)) {
        const path = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null) {
            // Recursively extract nested attributes
            const nested = extractAllAttributes(value, path);
            Object.assign(attributes, nested);
            
            // Also check if this object has numeric values we should include
            if ('value' in value || 'mod' in value || 'modifier' in value || 'total' in value) {
                attributes[path] = value;
            }
        } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
            // Include primitive values
            attributes[path] = value;
        }
    }
    
    return attributes;
}

export { router as charactersRouter };
