/**
 * API Routes Index
 * 
 * Sets up all API routes for the module.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';
import { infoRouter } from './info.js';
import { worldsRouter } from './worlds.js';
import { usersRouter } from './users.js';
import { diceRouter } from './dice.js';
import { checksRouter } from './checks.js';
import { charactersRouter } from './characters.js';
import { itemsRouter } from './items.js';
import { chatRouter } from './chat.js';
import { eventsRouter } from './events.js';

/**
 * Sets up all API routes
 * 
 * @param {Object} app - Express application
 */
export function setupRoutes(app) {
    const router = Router();
    
    // Mount sub-routers
    router.use('/info', infoRouter);
    router.use('/worlds', worldsRouter);
    router.use('/users', usersRouter);
    router.use('/dice', diceRouter);
    router.use('/checks', checksRouter);
    router.use('/characters', charactersRouter);
    router.use('/items', itemsRouter);
    router.use('/chat', chatRouter);
    router.use('/events', eventsRouter);
    
    // Health check endpoint
    router.get('/health', (req, res) => {
        res.json({
            success: true,
            status: 'healthy',
            timestamp: Date.now(),
        });
    });
    
    // Root endpoint
    router.get('/', (req, res) => {
        res.json({
            success: true,
            message: `${MODULE_ID} API is running`,
            version: '1.0.0',
            endpoints: [
                '/info',
                '/worlds',
                '/users',
                '/dice',
                '/checks',
                '/characters',
                '/items',
                '/chat',
                '/events',
            ],
        });
    });
    
    // Mount router on base path
    app.use(`/api/${MODULE_ID}`, router);
}
