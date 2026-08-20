/**
 * Characters Routes
 * 
 * Provides endpoints for querying and managing character data.
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
 *   "fields": ["name", "system.attributes.hp"] (optional)
 * }
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
                system: character.system,
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
 */
router.get('/', (req, res) => {
    try {
        const { worldId } = req.query;
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
            return actor.type === 'character' && actor.data.worldId === targetWorld.id;
        }).map(actor => ({
            id: actor.id,
            name: actor.name,
            type: actor.type,
            system: actor.system,
            img: actor.img,
            ownerId: actor.data.owner,
            permission: actor.permission,
        }));
        
        res.json({
            success: true,
            data: characters,
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
 */
router.get('/:characterId', (req, res) => {
    try {
        const { characterId } = req.params;
        const { worldId, fields = [] } = req.query;
        
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
        const characterData = extractCharacterData(character, fields);
        
        res.json({
            success: true,
            data: {
                id: character.id,
                name: character.name,
                type: character.type,
                system: character.system,
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
 * GET /characters/:characterId/abilities - Get character abilities
 */
router.get('/:characterId/abilities', (req, res) => {
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
        
        // Get abilities from the character
        const abilities = character.system?.abilities || {};
        
        const abilityData = {};
        for (const [key, value] of Object.entries(abilities)) {
            abilityData[key] = {
                value: value.value || 0,
                mod: value.mod || 0,
                save: value.save || 0,
            };
        }
        
        res.json({
            success: true,
            data: abilityData,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /characters/:characterId/abilities:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get abilities: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /characters/:characterId/skills - Get character skills
 */
router.get('/:characterId/skills', (req, res) => {
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
        
        // Get skills from the character
        const skills = character.system?.skills || {};
        
        const skillData = {};
        for (const [key, value] of Object.entries(skills)) {
            skillData[key] = {
                value: value.value || 0,
                mod: value.mod || 0,
                ability: value.ability || '',
                proficient: value.proficient || false,
            };
        }
        
        res.json({
            success: true,
            data: skillData,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /characters/:characterId/skills:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get skills: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /characters/:characterId/inventory - Get character inventory
 */
router.get('/:characterId/inventory', (req, res) => {
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
        
        // Get inventory from the character
        const items = character.items || [];
        
        const inventory = items.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            img: item.img,
            data: item.system || {},
        }));
        
        res.json({
            success: true,
            data: inventory,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /characters/:characterId/inventory:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get inventory: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * Extract character data based on requested fields
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

export { router as charactersRouter };
