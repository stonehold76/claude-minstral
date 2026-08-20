/**
 * Socket.IO Handler
 * 
 * Manages Socket.IO connection to FoundryVTT with advanced features:
 * - Connection pooling
 * - Automatic reconnection
 * - Authentication handling
 * - Message queuing
 * - Rate limiting
 */

import { io, Socket } from 'socket.io-client';
import { Logger } from '../utils/Logger';
import { IFoundryConfig } from '../core/BridgeConfig';
import { EventEmitter } from 'events';

/**
 * Socket.IO connection state
 */
export type SocketState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Socket.IO event handler
 */
export type SocketEventHandler = (data: any) => void;

/**
 * Queued message interface
 */
export interface IQueuedMessage {
    event: string;
    data: any;
    timestamp: number;
    attempts: number;
}

/**
 * Socket.IO configuration
 */
export interface ISocketIOConfig extends Partial<IFoundryConfig> {
    // Socket.IO specific settings
    path?: string;
    transports?: string[];
    autoConnect?: boolean;
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
    randomizationFactor?: number;
    timeout?: number;
    
    // Custom settings
    maxQueueSize?: number;
    maxRetriesPerMessage?: number;
    retryDelay?: number;
}

/**
 * SocketIOHandler class
 * 
 * Provides robust Socket.IO connection management with:
 * - Automatic reconnection with exponential backoff
 * - Message queuing when disconnected
 * - Connection state tracking
 * - Event emission for connection state changes
 */
export class SocketIOHandler extends EventEmitter {
    private logger: Logger;
    private config: ISocketIOConfig;
    
    // Socket.IO socket
    private socket: Socket | null = null;
    
    // Connection state
    private state: SocketState = 'disconnected';
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    
    // Message queue
    private messageQueue: IQueuedMessage[] = [];
    private maxQueueSize: number;
    private maxRetriesPerMessage: number;
    private retryDelay: number;
    
    // Event handlers
    private eventHandlers: Map<string, SocketEventHandler[]> = new Map();
    
    // Authentication token
    private authToken: string | null = null;
    
    // Connection URL
    private connectionUrl: string;
    
    /**
     * Creates a new SocketIOHandler instance
     * 
     * @param config - Socket.IO configuration
     */
    constructor(config: ISocketIOConfig) {
        super();
        this.logger = new Logger('SocketIOHandler');
        this.config = {
            host: 'localhost',
            port: 30000,
            use_ssl: false,
            socketio: true,
            timeout: 30000,
            reconnect_interval: 5000,
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            autoConnect: false,
            reconnection: false,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.5,
            maxQueueSize: 1000,
            maxRetriesPerMessage: 3,
            retryDelay: 5000,
            ...config,
        };
        
        this.maxReconnectAttempts = this.config.reconnectionAttempts || 10;
        this.maxQueueSize = this.config.maxQueueSize || 1000;
        this.maxRetriesPerMessage = this.config.maxRetriesPerMessage || 3;
        this.retryDelay = this.config.retryDelay || 5000;
        
        // Build connection URL
        this.connectionUrl = this.buildConnectionUrl();
        
        // Set auth token if available
        if (this.config.api_token) {
            this.authToken = this.config.api_token;
        }
    }
    
    /**
     * Builds the Socket.IO connection URL
     */
    private buildConnectionUrl(): string {
        const protocol = this.config.use_ssl ? 'https' : 'http';
        const host = this.config.host;
        const port = this.config.port;
        const path = this.config.path || '/socket.io';
        
        return `${protocol}://${host}:${port}${path}`;
    }
    
    /**
     * Connects to the Socket.IO server
     */
    public async connect(): Promise<void> {
        if (this.state === 'connected') {
            this.logger.info('Already connected');
            return;
        }
        
        if (this.state === 'connecting' || this.state === 'reconnecting') {
            this.logger.info('Connection already in progress');
            return;
        }
        
        this.setState('connecting');
        this.logger.info(`Connecting to ${this.connectionUrl}...`);
        
        try {
            // Create Socket.IO connection
            this.socket = io(this.connectionUrl, {
                transports: this.config.transports,
                autoConnect: true,
                reconnection: false, // We handle reconnection manually
                timeout: this.config.timeout,
                auth: this.getAuthPayload(),
            });
            
            // Set up event listeners
            this.setupSocketListeners();
            
            // Wait for connection
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.config.timeout);
                
                const onConnect = () => {
                    clearTimeout(timeout);
                    this.removeListener('connect', onConnect);
                    resolve();
                };
                
                this.once('connect', onConnect);
            });
            
        } catch (error) {
            this.setState('error');
            this.logger.error('Connection failed:', error as Error);
            
            // Schedule reconnection
            this.scheduleReconnect();
            
            throw error;
        }
    }
    
    /**
     * Gets the authentication payload for Socket.IO
     */
    private getAuthPayload(): { token?: string; apiToken?: string } {
        if (this.authToken) {
            return { apiToken: this.authToken };
        }
        return {};
    }
    
    /**
     * Sets up Socket.IO event listeners
     */
    private setupSocketListeners(): void {
        if (!this.socket) return;
        
        // Connection events
        this.socket.on('connect', this.handleConnect.bind(this));
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
        this.socket.on('connect_error', this.handleConnectError.bind(this));
        this.socket.on('error', this.handleError.bind(this));
        
        // FoundryVTT specific events
        this.socket.on('chatMessage', this.handleEvent.bind(this, 'chatMessage'));
        this.socket.on('userJoined', this.handleEvent.bind(this, 'userJoined'));
        this.socket.on('userLeft', this.handleEvent.bind(this, 'userLeft'));
        this.socket.on('userTyping', this.handleEvent.bind(this, 'userTyping'));
        this.socket.on('diceRoll', this.handleEvent.bind(this, 'diceRoll'));
        this.socket.on('worldList', this.handleEvent.bind(this, 'worldList'));
        this.socket.on('userList', this.handleEvent.bind(this, 'userList'));
        this.socket.on('moduleReady', this.handleEvent.bind(this, 'moduleReady'));
        this.socket.on('moduleEvent', this.handleEvent.bind(this, 'moduleEvent'));
        
        // Custom events
        this.socket.onAny(this.handleAnyEvent.bind(this));
    }
    
    /**
     * Handles successful connection
     */
    private handleConnect(): void {
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.logger.info('Socket.IO connected');
        
        // Flush message queue
        this.flushMessageQueue();
        
        this.emit('connected');
    }
    
    /**
     * Handles disconnection
     * 
     * @param reason - The disconnection reason
     */
    private handleDisconnect(reason: string): void {
        this.setState('disconnected');
        this.logger.warn(`Socket.IO disconnected: ${reason}`);
        
        // Schedule reconnection
        this.scheduleReconnect();
        
        this.emit('disconnected', reason);
    }
    
    /**
     * Handles connection error
     * 
     * @param error - The connection error
     */
    private handleConnectError(error: Error): void {
        this.setState('error');
        this.logger.error('Socket.IO connection error:', error);
        
        // Schedule reconnection
        this.scheduleReconnect();
        
        this.emit('connectionError', error);
    }
    
    /**
     * Handles general errors
     * 
     * @param error - The error
     */
    private handleError(error: Error): void {
        this.logger.error('Socket.IO error:', error);
        this.emit('error', error);
    }
    
    /**
     * Handles specific events
     * 
     * @param eventName - The event name
     * @param data - The event data
     */
    private handleEvent(eventName: string, data: any): void {
        this.logger.debug(`Received event: ${eventName}`);
        this.emit(eventName, data);
        
        // Also emit generic 'event' for all events
        this.emit('event', eventName, data);
    }
    
    /**
     * Handles any event
     * 
     * @param eventName - The event name
     * @param data - The event data
     */
    private handleAnyEvent(eventName: string, data: any): void {
        this.logger.trace(`Received any event: ${eventName}`);
    }
    
    /**
     * Sets the connection state
     * 
     * @param state - The new state
     */
    private setState(state: SocketState): void {
        this.state = state;
        this.emit('stateChange', state);
    }
    
    /**
     * Schedules a reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached');
            this.setState('error');
            this.emit('maxReconnectsReached');
            return;
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        
        const delay = this.calculateReconnectDelay();
        this.reconnectAttempts++;
        this.setState('reconnecting');
        
        this.logger.info(`Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        this.reconnectTimeout = setTimeout(() => {
            this.connect().catch((error) => {
                this.logger.error('Reconnection failed:', error as Error);
            });
        }, delay);
    }
    
    /**
     * Calculates reconnection delay with exponential backoff
     */
    private calculateReconnectDelay(): number {
        const baseDelay = this.config.reconnect_interval || 5000;
        const exponent = Math.min(this.reconnectAttempts, 5);
        return baseDelay * Math.pow(2, exponent - 1);
    }
    
    /**
     * Flushes the message queue
     */
    private flushMessageQueue(): void {
        if (this.messageQueue.length === 0) {
            return;
        }
        
        this.logger.info(`Flushing ${this.messageQueue.length} queued messages`);
        
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()!;
            this.sendMessageInternal(message).catch((error) => {
                this.logger.error('Failed to send queued message:', error as Error);
            });
        }
    }
    
    /**
     * Sends a message via Socket.IO
     * 
     * @param event - The event name
     * @param data - The data to send
     */
    public async sendMessage(event: string, data: any): Promise<boolean> {
        if (!this.socket) {
            this.logger.error('Socket not initialized');
            return false;
        }
        
        if (this.state !== 'connected') {
            this.logger.warn(`Not connected (state: ${this.state}), queueing message`);
            return this.queueMessage(event, data);
        }
        
        return this.sendMessageInternal({ event, data, timestamp: Date.now(), attempts: 0 });
    }
    
    /**
     * Sends a message internally (used for queued messages too)
     * 
     * @param queuedMessage - The queued message to send
     */
    private async sendMessageInternal(queuedMessage: IQueuedMessage): Promise<boolean> {
        if (!this.socket) {
            return false;
        }
        
        try {
            this.socket.emit(queuedMessage.event, queuedMessage.data);
            this.logger.debug(`Sent message: ${queuedMessage.event}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send message:', error as Error);
            
            // Retry if we haven't exceeded max attempts
            if (queuedMessage.attempts < this.maxRetriesPerMessage) {
                queuedMessage.attempts++;
                this.queueMessage(queuedMessage.event, queuedMessage.data, queuedMessage.attempts);
            } else {
                this.logger.error(`Max retries (${this.maxRetriesPerMessage}) exceeded for message: ${queuedMessage.event}`);
                this.emit('messageFailed', queuedMessage);
            }
            
            return false;
        }
    }
    
    /**
     * Queues a message for later sending
     * 
     * @param event - The event name
     * @param data - The data to send
     * @param attempts - The number of attempts already made
     */
    private queueMessage(event: string, data: any, attempts: number = 0): boolean {
        // Check if queue is full
        if (this.messageQueue.length >= this.maxQueueSize) {
            this.logger.error('Message queue is full, dropping message');
            this.emit('queueFull', { event, data });
            return false;
        }
        
        // Add to queue
        const queuedMessage: IQueuedMessage = {
            event,
            data,
            timestamp: Date.now(),
            attempts,
        };
        
        this.messageQueue.push(queuedMessage);
        this.logger.debug(`Queued message: ${event} (queue size: ${this.messageQueue.length})`);
        
        this.emit('messageQueued', queuedMessage);
        return true;
    }
    
    /**
     * Registers an event handler
     * 
     * @param eventName - The event name
     * @param handler - The event handler
     */
    public on(eventName: string, handler: SocketEventHandler): void {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        
        this.eventHandlers.get(eventName)!.push(handler);
    }
    
    /**
     * Removes an event handler
     * 
     * @param eventName - The event name
     * @param handler - The event handler to remove
     */
    public off(eventName: string, handler: SocketEventHandler): void {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    /**
     * Removes all event handlers for an event
     * 
     * @param eventName - The event name
     */
    public removeAllListeners(eventName: string): void {
        this.eventHandlers.delete(eventName);
    }
    
    /**
     * Disconnects from the Socket.IO server
     */
    public async disconnect(): Promise<void> {
        this.logger.info('Disconnecting from Socket.IO server...');
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.setState('disconnected');
        this.reconnectAttempts = 0;
        
        this.logger.info('Disconnected from Socket.IO server');
    }
    
    /**
     * Updates the authentication token
     * 
     * @param token - The new authentication token
     */
    public updateAuthToken(token: string): void {
        this.authToken = token;
        this.logger.info('Updated authentication token');
        
        // Reconnect with new token
        if (this.state === 'connected') {
            this.disconnect().then(() => {
                this.connect();
            });
        }
    }
    
    /**
     * Gets the current connection state
     */
    public getState(): SocketState {
        return this.state;
    }
    
    /**
     * Checks if connected
     */
    public isConnected(): boolean {
        return this.state === 'connected';
    }
    
    /**
     * Gets the current connection URL
     */
    public getConnectionUrl(): string {
        return this.connectionUrl;
    }
    
    /**
     * Gets the Socket.IO socket instance
     */
    public getSocket(): Socket | null {
        return this.socket;
    }
    
    /**
     * Gets statistics about the Socket.IO handler
     */
    public getStats(): object {
        return {
            state: this.state,
            reconnectAttempts: this.reconnectAttempts,
            queueSize: this.messageQueue.length,
            maxQueueSize: this.maxQueueSize,
            connectionUrl: this.connectionUrl,
            isConnected: this.isConnected(),
        };
    }
    
    /**
     * Clears the message queue
     */
    public clearQueue(): void {
        this.messageQueue = [];
        this.logger.info('Cleared message queue');
    }
    
    /**
     * Gets the message queue
     */
    public getQueue(): IQueuedMessage[] {
        return [...this.messageQueue];
    }
}
