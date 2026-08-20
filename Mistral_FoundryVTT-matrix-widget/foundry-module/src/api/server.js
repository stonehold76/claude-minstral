/**
 * API Server
 * 
 * Sets up and manages the Express server for the module API.
 */

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { MODULE_ID } from '../constants.js';
import { authMiddleware } from './middleware/auth.js';
import { setupRoutes } from './routes/index.js';
import { getConfig } from '../config.js';

// Server instance
let server = null;

/**
 * Start the API server
 * 
 * @param {Object} config - Module configuration
 * @returns {Object} Express server instance
 */
export function startApiServer(config) {
    const app = express();
    const port = config.apiPort || 30001;
    
    // Middleware
    app.use(cors({
        origin: config.corsOrigins === '*' ? '*' : config.corsOrigins?.split(',') || '*',
    }));
    
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ extended: true }));
    
    // Add authentication middleware
    app.use(authMiddleware(config.apiToken));
    
    // Request logging
    app.use((req, res, next) => {
        const logLevel = config.logLevel || 'info';
        if (logLevel === 'debug') {
            console.log(`[${MODULE_ID}] ${req.method} ${req.path}`);
        }
        next();
    });
    
    // Set up routes
    setupRoutes(app);
    
    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(`[${MODULE_ID}] API Error:`, err);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 500,
        });
    });
    
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            code: 404,
        });
    });
    
    // Start server
    server = app.listen(port, () => {
        console.log(`[${MODULE_ID}] API server listening on port ${port}`);
        console.log(`[${MODULE_ID}] API token: ${config.apiToken ? '*** (set)' : '(not set - generate one)'}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
        console.error(`[${MODULE_ID}] API server error:`, error);
    });
    
    return server;
}

/**
 * Stop the API server
 */
export function stopApiServer() {
    if (server) {
        server.close(() => {
            console.log(`[${MODULE_ID}] API server stopped`);
        });
        server = null;
    }
}

/**
 * Get the server instance
 */
export function getServer() {
    return server;
}

/**
 * Check if server is running
 */
export function isServerRunning() {
    return server !== null;
}
