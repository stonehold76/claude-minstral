/**
 * Users Routes
 * 
 * Provides endpoints for managing and querying users.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';

const router = Router();

/**
 * GET /users - Get all users
 */
router.get('/', (req, res) => {
    try {
        const users = game.users.map(user => ({
            id: user.id,
            name: user.name,
            isGM: user.isGM,
            avatar: user.avatar,
            color: user.color,
            active: user.active,
        }));
        
        res.json({
            success: true,
            data: users,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /users:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get users',
            code: 500,
        });
    }
});

/**
 * GET /users/:userId - Get a specific user
 */
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const user = game.users.get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 404,
            });
        }
        
        const userData = {
            id: user.id,
            name: user.name,
            isGM: user.isGM,
            avatar: user.avatar,
            color: user.color,
            active: user.active,
        };
        
        res.json({
            success: true,
            data: userData,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /users/:userId:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user',
            code: 500,
        });
    }
});

/**
 * GET /users/:userId/current-world - Get current world for a user
 */
router.get('/:userId/current-world', (req, res) => {
    try {
        const { userId } = req.params;
        const user = game.users.get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 404,
            });
        }
        
        // Get the current world for this user
        // In Foundry, users can be in multiple worlds, but we'll return the current one
        const currentWorld = game.world;
        
        res.json({
            success: true,
            data: {
                worldId: currentWorld.id,
                worldTitle: currentWorld.title,
            },
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /users/:userId/current-world:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current world',
            code: 500,
        });
    }
});

/**
 * GET /users/:userId/characters - Get characters for a user
 */
router.get('/:userId/characters', (req, res) => {
    try {
        const { userId } = req.params;
        const user = game.users.get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 404,
            });
        }
        
        // Get all actors owned by this user
        const characters = game.actors.filter(actor => {
            // Check if user is the owner or has permission
            return actor.isOwner && actor.data.owner === userId;
        }).map(actor => ({
            id: actor.id,
            name: actor.name,
            type: actor.type,
            system: actor.system,
            img: actor.img,
        }));
        
        res.json({
            success: true,
            data: characters,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /users/:userId/characters:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get characters',
            code: 500,
        });
    }
});

export { router as usersRouter };
