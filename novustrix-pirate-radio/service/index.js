/**
 * Novustrix Pirate Radio Service - Main Entry Point
 * 
 * This service receives audio from Matrix widgets via WebSocket
 * and streams it to an Icecast server for internet radio broadcasting.
 * 
 * Architecture:
 *   Matrix Widget (Browser) 
 *   -> WebSocket (this service)
 *   -> FFmpeg (audio encoding)
 *   -> Icecast (streaming server)
 *   -> Internet Radio Listeners
 */

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config');
const webSocketManager = require('./websocket');
const icecastClient = require('./icecast');
const queueManager = require('./queue');
const pino = require('pino');

// Initialize logger
const logger = pino({ 
    level: config.logLevel,
    name: 'pirate-radio-service',
    timestamp: pino.stdTimeFunctions.isoTime
});

// Create Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        icecast: icecastClient.getStats(),
        connections: webSocketManager.getConnectionCount(),
        rooms: queueManager.getRooms().length,
        queue: queueManager.getRooms().reduce((acc, roomId) => {
            acc[roomId] = queueManager.getQueue(roomId).length;
            return acc;
        }, {})
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    const rooms = queueManager.getRooms().map(roomId => {
        const state = queueManager.getRoomState(roomId);
        return {
            roomId,
            ...state
        };
    });
    
    res.json({
        rooms,
        icecast: icecastClient.getStats(),
        connections: webSocketManager.getConnectionCount()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Novustrix Pirate Radio Service',
        version: '1.0.0',
        description: 'Matrix widget broadcast service for Icecast streaming',
        endpoints: {
            health: '/health',
            stats: '/stats',
            websocket: '/ws'
        },
        docs: 'See README.md for usage instructions'
    });
});

// Initialize WebSocket server
webSocketManager.init(server);

// Start server
const startServer = async () => {
    try {
        // Check FFmpeg availability
        const ffmpegOk = await icecastClient.checkFFmpeg();
        if (!ffmpegOk) {
            logger.error('FFmpeg is required but not found. Please install FFmpeg.');
            logger.error('On Ubuntu: sudo apt install ffmpeg');
            logger.error('On macOS: brew install ffmpeg');
        }
        
        // Start listening
        server.listen(config.port, config.host, () => {
            logger.info(`Novustrix Pirate Radio Service v1.0.0`);
            logger.info(`========================================`);
            logger.info(`Server running at http://${config.host}:${config.port}`);
            logger.info(`WebSocket endpoint: ws://${config.host}:${config.port}/ws`);
            logger.info(`Icecast target: ${config.icecast.url}`);
            logger.info(`Audio format: ${config.audio.format} @ ${config.audio.bitrate} kbps`);
            logger.info(`FFmpeg: ${ffmpegOk ? 'Available' : 'NOT FOUND'}`);
            logger.info(`CORS origins: ${config.cors.origins.join(', ')}`);
            logger.info(`Log level: ${config.logLevel}`);
            logger.info(`========================================`);
        });
        
        // Handle server errors
        server.on('error', (error) => {
            logger.error('Server error:', error);
        });
        
        // Handle graceful shutdown
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
async function gracefulShutdown() {
    logger.info('Shutting down gracefully...');
    
    try {
        // Stop Icecast stream
        if (icecastClient.isRunning) {
            await icecastClient.stop();
        }
        
        // Close WebSocket server
        webSocketManager.close();
        
        // Close HTTP server
        if (server) {
            server.close(() => {
                logger.info('Server closed');
            });
        }
        
        logger.info('Shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Start the server
startServer();

module.exports = { app, server, webSocketManager, icecastClient, queueManager };
