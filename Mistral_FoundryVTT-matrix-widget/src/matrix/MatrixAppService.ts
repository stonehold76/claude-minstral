/**
 * Matrix Application Service Implementation
 * 
 * This module handles the Matrix Application Service integration,
 * including registration, event processing, and message sending.
 */

import { AppService, MatrixClient, createClient, IAppServiceRegistration, IEvent, IRoomMemberEvent, IRoomMessageEvent, IRoomEvent, EventType } from 'matrix-js-sdk';
import { Logger } from '../utils/Logger';
import { BridgeConfig, IMatrixConfig } from '../core/BridgeConfig';
import { MessageTranslator } from '../core/MessageTranslator';
import { UserMapper } from '../core/UserMapper';
import { FoundryClient } from '../foundry/FoundryClient';
import { MatrixEvent } from '../models/MatrixEvent';

/**
 * Matrix Application Service class
 * 
 * Handles all Matrix-related functionality including:
 * - Application Service registration
 * - Event processing from Matrix
 * - Message sending to Matrix
 * - Room and user management
 */
export class MatrixAppService {
    // Logger instance
    private logger: Logger;
    
    // Matrix client instance
    private matrixClient: MatrixClient | null = null;
    
    // Application Service instance
    private appService: AppService | null = null;
    
    // Configuration
    private config: IMatrixConfig;
    
    // Message translator
    private messageTranslator: MessageTranslator;
    
    // User mapper
    private userMapper: UserMapper;
    
    // Foundry client
    private foundryClient: FoundryClient;
    
    // Event handlers
    private eventHandlers: Map<string, (event: IEvent) => Promise<void>> = new Map();
    
    // Room membership cache
    private roomMembers: Map<string, Set<string>> = new Map();
    
    // Typing users cache
    private typingUsers: Map<string, Set<string>> = new Map();
    
    /**
     * Creates a new MatrixAppService instance
     * 
     * @param config - Matrix configuration
     * @param messageTranslator - Message translator instance
     * @param userMapper - User mapper instance
     * @param foundryClient - Foundry client instance
     */
    constructor(
        config: IMatrixConfig,
        messageTranslator: MessageTranslator,
        userMapper: UserMapper,
        foundryClient: FoundryClient
    ) {
        this.logger = new Logger('MatrixAppService');
        this.config = config;
        this.messageTranslator = messageTranslator;
        this.userMapper = userMapper;
        this.foundryClient = foundryClient;
        
        this.setupEventHandlers();
    }
    
    /**
     * Initializes the Matrix Application Service
     */
    public async initialize(): Promise<void> {
        this.logger.info('Initializing Matrix Application Service...');
        
        try {
            // Load registration file
            const registration = await this.loadRegistration();
            
            // Create Matrix client
            this.matrixClient = createClient({
                baseUrl: this.config.homeserver,
                accessToken: registration.as_token,
                request: (opts) => {
                    // Custom request handler for debugging
                    this.logger.debug(`Matrix API request: ${opts.method} ${opts.uri}`);
                    return fetch(opts.uri, {
                        method: opts.method as any,
                        headers: opts.headers as any,
                        body: opts.body as any,
                    });
                },
            });
            
            // Create Application Service
            this.appService = new AppService({
                appServiceUserId: `@${registration.sender_localpart}:${new URL(this.config.homeserver).hostname}`,
                homeserverToken: registration.hs_token,
                appServiceToken: registration.as_token,
                homeserverUrl: this.config.homeserver,
            });
            
            // Set up event listeners
            this.setupAppServiceListeners();
            
            this.logger.info('Matrix Application Service initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Matrix Application Service:', error);
            throw error;
        }
    }
    
    /**
     * Starts the Application Service
     */
    public async start(): Promise<void> {
        if (!this.appService) {
            throw new Error('Application Service not initialized');
        }
        
        this.logger.info('Starting Matrix Application Service...');
        
        try {
            // Start the App Service
            await this.appService.listen(this.config.port);
            this.logger.info(`Matrix Application Service listening on port ${this.config.port}`);
        } catch (error) {
            this.logger.error('Failed to start Matrix Application Service:', error);
            throw error;
        }
    }
    
    /**
     * Stops the Application Service
     */
    public async stop(): Promise<void> {
        this.logger.info('Stopping Matrix Application Service...');
        
        if (this.appService) {
            await this.appService.stop();
            this.appService = null;
        }
        
        this.logger.info('Matrix Application Service stopped');
    }
    
    /**
     * Loads the Application Service registration file
     */
    private async loadRegistration(): Promise<IAppServiceRegistration> {
        this.logger.info(`Loading registration file from: ${this.config.as_registration}`);
        
        try {
            // In a real implementation, this would load from the file system
            // For now, we'll use the config directly
            const registration: IAppServiceRegistration = {
                id: this.config.id || 'foundryvtt-bridge',
                hs_token: this.config.hs_token,
                as_token: this.config.as_token,
                sender_localpart: this.config.sender_localpart || '_foundry_bridge',
                namespaces: this.config.namespaces || {
                    users: [
                        {
                            exclusive: true,
                            regex: `@_foundry_.*:${new URL(this.config.homeserver).hostname}`
                        }
                    ],
                    rooms: [],
                    aliases: []
                },
                url: this.config.url || `http://localhost:${this.config.port}`,
                rate_limited: false,
            };
            
            this.logger.info('Registration loaded successfully');
            return registration;
        } catch (error) {
            this.logger.error('Failed to load registration file:', error);
            throw error;
        }
    }
    
    /**
     * Sets up event handlers for different Matrix event types
     */
    private setupEventHandlers(): void {
        this.logger.debug('Setting up event handlers...');
        
        // Room message handler
        this.eventHandlers.set(EventType.RoomMessage, this.handleRoomMessage.bind(this));
        
        // Room member handler
        this.eventHandlers.set(EventType.RoomMember, this.handleRoomMember.bind(this));
        
        // Typing handler
        this.eventHandlers.set(EventType.Typing, this.handleTyping.bind(this));
        
        // Receipt handler
        this.eventHandlers.set(EventType.Receipt, this.handleReceipt.bind(this));
        
        // Reaction handler
        this.eventHandlers.set(EventType.Reaction, this.handleReaction.bind(this));
    }
    
    /**
     * Sets up Application Service event listeners
     */
    private setupAppServiceListeners(): void {
        if (!this.appService) {
            return;
        }
        
        this.logger.debug('Setting up Application Service listeners...');
        
        // Listen for events from the homeserver
        this.appService.on('event', this.handleMatrixEvent.bind(this));
        
        // Listen for room alias queries
        this.appService.on('roomAlias', this.handleRoomAlias.bind(this));
        
        // Listen for user queries
        this.appService.on('user', this.handleUserQuery.bind(this));
        
        // Listen for errors
        this.appService.on('error', (error: Error) => {
            this.logger.error('Application Service error:', error);
        });
    }
    
    /**
     * Handles incoming Matrix events
     * 
     * @param event - The Matrix event to handle
     */
    private async handleMatrixEvent(event: IEvent): Promise<void> {
        this.logger.debug(`Received Matrix event: ${event.getType()}`);
        
        try {
            // Get the handler for this event type
            const handler = this.eventHandlers.get(event.getType());
            
            if (handler) {
                await handler(event);
            } else {
                this.logger.debug(`No handler for event type: ${event.getType()}`);
            }
        } catch (error) {
            this.logger.error(`Error handling Matrix event ${event.getType()}:`, error);
        }
    }
    
    /**
     * Handles room alias queries
     * 
     * @param alias - The room alias being queried
     */
    private async handleRoomAlias(alias: string): Promise<string | null> {
        this.logger.debug(`Room alias query: ${alias}`);
        
        // In a real implementation, this would look up the room ID
        // For now, return null to let the homeserver handle it
        return null;
    }
    
    /**
     * Handles user queries
     * 
     * @param userId - The user ID being queried
     */
    private async handleUserQuery(userId: string): Promise<object | null> {
        this.logger.debug(`User query: ${userId}`);
        
        // In a real implementation, this would return user profile info
        // For ghost users, we might return synthetic profile data
        if (userId.startsWith('@_foundry_')) {
            return {
                displayname: userId.split(':')[0].replace('@_foundry_', 'Foundry_'),
                avatar_url: null,
            };
        }
        
        return null;
    }
    
    /**
     * Handles room message events
     * 
     * @param event - The room message event
     */
    private async handleRoomMessage(event: IRoomMessageEvent): Promise<void> {
        this.logger.debug(`Handling room message: ${event.event_id}`);
        
        try {
            // Skip our own messages to prevent loops
            if (event.sender === this.getBotUserId()) {
                this.logger.debug('Skipping own message to prevent loop');
                return;
            }
            
            // Get the room ID
            const roomId = event.room_id;
            
            // Get the sender's display name
            const senderDisplayName = await this.getUserDisplayName(event.sender);
            
            // Create a MatrixEvent object
            const matrixEvent: MatrixEvent = {
                eventId: event.event_id,
                roomId: roomId,
                sender: event.sender,
                senderDisplayName: senderDisplayName,
                timestamp: event.origin_server_ts,
                type: 'm.room.message',
                content: event.content,
                formattedContent: event.content.formatted_body,
                rawEvent: event,
            };
            
            // Translate and send to Foundry
            const foundryMessage = this.messageTranslator.matrixToFoundry(matrixEvent);
            
            if (foundryMessage) {
                await this.foundryClient.sendMessage(foundryMessage);
                this.logger.info(`Forwarded Matrix message to Foundry: ${event.event_id}`);
            }
        } catch (error) {
            this.logger.error(`Error handling room message ${event.event_id}:`, error);
        }
    }
    
    /**
     * Handles room member events
     * 
     * @param event - The room member event
     */
    private async handleRoomMember(event: IRoomMemberEvent): Promise<void> {
        this.logger.debug(`Handling room member event: ${event.event_id}`);
        
        try {
            const roomId = event.room_id;
            const userId = event.state_key;
            const membership = event.content.membership;
            
            // Update room membership cache
            if (!this.roomMembers.has(roomId)) {
                this.roomMembers.set(roomId, new Set());
            }
            
            const members = this.roomMembers.get(roomId)!;
            
            if (membership === 'join') {
                members.add(userId);
                this.logger.info(`User ${userId} joined room ${roomId}`);
            } else if (membership === 'leave' || membership === 'ban') {
                members.delete(userId);
                this.logger.info(`User ${userId} left room ${roomId}`);
            }
            
            // Sync with Foundry if this is a bridged room
            const foundryWorldId = await this.getFoundryWorldId(roomId);
            if (foundryWorldId) {
                await this.foundryClient.syncRoomMembership(roomId, foundryWorldId);
            }
        } catch (error) {
            this.logger.error(`Error handling room member event ${event.event_id}:`, error);
        }
    }
    
    /**
     * Handles typing events
     * 
     * @param event - The typing event
     */
    private async handleTyping(event: IEvent): Promise<void> {
        this.logger.debug(`Handling typing event: ${event.event_id}`);
        
        try {
            const roomId = event.room_id;
            const userId = event.sender;
            const isTyping = event.content?.user_ids?.includes(userId) || false;
            
            // Update typing cache
            if (!this.typingUsers.has(roomId)) {
                this.typingUsers.set(roomId, new Set());
            }
            
            const typingInRoom = this.typingUsers.get(roomId)!;
            
            if (isTyping) {
                typingInRoom.add(userId);
            } else {
                typingInRoom.delete(userId);
            }
            
            // Forward to Foundry
            const foundryWorldId = await this.getFoundryWorldId(roomId);
            if (foundryWorldId) {
                const foundryUserId = this.userMapper.getFoundryUser(userId);
                if (foundryUserId) {
                    await this.foundryClient.sendTypingIndicator(
                        foundryWorldId,
                        foundryUserId,
                        isTyping
                    );
                }
            }
        } catch (error) {
            this.logger.error(`Error handling typing event ${event.event_id}:`, error);
        }
    }
    
    /**
     * Handles receipt events (read receipts)
     * 
     * @param event - The receipt event
     */
    private async handleReceipt(event: IEvent): Promise<void> {
        this.logger.debug(`Handling receipt event: ${event.event_id}`);
        
        // In a real implementation, this would sync read receipts to Foundry
        // For now, just log it
        this.logger.debug(`Read receipt from ${event.sender} in room ${event.room_id}`);
    }
    
    /**
     * Handles reaction events
     * 
     * @param event - The reaction event
     */
    private async handleReaction(event: IEvent): Promise<void> {
        this.logger.debug(`Handling reaction event: ${event.event_id}`);
        
        try {
            const roomId = event.room_id;
            const sender = event.sender;
            const reaction = event.content?.['m.relates_to']?.key;
            const targetEventId = event.content?.['m.relates_to']?.event_id;
            
            if (reaction && targetEventId) {
                // Translate and send to Foundry
                const foundryWorldId = await this.getFoundryWorldId(roomId);
                if (foundryWorldId) {
                    const foundryUserId = this.userMapper.getFoundryUser(sender);
                    if (foundryUserId) {
                        await this.foundryClient.sendReaction(
                            foundryWorldId,
                            foundryUserId,
                            targetEventId,
                            reaction
                        );
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Error handling reaction event ${event.event_id}:`, error);
        }
    }
    
    /**
     * Sends a message to a Matrix room
     * 
     * @param roomId - The Matrix room ID
     * @param content - The message content
     * @param formattedContent - Optional formatted content
     */
    public async sendMessage(
        roomId: string,
        content: string,
        formattedContent?: string
    ): Promise<string | null> {
        if (!this.matrixClient) {
            this.logger.error('Matrix client not initialized');
            return null;
        }
        
        try {
            this.logger.debug(`Sending message to Matrix room ${roomId}`);
            
            const response = await this.matrixClient.sendEvent(
                roomId,
                EventType.RoomMessage,
                {
                    body: content,
                    formatted_body: formattedContent || content,
                    msgtype: formattedContent ? 'm.room.message' : 'm.text',
                },
                ''
            );
            
            this.logger.info(`Sent message to Matrix room ${roomId}: ${response.event_id}`);
            return response.event_id;
        } catch (error) {
            this.logger.error(`Failed to send message to Matrix room ${roomId}:`, error);
            return null;
        }
    }
    
    /**
     * Sends a formatted message to a Matrix room
     * 
     * @param roomId - The Matrix room ID
     * @param matrixEvent - The Matrix event to send
     */
    public async sendFormattedMessage(
        roomId: string,
        matrixEvent: MatrixEvent
    ): Promise<string | null> {
        const foundryMessage = matrixEvent;
        const content = foundryMessage.content || '';
        const formattedContent = foundryMessage.formattedContent || content;
        
        return this.sendMessage(roomId, content, formattedContent);
    }
    
    /**
     * Sends a typing indicator to a Matrix room
     * 
     * @param roomId - The Matrix room ID
     * @param isTyping - Whether the user is typing
     */
    public async sendTypingIndicator(
        roomId: string,
        isTyping: boolean
    ): Promise<boolean> {
        if (!this.matrixClient) {
            this.logger.error('Matrix client not initialized');
            return false;
        }
        
        try {
            if (isTyping) {
                await this.matrixClient.sendTyping(roomId, this.getBotUserId(), true);
            } else {
                await this.matrixClient.sendTyping(roomId, this.getBotUserId(), false);
            }
            return true;
        } catch (error) {
            this.logger.error(`Failed to send typing indicator to Matrix room ${roomId}:`, error);
            return false;
        }
    }
    
    /**
     * Gets the bot's Matrix user ID
     */
    private getBotUserId(): string {
        return `@${this.config.sender_localpart || '_foundry_bridge'}:${new URL(this.config.homeserver).hostname}`;
    }
    
    /**
     * Gets a user's display name
     * 
     * @param userId - The Matrix user ID
     */
    public async getUserDisplayName(userId: string): Promise<string> {
        if (!this.matrixClient) {
            return userId;
        }
        
        try {
            const user = await this.matrixClient.getUser(userId);
            return user.displayname || userId.split(':')[0].replace('@', '');
        } catch (error) {
            this.logger.warn(`Failed to get display name for ${userId}:`, error);
            return userId.split(':')[0].replace('@', '');
        }
    }
    
    /**
     * Gets the Foundry world ID for a Matrix room
     * 
     * @param roomId - The Matrix room ID
     */
    private async getFoundryWorldId(roomId: string): Promise<string | null> {
        // In a real implementation, this would look up the mapping
        // For now, return a default or check config
        return this.config.default_world || null;
    }
    
    /**
     * Joins a Matrix room
     * 
     * @param roomIdOrAlias - The room ID or alias
     */
    public async joinRoom(roomIdOrAlias: string): Promise<string | null> {
        if (!this.matrixClient) {
            this.logger.error('Matrix client not initialized');
            return null;
        }
        
        try {
            const response = await this.matrixClient.joinRoom(roomIdOrAlias);
            this.logger.info(`Joined Matrix room: ${response.room_id}`);
            return response.room_id;
        } catch (error) {
            this.logger.error(`Failed to join Matrix room ${roomIdOrAlias}:`, error);
            return null;
        }
    }
    
    /**
     * Leaves a Matrix room
     * 
     * @param roomId - The room ID
     */
    public async leaveRoom(roomId: string): Promise<boolean> {
        if (!this.matrixClient) {
            this.logger.error('Matrix client not initialized');
            return false;
        }
        
        try {
            await this.matrixClient.leaveRoom(roomId);
            this.logger.info(`Left Matrix room: ${roomId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to leave Matrix room ${roomId}:`, error);
            return false;
        }
    }
    
    /**
     * Gets the members of a Matrix room
     * 
     * @param roomId - The room ID
     */
    public async getRoomMembers(roomId: string): Promise<string[]> {
        if (!this.matrixClient) {
            this.logger.error('Matrix client not initialized');
            return [];
        }
        
        try {
            const members = await this.matrixClient.getRoomMembers(roomId);
            return members.map(m => m.userId);
        } catch (error) {
            this.logger.error(`Failed to get members of Matrix room ${roomId}:`, error);
            return [];
        }
    }
    
    /**
     * Creates a ghost user in Matrix for a Foundry user
     * 
     * @param foundryUserId - The Foundry user ID
     */
    public async createGhostUser(foundryUserId: string): Promise<string | null> {
        // In a real implementation, this would create a virtual user
        // For now, return a synthetic user ID
        const ghostUserId = `@_foundry_${foundryUserId}:${new URL(this.config.homeserver).hostname}`;
        
        this.logger.info(`Created ghost user mapping: ${foundryUserId} -> ${ghostUserId}`);
        
        // Store the mapping
        this.userMapper.addMapping(ghostUserId, foundryUserId);
        
        return ghostUserId;
    }
    
    /**
     * Gets the Application Service instance
     */
    public getAppService(): AppService | null {
        return this.appService;
    }
    
    /**
     * Gets the Matrix client instance
     */
    public getMatrixClient(): MatrixClient | null {
        return this.matrixClient;
    }
    
    /**
     * Checks if the Application Service is running
     */
    public isRunning(): boolean {
        return this.appService !== null;
    }
    
    /**
     * Gets statistics about the Application Service
     */
    public getStats(): object {
        return {
            isRunning: this.isRunning(),
            roomCount: this.roomMembers.size,
            typingUsers: Array.from(this.typingUsers.entries()).reduce(
                (sum, [, users]) => sum + users.size,
                0
            ),
            botUserId: this.getBotUserId(),
        };
    }
}
