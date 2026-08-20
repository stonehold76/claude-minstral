/**
 * Worlds Routes
 * 
 * Provides endpoints for managing and querying worlds.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';

const router = Router();

/**
 * GET /worlds - Get all worlds
 */
router.get('/', (req, res) => {
    try {
        // Get all worlds from Foundry
        const worlds = game.worlds.map(world => ({
            id: world.id,
            title: world.title,
            system: world.system,
            isActive: world.active,
            players: getWorldPlayers(world.id),
            gmIds: getWorldGmIds(world.id),
        }));
        
        res.json({
            success: true,
            data: worlds,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /worlds:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get worlds',
            code: 500,
        });
    }
});

/**
 * GET /worlds/:worldId - Get a specific world
 */
router.get('/:worldId', (req, res) => {
    try {
        const { worldId } = req.params;
        const world = game.worlds.get(worldId);
        
        if (!world) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        const worldData = {
            id: world.id,
            title: world.title,
            system: world.system,
            isActive: world.active,
            players: getWorldPlayers(worldId),
            gmIds: getWorldGmIds(worldId),
        };
        
        res.json({
            success: true,
            data: worldData,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /worlds/:worldId:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get world',
            code: 500,
        });
    }
});

/**
 * GET /worlds/:worldId/users - Get users in a world
 */
router.get('/:worldId/users', (req, res) => {
    try {
        const { worldId } = req.params;
        const world = game.worlds.get(worldId);
        
        if (!world) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        const users = getWorldPlayers(worldId);
        
        res.json({
            success: true,
            data: users,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /worlds/:worldId/users:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get world users',
            code: 500,
        });
    }
});

/**
 * Gets players for a world
 * 
 * @param {string} worldId - The world ID
 * @returns {Array} Array of player objects
 */
function getWorldPlayers(worldId) {
    const world = game.worlds.get(worldId);
    if (!world) return [];
    
    return world.users.map(user => ({
        id: user.id,
        name: user.name,
        isGM: user.isGM,
        avatar: user.avatar,
        color: user.color,
    }));
}

/**
 * Gets GM IDs for a world
 * 
 * @param {string} worldId - The world ID
 * @returns {Array} Array of GM user IDs
 */
function getWorldGmIds(worldId) {
    const world = game.worlds.get(worldId);
    if (!world) return [];
    
    return world.users.filter(user => user.isGM).map(user => user.id);
}

export { router as worldsRouter };
