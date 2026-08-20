/**
 * Items Routes
 * 
 * Provides endpoints for querying and managing items (equipment, weapons, etc.).
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';

const router = Router();

/**
 * POST /items/search - Search for items
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "characterId": "character-id" (optional - search in character's inventory),
 *   "itemId": "item-id" (optional - get specific item),
 *   "itemName": "Longsword" (optional - search by name),
 *   "type": "weapon" (optional - filter by type),
 *   "limit": 10 (optional - limit results)
 * }
 */
router.post('/search', (req, res) => {
    try {
        const { worldId, characterId, itemId, itemName, type, limit = 50 } = req.body;
        
        // Validate world
        if (worldId) {
            const world = game.worlds.get(worldId);
            if (!world) {
                return res.status(404).json({
                    success: false,
                    error: 'World not found',
                    code: 404,
                });
            }
        }
        
        let items = [];
        
        // If searching in a specific character's inventory
        if (characterId) {
            const character = game.actors.get(characterId);
            if (!character) {
                return res.status(404).json({
                    success: false,
                    error: 'Character not found',
                    code: 404,
                });
            }
            items = character.items || [];
        } else {
            // Search all items in the world
            items = game.items || [];
        }
        
        // Filter by item ID if specified
        if (itemId) {
            items = items.filter(item => item.id === itemId);
        }
        
        // Filter by name if specified
        if (itemName) {
            const searchTerm = itemName.toLowerCase();
            items = items.filter(item => 
                item.name.toLowerCase().includes(searchTerm)
            );
        }
        
        // Filter by type if specified
        if (type) {
            items = items.filter(item => item.type === type);
        }
        
        // Limit results
        items = items.slice(0, Math.min(limit, 100));
        
        // Format the results
        const results = items.map(item => formatItem(item));
        
        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /items/search:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to search items: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /items/:itemId - Get a specific item
 */
router.get('/:itemId', (req, res) => {
    try {
        const { itemId } = req.params;
        const { worldId } = req.query;
        
        // Find the item
        let item = game.items.get(itemId);
        
        // If not found in global items, search in all actors
        if (!item) {
            for (const actor of game.actors) {
                const foundItem = actor.items.get(itemId);
                if (foundItem) {
                    item = foundItem;
                    break;
                }
            }
        }
        
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
                code: 404,
            });
        }
        
        // Check world if specified
        if (worldId) {
            const world = game.worlds.get(worldId);
            if (!world || (item.data && item.data.worldId !== worldId)) {
                return res.status(404).json({
                    success: false,
                    error: 'Item not found in specified world',
                    code: 404,
                });
            }
        }
        
        res.json({
            success: true,
            data: formatItem(item),
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /items/:itemId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get item: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /items/types - Get list of available item types
 */
router.get('/types', (req, res) => {
    try {
        // Get all unique item types
        const types = new Set();
        
        for (const item of game.items) {
            if (item.type) {
                types.add(item.type);
            }
        }
        
        // Also check actor items
        for (const actor of game.actors) {
            for (const item of actor.items) {
                if (item.type) {
                    types.add(item.type);
                }
            }
        }
        
        res.json({
            success: true,
            data: Array.from(types),
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /items/types:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get item types',
            code: 500,
        });
    }
});

/**
 * GET /items/equipment/:characterId - Get equipment for a character
 */
router.get('/equipment/:characterId', (req, res) => {
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
        
        // Get equipment items (type is 'equipment' or 'weapon' or 'armor' etc.)
        const equipmentTypes = ['weapon', 'equipment', 'armor', 'tool', 'consumable'];
        const items = character.items.filter(item => 
            equipmentTypes.includes(item.type)
        );
        
        const results = items.map(item => formatItem(item));
        
        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /items/equipment/:characterId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get equipment: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /items/weapons/:characterId - Get weapons for a character
 */
router.get('/weapons/:characterId', (req, res) => {
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
        
        // Get weapon items
        const items = character.items.filter(item => item.type === 'weapon');
        
        const results = items.map(item => formatItem(item));
        
        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /items/weapons/:characterId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get weapons: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * Format an item for API response
 * 
 * @param {Object} item - Item object
 * @returns {Object} Formatted item
 */
function formatItem(item) {
    return {
        id: item.id,
        name: item.name,
        type: item.type,
        img: item.img,
        data: item.system || {},
        ownerId: item.data?.ownerId || null,
        worldId: item.data?.worldId || null,
        timestamp: Date.now(),
    };
}

export { router as itemsRouter };
