/**
 * Novustrix Pirate Radio Service - WebSocket Handler
 * Manages WebSocket connections from Matrix widgets
 */

const WebSocket = require('ws');
const config = require('./config');
const queueManager = require('./queue');
const icecastClient = require('./icecast');
const pino = require('pino');

const logger = pino({ level: config.logLevel, name: 'websocket' });

// Message types
const MessageTypes = {
    // Client -> Service
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    START_BROADCAST: 'start_broadcast',
    STOP_BROADCAST: 'stop_broadcast',
    AUDIO_CHUNK: 'audio_chunk',
    ICECAST_CONFIG: 'icecast_config',
    GET_STATE: 'get_state',
    PING: 'ping',
    
    // Service -> Client
    ROOM_STATE: 'room_state',
    QUEUE_UPDATE: 'queue_update',
    BROADCAST_START: 'broadcast_start',
    BROADCAST_STOP: 'broadcast_stop',
    STREAM_STATS: 'stream_stats',
    ERROR: 'error',
    PONG: 'pong'
};

/**
 * WebSocket Server Manager
 */
class WebSocketManager {
    constructor() {
        /** @type {WebSocket.Server} */
        this.wss = null;
        
        /** @type {Map<string, Set<WebSocket>>} - roomId -> Set of WebSockets */
        this.roomConnections = new Map();
        
        /** @type {Map<WebSocket, string>} - WebSocket -> roomId */
        this.socketToRoom = new Map();
        
        /** @type {Map<WebSocket, Object>} - WebSocket -> user info */
        this.socketToUser = new Map();
        
        /** @type {Map<string, WebSocket>} - userId -> current broadcaster socket */
        this.broadcasterSockets = new Map();
    }
    
    /**
     * Initialize WebSocket server
     * @param {import('http').Server} httpServer - HTTP server to attach to
     */
    init(httpServer) {
        this.wss = new WebSocket.Server({
            server: httpServer,
            path: '/ws',
            // Enable per-message deflate compression
            perMessageDeflate: {
                zlibDeflateOptions: {
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                clientNoContextTakeover: true,
                serverNoContextTakeover: true
            }
        });
        
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('error', this.handleError.bind(this));
        
        logger.info(`WebSocket server initialized on /ws`);
    }
    
    /**
     * Handle new WebSocket connection
     * @param {WebSocket} ws - WebSocket connection
     * @param {import('http').IncomingMessage} req - HTTP request
     */
    handleConnection(ws, req) {
        const ip = req.socket.remoteAddress || 'unknown';
        logger.info(`New WebSocket connection from ${ip}`);
        
        // Set up message handler
        ws.on('message', (data) => this.handleMessage(ws, data));
        
        // Set up close handler
        ws.on('close', () => this.handleClose(ws));
        
        // Set up error handler
        ws.on('error', (error) => {
            logger.error(`WebSocket error: ${error.message}`);
        });
        
        // Send welcome message
        this.sendMessage(ws, {
            type: MessageTypes.ROOM_STATE,
            data: { message: 'Connected to broadcast service' }
        });
    }
    
    /**
     * Handle WebSocket message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Buffer|string} data - Message data
     */
    async handleMessage(ws, data) {
        try {
            let message;
            
            // Handle binary data (audio chunks)
            if (data instanceof Buffer) {
                const userId = this.socketToUser.get(ws)?.userId;
                const roomId = this.socketToRoom.get(ws);
                
                if (!userId || !roomId) {
                    logger.warn('Received audio chunk from unauthenticated socket');
                    return;
                }
                
                // Check if this user is the current broadcaster
                const currentBroadcaster = queueManager.getCurrentBroadcaster(roomId);
                if (!currentBroadcaster || currentBroadcaster.userId !== userId) {
                    logger.warn(`User ${userId} is not the current broadcaster for room ${roomId}`);
                    return;
                }
                
                // Forward audio to Icecast
                await icecastClient.write(data);
                
                // Broadcast stats update to room
                this.broadcastToRoom(roomId, {
                    type: MessageTypes.STREAM_STATS,
                    data: icecastClient.getStats()
                });
                
                return;
            }
            
            // Handle JSON messages
            try {
                message = JSON.parse(data.toString());
            } catch (e) {
                logger.error('Failed to parse message:', e);
                this.sendError(ws, 'Invalid message format');
                return;
            }
            
            logger.debug('Received message:', message.type);
            
            switch (message.type) {
                case MessageTypes.JOIN_ROOM:
                    await this.handleJoinRoom(ws, message);
                    break;
                    
                case MessageTypes.LEAVE_ROOM:
                    await this.handleLeaveRoom(ws, message);
                    break;
                    
                case MessageTypes.START_BROADCAST:
                    await this.handleStartBroadcast(ws, message);
                    break;
                    
                case MessageTypes.STOP_BROADCAST:
                    await this.handleStopBroadcast(ws, message);
                    break;
                    
                case MessageTypes.GET_STATE:
                    this.handleGetState(ws, message);
                    break;
                    
                case MessageTypes.PING:
                    this.sendMessage(ws, { type: MessageTypes.PONG });
                    break;
                    
                case MessageTypes.ICECAST_CONFIG:
                    this.handleIcecastConfig(ws, message);
                    break;
                    
                default:
                    logger.warn(`Unknown message type: ${message.type}`);
                    this.sendError(ws, `Unknown message type: ${message.type}`);
            }
            
        } catch (error) {
            logger.error('Error handling message:', error);
            this.sendError(ws, `Error: ${error.message}`);
        }
    }
    
    /**
     * Handle JOIN_ROOM message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    async handleJoinRoom(ws, message) {
        const { roomId, userId, displayName } = message.data || {};
        
        if (!roomId || !userId) {
            this.sendError(ws, 'roomId and userId are required');
            return;
        }
        
        // Store user info
        this.socketToUser.set(ws, { userId, displayName: displayName || userId });
        this.socketToRoom.set(ws, roomId);
        
        // Add to room connections
        if (!this.roomConnections.has(roomId)) {
            this.roomConnections.set(roomId, new Set());
        }
        this.roomConnections.get(roomId).add(ws);
        
        // Add user to queue
        queueManager.addToQueue(roomId, userId, displayName || userId);
        
        logger.info(`User ${userId} joined room ${roomId}`);
        
        // Send current room state
        this.sendMessage(ws, {
            type: MessageTypes.ROOM_STATE,
            data: queueManager.getRoomState(roomId)
        });
        
        // Broadcast queue update to room
        this.broadcastQueueUpdate(roomId);
    }
    
    /**
     * Handle LEAVE_ROOM message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    async handleLeaveRoom(ws, message) {
        const roomId = this.socketToRoom.get(ws);
        const userInfo = this.socketToUser.get(ws);
        
        if (!roomId || !userInfo) {
            return;
        }
        
        // Remove from queue
        queueManager.removeFromQueue(roomId, userInfo.userId);
        
        logger.info(`User ${userInfo.userId} left room ${roomId}`);
        
        // Broadcast queue update
        this.broadcastQueueUpdate(roomId);
    }
    
    /**
     * Handle START_BROADCAST message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    async handleStartBroadcast(ws, message) {
        const roomId = this.socketToRoom.get(ws);
        const userInfo = this.socketToUser.get(ws);
        
        if (!roomId || !userInfo) {
            this.sendError(ws, 'Not authenticated');
            return;
        }
        
        // Check if Icecast is running
        if (!icecastClient.isRunning) {
            try {
                await icecastClient.start();
                logger.info('Started Icecast stream');
            } catch (error) {
                logger.error('Failed to start Icecast stream:', error);
                this.sendError(ws, `Failed to start Icecast: ${error.message}`);
                return;
            }
        }
        
        // Start broadcasting
        const member = queueManager.startBroadcast(roomId, userInfo.userId);
        if (!member) {
            this.sendError(ws, 'Failed to start broadcast - not in queue');
            return;
        }
        
        // Store broadcaster socket
        this.broadcasterSockets.set(userInfo.userId, ws);
        
        logger.info(`User ${userInfo.userId} started broadcasting in room ${roomId}`);
        
        // Broadcast broadcast start to room
        this.broadcastToRoom(roomId, {
            type: MessageTypes.BROADCAST_START,
            data: {
                userId: userInfo.userId,
                displayName: userInfo.displayName
            }
        });
        
        // Broadcast queue update
        this.broadcastQueueUpdate(roomId);
    }
    
    /**
     * Handle STOP_BROADCAST message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    async handleStopBroadcast(ws, message) {
        const roomId = this.socketToRoom.get(ws);
        const userInfo = this.socketToUser.get(ws);
        
        if (!roomId || !userInfo) {
            return;
        }
        
        // Stop broadcasting
        const member = queueManager.stopBroadcast(roomId);
        if (member) {
            // Remove broadcaster socket
            this.broadcasterSockets.delete(userInfo.userId);
            
            logger.info(`User ${userInfo.userId} stopped broadcasting in room ${roomId}`);
            
            // Broadcast broadcast stop to room
            this.broadcastToRoom(roomId, {
                type: MessageTypes.BROADCAST_STOP,
                data: {
                    userId: userInfo.userId
                }
            });
            
            // If no one else in queue, stop Icecast stream
            const queue = queueManager.getQueue(roomId);
            if (queue.length === 0) {
                // Give a moment for next broadcaster to start
                setTimeout(async () => {
                    if (queueManager.getCurrentBroadcaster(roomId) === null) {
                        await icecastClient.stop();
                        logger.info('Stopped Icecast stream (no broadcasters)');
                    }
                }, 5000);
            }
            
            // Broadcast queue update
            this.broadcastQueueUpdate(roomId);
        }
    }
    
    /**
     * Handle GET_STATE message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    handleGetState(ws, message) {
        const roomId = this.socketToRoom.get(ws);
        
        if (!roomId) {
            this.sendError(ws, 'Not in a room');
            return;
        }
        
        this.sendMessage(ws, {
            type: MessageTypes.ROOM_STATE,
            data: {
                ...queueManager.getRoomState(roomId),
                icecast: icecastClient.getStats()
            }
        });
    }
    
    /**
     * Handle ICECAST_CONFIG message
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    handleIcecastConfig(ws, message) {
        // This could allow per-room Icecast configuration
        // For now, we use the global config
        logger.debug('Received Icecast config:', message.data);
        
        // Could validate and update config
        // For security, this should only be allowed from trusted sources
        
        this.sendMessage(ws, {
            type: 'ack',
            data: { message: 'Config received' }
        });
    }
    
    /**
     * Handle WebSocket close
     * @param {WebSocket} ws - WebSocket connection
     */
    handleClose(ws) {
        const roomId = this.socketToRoom.get(ws);
        const userInfo = this.socketToUser.get(ws);
        
        // Clean up
        if (roomId) {
            this.socketToRoom.delete(ws);
            
            const roomConnections = this.roomConnections.get(roomId);
            if (roomConnections) {
                roomConnections.delete(ws);
                if (roomConnections.size === 0) {
                    this.roomConnections.delete(roomId);
                }
            }
        }
        
        if (userInfo) {
            this.socketToUser.delete(ws);
            this.broadcasterSockets.delete(userInfo.userId);
        }
        
        // Remove from queue and stop broadcast if needed
        if (roomId && userInfo) {
            const wasBroadcaster = queueManager.getCurrentBroadcaster(roomId)?.userId === userInfo.userId;
            queueManager.removeFromQueue(roomId, userInfo.userId);
            
            if (wasBroadcaster) {
                queueManager.stopBroadcast(roomId);
                
                // Stop Icecast if no one else in queue
                const queue = queueManager.getQueue(roomId);
                if (queue.length === 0) {
                    icecastClient.stop().catch(e => logger.error('Error stopping Icecast:', e));
                }
                
                // Broadcast broadcast stop
                this.broadcastToRoom(roomId, {
                    type: MessageTypes.BROADCAST_STOP,
                    data: { userId: userInfo.userId }
                });
            }
            
            this.broadcastQueueUpdate(roomId);
        }
        
        const ip = ws._socket?.remoteAddress || 'unknown';
        logger.info(`WebSocket disconnected from ${ip}`);
    }
    
    /**
     * Handle WebSocket server error
     * @param {Error} error - Error object
     */
    handleError(error) {
        logger.error('WebSocket server error:', error);
    }
    
    /**
     * Send message to a specific WebSocket
     * @param {WebSocket} ws - WebSocket connection
     * @param {Object} message - Message object
     */
    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    
    /**
     * Send error message to a WebSocket
     * @param {WebSocket} ws - WebSocket connection
     * @param {string} message - Error message
     */
    sendError(ws, message) {
        this.sendMessage(ws, {
            type: MessageTypes.ERROR,
            data: { message }
        });
    }
    
    /**
     * Broadcast message to all connections in a room
     * @param {string} roomId - Room ID
     * @param {Object} message - Message object
     */
    broadcastToRoom(roomId, message) {
        const connections = this.roomConnections.get(roomId);
        if (!connections) return;
        
        const messageStr = JSON.stringify(message);
        
        connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }
    
    /**
     * Broadcast queue update to all connections in a room
     * @param {string} roomId - Room ID
     */
    broadcastQueueUpdate(roomId) {
        this.broadcastToRoom(roomId, {
            type: MessageTypes.QUEUE_UPDATE,
            data: {
                queue: queueManager.getQueue(roomId).map(m => ({
                    userId: m.userId,
                    displayName: m.displayName,
                    status: m.status
                })),
                currentBroadcaster: queueManager.getCurrentBroadcaster(roomId)?.userId || null
            }
        });
    }
    
    /**
     * Broadcast to all connections
     * @param {Object} message - Message object
     */
    broadcastAll(message) {
        const messageStr = JSON.stringify(message);
        
        this.roomConnections.forEach(connections => {
            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(messageStr);
                }
            });
        });
    }
    
    /**
     * Get number of active connections
     * @returns {number}
     */
    getConnectionCount() {
        let count = 0;
        this.roomConnections.forEach(connections => {
            count += connections.size;
        });
        return count;
    }
    
    /**
     * Close WebSocket server
     */
    close() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
        
        this.roomConnections.clear();
        this.socketToRoom.clear();
        this.socketToUser.clear();
        this.broadcasterSockets.clear();
    }
}

module.exports = new WebSocketManager();
