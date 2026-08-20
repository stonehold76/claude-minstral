/**
 * FoundryVTT Client Implementation
 * 
 * Handles all communication with FoundryVTT via Socket.IO or Module API.
 * Manages connection, message sending/receiving, and event forwarding.
 */

import { io, Socket } from 'socket.io-client';
import { Logger } from '../utils/Logger';
import { IFoundryConfig } from '../core/BridgeConfig';
import { UserMapper } from '../core/UserMapper';
import { MessageTranslator } from '../core/MessageTranslator';
import { EventEmitter } from 'events';

/**
 * Foundry message interface
 */
export interface FoundryMessage {
    id?: string;
    worldId: string;
    sender: string;
    senderDisplayName?: string;
    content: string;
    formattedContent?: string;
    timestamp?: number;
    type?: 'chat' | 'whisper' | 'emote' | 'dice' | 'oob';
    targetUser?: string; // For whispers
    isGM?: boolean;
    [key: string]: any;
}

/**
 * Foundry user interface
 */
export interface FoundryUser {
    id: string;
    name: string;
    isGM: boolean;
    avatar?: string;
    color?: string;
}

/**
 * Foundry world interface
 */
export interface FoundryWorld {
    id: string;
    title: string;
    system: string;
    isActive: boolean;
    players: FoundryUser[];
}

/**
 * Dice roll result interface
 */
export interface DiceRollResult {
    userId: string;
    worldId: string;
    expression: string;
    result: string;
    total: number;
    rolls: number[][];
    timestamp: number;
}

/**
 * FoundryClient class
 * 
 * Manages connection to FoundryVTT and handles:
 * - Socket.IO connection and authentication
 * - Message sending and receiving
 * - Event emission (chat, dice, presence, etc.)
 * - World and user management
 */
export class FoundryClient extends EventEmitter {
    private logger: Logger;
    private config: IFoundryConfig;
    private userMapper: UserMapper;
    private messageTranslator: MessageTranslator;
    
    // Socket.IO connection
    private socket: Socket | null = null;
    
    // Connection state
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    
    // World information
    private worlds: Map<string, FoundryWorld> = new Map();
    private currentWorldId: string | null = null;
    
    // User information
    private users: Map<string, FoundryUser> = new Map();
    
    // Typing state
    private typingUsers: Map<string, Set<string>> = new Map();
    
    // Message queue for when connection is down
    private messageQueue: FoundryMessage[] = [];
    
    /**
     * Creates a new FoundryClient instance
     * 
     * @param config - FoundryVTT configuration
     * @param userMapper - User mapper instance
     * @param messageTranslator - Message translator instance
     */
    constructor(
        config: IFoundryConfig,
        userMapper: UserMapper,
        messageTranslator: MessageTranslator
    ) {
        super();
        this.logger = new Logger('FoundryClient');
        this.config = config;
        this.userMapper = userMapper;
        this.messageTranslator = messageTranslator;
        this.maxReconnectAttempts = config.reconnect_interval ? 
            Math.floor((config.timeout || 30000) / (config.reconnect_interval || 5000)) : 5;
    }
    
    /**
     * Initializes the Foundry client
     */
    public async initialize(): Promise<void> {
        this.logger.info('Initializing FoundryVTT Client...');
        
        try {
            // Load any persisted state
            await this.loadState();
            
            this.logger.info('FoundryVTT Client initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Foundry client:', error as Error);
            throw error;
        }
    }
    
    /**
     * Connects to FoundryVTT via Socket.IO
     */
    public async connect(): Promise<void> {
        if (this.isConnected) {
            this.logger.info('Already connected to FoundryVTT');
            return;
        }
        
        if (this.isConnecting) {
            this.logger.info('Connection in progress...');
            return;
        }
        
        this.isConnecting = true;
        this.logger.info('Connecting to FoundryVTT...');
        
        try {
            // Build connection URL
            const protocol = this.config.use_ssl ? 'https' : 'http';
            const host = this.config.host;
            const port = this.config.port;
            const url = `${protocol}://${host}:${port}`;
            
            this.logger.info(`Connecting to: ${url}`);
            
            // Create Socket.IO connection
            this.socket = io(url, {
                transports: ['websocket', 'polling'],
                reconnection: false, // We handle reconnection manually
                timeout: this.config.timeout || 30000,
                auth: this.getAuthToken(),
            });
            
            // Set up event listeners
            this.setupSocketListeners();
            
            // Wait for connection
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.config.timeout || 30000);
                
                this.socket!.on('connect', () => {
                    clearTimeout(timeout);
                    this.isConnecting = false;
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.logger.info('Connected to FoundryVTT Socket.IO server');
                    
                    // Flush message queue
                    this.flushMessageQueue();
                    
                    // Request initial state
                    this.requestInitialState();
                    
                    resolve();
                });
                
                this.socket!.on('connect_error', (error: Error) => {
                    clearTimeout(timeout);
                    this.isConnecting = false;
                    reject(error);
                });
            });
            
        } catch (error) {
            this.isConnecting = false;
            this.logger.error('Failed to connect to FoundryVTT:', error as Error);
            
            // Schedule reconnection
            this.scheduleReconnect();
            
            throw error;
        }
    }
    
    /**
     * Gets authentication token for Socket.IO connection
     */
    private getAuthToken(): { token?: string; apiToken?: string } {
        if (this.config.api_token) {
            return { apiToken: this.config.api_token };
        }
        return {};
    }
    
    /**
     * Sets up Socket.IO event listeners
     */
    private setupSocketListeners(): void {
        if (!this.socket) return;
        
        // System events
        this.socket.on('connect', this.handleConnect.bind(this));
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
        this.socket.on('connect_error', this.handleConnectError.bind(this));
        this.socket.on('error', this.handleError.bind(this));
        
        // FoundryVTT specific events
        this.socket.on('chatMessage', this.handleChatMessage.bind(this));
        this.socket.on('userJoined', this.handleUserJoined.bind(this));
        this.socket.on('userLeft', this.handleUserLeft.bind(this));
        this.socket.on('userTyping', this.handleUserTyping.bind(this));
        this.socket.on('diceRoll', this.handleDiceRoll.bind(this));
        this.socket.on('worldList', this.handleWorldList.bind(this));
        this.socket.on('userList', this.handleUserList.bind(this));
        
        // Module API events (if using module)
        this.socket.on('moduleReady', this.handleModuleReady.bind(this));
        this.socket.on('moduleEvent', this.handleModuleEvent.bind(this));
    }
    
    /**
     * Handles successful connection
     */
    private handleConnect(): void {
        this.logger.info('Socket.IO connected');
        this.emit('connected');
    }
    
    /**
     * Handles disconnection
     * 
     * @param reason - The disconnection reason
     */
    private handleDisconnect(reason: string): void {
        this.isConnected = false;
        this.logger.warn(`Socket.IO disconnected: ${reason}`);
        this.emit('disconnected', reason);
        
        // Schedule reconnection
        this.scheduleReconnect();
    }
    
    /**
     * Handles connection error
     * 
     * @param error - The connection error
     */
    private handleConnectError(error: Error): void {
        this.logger.error('Socket.IO connection error:', error);
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
     * Schedules a reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached');
            this.emit('maxReconnectsReached');
            return;
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        
        const delay = this.calculateReconnectDelay();
        this.reconnectAttempts++;
        
        this.logger.info(`Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        this.reconnectTimeout = setTimeout(() => {
            this.isConnecting = false;
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
     * Requests initial state from Foundry
     */
    private requestInitialState(): void {
        if (!this.socket) return;
        
        this.logger.info('Requesting initial state from Foundry...');
        
        // Request world list
        this.socket.emit('getWorldList');
        
        // Request user list for current world
        if (this.currentWorldId) {
            this.socket.emit('getUserList', this.currentWorldId);
        }
    }
    
    /**
     * Handles chat messages from Foundry
     * 
     * @param message - The chat message
     */
    private handleChatMessage(message: any): void {
        this.logger.debug('Received chat message from Foundry:', {
            worldId: message.worldId,
            sender: message.sender,
        });
        
        try {
            // Convert to FoundryMessage format
            const foundryMessage: FoundryMessage = {
                id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                worldId: message.worldId || this.currentWorldId || '',
                sender: message.user || message.sender,
                senderDisplayName: message.userName || message.displayName,
                content: message.content || '',
                formattedContent: message.formattedContent || message.content,
                timestamp: message.timestamp || Date.now(),
                type: message.type || 'chat',
                targetUser: message.whisperTo || message.targetUser,
                isGM: message.isGM || false,
                raw: message,
            };
            
            // Emit the message
            this.emit('message', foundryMessage);
            
            this.logger.info(`Received Foundry message: ${foundryMessage.id}`);
        } catch (error) {
            this.logger.error('Error handling chat message:', error as Error);
        }
    }
    
    /**
     * Handles user joined events
     * 
     * @param data - User joined data
     */
    private handleUserJoined(data: any): void {
        const worldId = data.worldId || this.currentWorldId;
        const userId = data.userId || data.user;
        
        this.logger.info(`User ${userId} joined world ${worldId}`);
        
        // Update user cache
        if (data.userData) {
            this.users.set(userId, data.userData);
        }
        
        this.emit('userJoined', userId, worldId);
    }
    
    /**
     * Handles user left events
     * 
     * @param data - User left data
     */
    private handleUserLeft(data: any): void {
        const worldId = data.worldId || this.currentWorldId;
        const userId = data.userId || data.user;
        
        this.logger.info(`User ${userId} left world ${worldId}`);
        
        // Remove from user cache
        this.users.delete(userId);
        
        this.emit('userLeft', userId, worldId);
    }
    
    /**
     * Handles user typing events
     * 
     * @param data - User typing data
     */
    private handleUserTyping(data: any): void {
        const worldId = data.worldId || this.currentWorldId;
        const userId = data.userId || data.user;
        const isTyping = data.isTyping !== false;
        
        this.logger.debug(`User ${userId} ${isTyping ? 'started' : 'stopped'} typing in ${worldId}`);
        
        // Update typing cache
        if (!this.typingUsers.has(worldId)) {
            this.typingUsers.set(worldId, new Set());
        }
        
        const typingInWorld = this.typingUsers.get(worldId)!;
        
        if (isTyping) {
            typingInWorld.add(userId);
        } else {
            typingInWorld.delete(userId);
        }
        
        this.emit('typing', userId, worldId, isTyping);
    }
    
    /**
     * Handles dice roll events
     * 
     * @param data - Dice roll data
     */
    private handleDiceRoll(data: any): void {
        const worldId = data.worldId || this.currentWorldId;
        const userId = data.userId || data.user;
        
        this.logger.debug(`Dice roll from ${userId} in ${worldId}: ${JSON.stringify(data)}`);
        
        const rollResult: DiceRollResult = {
            userId,
            worldId,
            expression: data.expression || data.roll || '',
            result: data.result || data.total || '',
            total: data.total || 0,
            rolls: data.rolls || [],
            timestamp: data.timestamp || Date.now(),
        };
        
        this.emit('diceRoll', userId, worldId, rollResult);
    }
    
    /**
     * Handles world list from Foundry
     * 
     * @param worlds - Array of worlds
     */
    private handleWorldList(worlds: any[]): void {
        this.logger.info(`Received ${worlds.length} worlds from Foundry`);
        
        this.worlds.clear();
        
        for (const worldData of worlds) {
            const world: FoundryWorld = {
                id: worldData.id,
                title: worldData.title || worldData.name,
                system: worldData.system || 'unknown',
                isActive: worldData.active || false,
                players: worldData.players || [],
            };
            
            this.worlds.set(world.id, world);
            
            // Set first active world as current if not set
            if (world.isActive && !this.currentWorldId) {
                this.currentWorldId = world.id;
                this.logger.info(`Set current world to: ${world.id} (${world.title})`);
            }
        }
        
        this.emit('worldsUpdated', Array.from(this.worlds.values()));
    }
    
    /**
     * Handles user list from Foundry
     * 
     * @param users - Array of users
     */
    private handleUserList(users: any[]): void {
        this.logger.debug(`Received ${users.length} users for current world`);
        
        this.users.clear();
        
        for (const userData of users) {
            const user: FoundryUser = {
                id: userData.id || userData.userId,
                name: userData.name || userData.displayName || userData.id,
                isGM: userData.isGM || userData.role === 'gm' || false,
                avatar: userData.avatar,
                color: userData.color,
            };
            
            this.users.set(user.id, user);
        }
        
        this.emit('usersUpdated', Array.from(this.users.values()));
    }
    
    /**
     * Handles module ready event
     */
    private handleModuleReady(data: any): void {
        this.logger.info('Foundry module is ready');
        this.emit('moduleReady', data);
    }
    
    /**
     * Handles custom module events
     * 
     * @param event - The module event
     */
    private handleModuleEvent(event: any): void {
        this.logger.debug('Received module event:', event);
        this.emit('moduleEvent', event);
    }
    
    /**
     * Sends a message to FoundryVTT
     * 
     * @param message - The message to send
     */
    public async sendMessage(message: FoundryMessage): Promise<boolean> {
        if (!this.socket) {
            this.logger.error('Socket not initialized');
            return false;
        }
        
        if (!this.isConnected) {
            this.logger.warn('Not connected, queueing message');
            this.messageQueue.push(message);
            return false;
        }
        
        try {
            this.logger.debug(`Sending message to Foundry: ${message.id || 'new'}`);
            
            // Convert to Foundry format
            const foundryMessage = {
                worldId: message.worldId || this.currentWorldId,
                content: message.content,
                formattedContent: message.formattedContent,
                type: message.type || 'chat',
                whisperTo: message.targetUser,
                user: this.userMapper.getFoundryUser(message.sender) || message.sender,
            };
            
            // Send via Socket.IO
            this.socket.emit('chatMessage', foundryMessage);
            
            this.logger.info(`Sent message to Foundry: ${message.id || 'new'}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send message to Foundry:', error as Error);
            return false;
        }
    }
    
    /**
     * Sends a typing indicator to Foundry
     * 
     * @param worldId - The world ID
     * @param userId - The user ID
     * @param isTyping - Whether the user is typing
     */
    public async sendTypingIndicator(
        worldId: string,
        userId: string,
        isTyping: boolean
    ): Promise<boolean> {
        if (!this.socket || !this.isConnected) {
            return false;
        }
        
        try {
            this.socket.emit('userTyping', {
                worldId,
                userId,
                isTyping,
            });
            
            this.logger.debug(`Sent typing indicator: ${userId} ${isTyping ? 'typing' : 'not typing'} in ${worldId}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send typing indicator:', error as Error);
            return false;
        }
    }
    
    /**
     * Sends a reaction to Foundry
     * 
     * @param worldId - The world ID
     * @param userId - The user ID
     * @param targetMessageId - The message ID to react to
     * @param reaction - The reaction emoji
     */
    public async sendReaction(
        worldId: string,
        userId: string,
        targetMessageId: string,
        reaction: string
    ): Promise<boolean> {
        if (!this.socket || !this.isConnected) {
            return false;
        }
        
        try {
            this.socket.emit('sendReaction', {
                worldId,
                userId,
                targetMessageId,
                reaction,
            });
            
            this.logger.debug(`Sent reaction: ${userId} reacted with ${reaction} to ${targetMessageId}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send reaction:', error as Error);
            return false;
        }
    }
    
    /**
     * Syncs room membership with Foundry
     * 
     * @param matrixRoomId - The Matrix room ID
     * @param foundryWorldId - The Foundry world ID
     */
    public async syncRoomMembership(
        matrixRoomId: string,
        foundryWorldId: string
    ): Promise<boolean> {
        // In a real implementation, this would sync the member lists
        // For now, just log it
        this.logger.info(`Syncing membership: ${matrixRoomId} <-> ${foundryWorldId}`);
        return true;
    }
    
    /**
     * Sets the current world
     * 
     * @param worldId - The world ID to set as current
     */
    public setCurrentWorld(worldId: string): void {
        if (this.worlds.has(worldId)) {
            this.currentWorldId = worldId;
            this.logger.info(`Set current world to: ${worldId}`);
        } else {
            this.logger.warn(`World ${worldId} not found`);
        }
    }
    
    /**
     * Gets the current world ID
     */
    public getCurrentWorldId(): string | null {
        return this.currentWorldId;
    }
    
    /**
     * Gets a world by ID
     * 
     * @param worldId - The world ID
     */
    public getWorld(worldId: string): FoundryWorld | undefined {
        return this.worlds.get(worldId);
    }
    
    /**
     * Gets all worlds
     */
    public getAllWorlds(): FoundryWorld[] {
        return Array.from(this.worlds.values());
    }
    
    /**
     * Gets a user by ID
     * 
     * @param userId - The user ID
     */
    public getUser(userId: string): FoundryUser | undefined {
        return this.users.get(userId);
    }
    
    /**
     * Gets all users in the current world
     */
    public getAllUsers(): FoundryUser[] {
        return Array.from(this.users.values());
    }
    
    /**
     * Flushes the message queue
     */
    private flushMessageQueue(): void {
        if (this.messageQueue.length === 0) return;
        
        this.logger.info(`Flushing ${this.messageQueue.length} queued messages`);
        
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()!;
            this.sendMessage(message).catch((error) => {
                this.logger.error('Failed to send queued message:', error as Error);
            });
        }
    }
    
    /**
     * Disconnects from FoundryVTT
     */
    public async disconnect(): Promise<void> {
        this.logger.info('Disconnecting from FoundryVTT...');
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        this.logger.info('Disconnected from FoundryVTT');
    }
    
    /**
     * Loads persisted state
     */
    private async loadState(): Promise<void> {
        // In a real implementation, this would load from a file or database
        // For now, just initialize empty state
        this.logger.debug('Loading persisted state');
    }
    
    /**
     * Saves current state
     */
    public async saveState(): Promise<void> {
        // In a real implementation, this would save to a file or database
        this.logger.debug('Saving state');
    }
    
    /**
     * Checks if connected to Foundry
     */
    public isConnectedToFoundry(): boolean {
        return this.isConnected;
    }
    
    /**
     * Gets statistics about the Foundry client
     */
    public getStats(): object {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            currentWorldId: this.currentWorldId,
            worldCount: this.worlds.size,
            userCount: this.users.size,
            queuedMessages: this.messageQueue.length,
        };
    }
}
