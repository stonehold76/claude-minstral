/**
 * State Synchronization Engine
 * 
 * Handles synchronization of state between Matrix and FoundryVTT:
 * - Room membership
 * - User presence
 * - Typing indicators
 * - Read receipts
 * - Custom game state
 */

import { Logger } from '../utils/Logger';
import { BridgeConfig } from './BridgeConfig';
import { UserMapper } from './UserMapper';
import { MatrixAppService } from '../matrix/MatrixAppService';
import { FoundryClient } from '../foundry/FoundryClient';
import { MatrixEventType, MatrixPresence } from '../models/MatrixEvent';

/**
 * Room membership state
 */
export interface IRoomMembershipState {
    matrixRoomId: string;
    foundryWorldId: string;
    matrixUsers: Set<string>;
    foundryUsers: Set<string>;
    lastSync: number;
}

/**
 * User presence state
 */
export interface IUserPresenceState {
    userId: string;
    matrixPresence?: MatrixPresence;
    foundryPresence?: boolean;
    matrixLastActive?: number;
    foundryLastActive?: number;
}

/**
 * Typing state
 */
export interface ITypingState {
    roomId: string;
    matrixTyping: Set<string>;
    foundryTyping: Set<string>;
    lastSync: number;
}

/**
 * Read receipt state
 */
export interface IReadReceiptState {
    roomId: string;
    matrixReceipts: Map<string, string>; // userId -> eventId
    foundryReceipts: Map<string, string>; // userId -> messageId
}

/**
 * Sync direction
 */
export type SyncDirection = 'matrix_to_foundry' | 'foundry_to_matrix' | 'both' | 'none';

/**
 * Sync configuration for a room
 */
export interface IRoomSyncConfig {
    matrixRoomId: string;
    foundryWorldId: string;
    direction: SyncDirection;
    syncMembership: boolean;
    syncPresence: boolean;
    syncTyping: boolean;
    syncReadReceipts: boolean;
}

/**
 * StateSync class
 * 
 * Manages state synchronization between Matrix and FoundryVTT:
 * - Tracks room membership in both systems
 * - Synchronizes user presence
 * - Manages typing indicators
 * - Handles read receipts
 */
export class StateSync {
    private logger: Logger;
    private config: BridgeConfig;
    private userMapper: UserMapper;
    private matrixAppService: MatrixAppService | null = null;
    private foundryClient: FoundryClient | null = null;
    
    // Room membership states
    private roomMembershipStates: Map<string, IRoomMembershipState> = new Map();
    
    // User presence states
    private userPresenceStates: Map<string, IUserPresenceState> = new Map();
    
    // Typing states
    private typingStates: Map<string, ITypingState> = new Map();
    
    // Read receipt states
    private readReceiptStates: Map<string, IReadReceiptState> = new Map();
    
    // Room sync configurations
    private roomSyncConfigs: Map<string, IRoomSyncConfig> = new Map();
    
    // Sync intervals
    private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
    
    // Feature flags
    private features: {
        syncMembership: boolean;
        syncPresence: boolean;
        syncTyping: boolean;
        syncReadReceipts: boolean;
    };
    
    /**
     * Creates a new StateSync instance
     * 
     * @param config - Bridge configuration
     * @param userMapper - User mapper instance
     */
    constructor(config: BridgeConfig, userMapper: UserMapper) {
        this.logger = new Logger('StateSync');
        this.config = config;
        this.userMapper = userMapper;
        
        // Initialize feature flags from config
        this.features = {
            syncMembership: config.isFeatureEnabled('presence_sync'),
            syncPresence: config.isFeatureEnabled('presence_sync'),
            syncTyping: config.isFeatureEnabled('typing_indicators'),
            syncReadReceipts: config.isFeatureEnabled('read_receipts'),
        };
    }
    
    /**
     * Initializes the state synchronization engine
     * 
     * @param matrixAppService - Matrix Application Service instance
     * @param foundryClient - Foundry Client instance
     */
    public initialize(
        matrixAppService: MatrixAppService,
        foundryClient: FoundryClient
    ): void {
        this.matrixAppService = matrixAppService;
        this.foundryClient = foundryClient;
        
        this.logger.info('StateSync initialized');
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Sets up event listeners for Matrix and Foundry events
     */
    private setupEventListeners(): void {
        if (!this.matrixAppService || !this.foundryClient) {
            return;
        }
        
        // Matrix event listeners
        this.matrixAppService.on('roomMember', this.handleMatrixRoomMember.bind(this));
        this.matrixAppService.on('presence', this.handleMatrixPresence.bind(this));
        this.matrixAppService.on('typing', this.handleMatrixTyping.bind(this));
        this.matrixAppService.on('receipt', this.handleMatrixReceipt.bind(this));
        
        // Foundry event listeners
        this.foundryClient.on('userJoined', this.handleFoundryUserJoined.bind(this));
        this.foundryClient.on('userLeft', this.handleFoundryUserLeft.bind(this));
        this.foundryClient.on('typing', this.handleFoundryTyping.bind(this));
    }
    
    /**
     * Adds a room for synchronization
     * 
     * @param matrixRoomId - The Matrix room ID
     * @param foundryWorldId - The Foundry world ID
     * @param config - Optional sync configuration
     */
    public addRoom(
        matrixRoomId: string,
        foundryWorldId: string,
        config?: Partial<IRoomSyncConfig>
    ): void {
        const roomId = this.getRoomKey(matrixRoomId, foundryWorldId);
        
        const syncConfig: IRoomSyncConfig = {
            matrixRoomId,
            foundryWorldId,
            direction: 'both',
            syncMembership: this.features.syncMembership,
            syncPresence: this.features.syncPresence,
            syncTyping: this.features.syncTyping,
            syncReadReceipts: this.features.syncReadReceipts,
            ...config,
        };
        
        this.roomSyncConfigs.set(roomId, syncConfig);
        
        // Initialize room state
        this.roomMembershipStates.set(roomId, {
            matrixRoomId,
            foundryWorldId,
            matrixUsers: new Set(),
            foundryUsers: new Set(),
            lastSync: Date.now(),
        });
        
        this.typingStates.set(roomId, {
            roomId,
            matrixTyping: new Set(),
            foundryTyping: new Set(),
            lastSync: Date.now(),
        });
        
        this.readReceiptStates.set(roomId, {
            roomId,
            matrixReceipts: new Map(),
            foundryReceipts: new Map(),
        });
        
        // Start periodic sync
        this.startRoomSync(roomId);
        
        this.logger.info(`Added room for sync: ${matrixRoomId} <-> ${foundryWorldId}`);
    }
    
    /**
     * Removes a room from synchronization
     * 
     * @param matrixRoomId - The Matrix room ID
     * @param foundryWorldId - The Foundry world ID
     */
    public removeRoom(matrixRoomId: string, foundryWorldId: string): void {
        const roomId = this.getRoomKey(matrixRoomId, foundryWorldId);
        
        // Stop sync interval
        this.stopRoomSync(roomId);
        
        // Remove from maps
        this.roomSyncConfigs.delete(roomId);
        this.roomMembershipStates.delete(roomId);
        this.typingStates.delete(roomId);
        this.readReceiptStates.delete(roomId);
        
        this.logger.info(`Removed room from sync: ${matrixRoomId} <-> ${foundryWorldId}`);
    }
    
    /**
     * Gets the room key for a Matrix-Foundry pair
     * 
     * @param matrixRoomId - The Matrix room ID
     * @param foundryWorldId - The Foundry world ID
     */
    private getRoomKey(matrixRoomId: string, foundryWorldId: string): string {
        return `${matrixRoomId}||${foundryWorldId}`;
    }
    
    /**
     * Starts periodic synchronization for a room
     * 
     * @param roomId - The room key
     */
    private startRoomSync(roomId: string): void {
        // Sync every 30 seconds
        const interval = setInterval(() => {
            this.syncRoom(roomId);
        }, 30000);
        
        this.syncIntervals.set(roomId, interval);
    }
    
    /**
     * Stops periodic synchronization for a room
     * 
     * @param roomId - The room key
     */
    private stopRoomSync(roomId: string): void {
        const interval = this.syncIntervals.get(roomId);
        if (interval) {
            clearInterval(interval);
            this.syncIntervals.delete(roomId);
        }
    }
    
    /**
     * Synchronizes state for a room
     * 
     * @param roomId - The room key
     */
    private syncRoom(roomId: string): void {
        const config = this.roomSyncConfigs.get(roomId);
        if (!config) {
            return;
        }
        
        this.logger.debug(`Syncing room: ${config.matrixRoomId} <-> ${config.foundryWorldId}`);
        
        // Sync membership if enabled
        if (config.syncMembership && this.features.syncMembership) {
            this.syncRoomMembership(roomId);
        }
        
        // Sync presence if enabled
        if (config.syncPresence && this.features.syncPresence) {
            this.syncUserPresence(roomId);
        }
        
        // Sync typing if enabled
        if (config.syncTyping && this.features.syncTyping) {
            this.syncTyping(roomId);
        }
        
        // Sync read receipts if enabled
        if (config.syncReadReceipts && this.features.syncReadReceipts) {
            this.syncReadReceipts(roomId);
        }
    }
    
    /**
     * Synchronizes room membership between Matrix and Foundry
     * 
     * @param roomId - The room key
     */
    private async syncRoomMembership(roomId: string): Promise<void> {
        const state = this.roomMembershipStates.get(roomId);
        const config = this.roomSyncConfigs.get(roomId);
        
        if (!state || !config) {
            return;
        }
        
        try {
            // Get Matrix room members
            if (this.matrixAppService) {
                const matrixMembers = await this.matrixAppService.getRoomMembers(config.matrixRoomId);
                state.matrixUsers = new Set(matrixMembers);
            }
            
            // Get Foundry world users
            if (this.foundryClient) {
                const foundryUsers = this.foundryClient.getAllUsers();
                state.foundryUsers = new Set(foundryUsers.map(u => u.id));
            }
            
            // Sync Matrix -> Foundry
            if (config.direction === 'matrix_to_foundry' || config.direction === 'both') {
                await this.syncMembershipToFoundry(state);
            }
            
            // Sync Foundry -> Matrix
            if (config.direction === 'foundry_to_matrix' || config.direction === 'both') {
                await this.syncMembershipToMatrix(state);
            }
            
            state.lastSync = Date.now();
            this.logger.info(`Synced membership for room: ${config.matrixRoomId}`);
        } catch (error) {
            this.logger.error('Error syncing room membership:', error as Error);
        }
    }
    
    /**
     * Synchronizes membership from Matrix to Foundry
     * 
     * @param state - The room membership state
     */
    private async syncMembershipToFoundry(state: IRoomMembershipState): Promise<void> {
        // In a real implementation, this would:
        // 1. Get Matrix users not in Foundry
        // 2. Create ghost users for them in Foundry
        // 3. Remove Foundry users that are no longer in Matrix
        
        this.logger.debug(`Syncing membership from Matrix to Foundry for ${state.matrixRoomId}`);
        
        // For now, just notify Foundry client
        if (this.foundryClient) {
            await this.foundryClient.syncRoomMembership(state.matrixRoomId, state.foundryWorldId);
        }
    }
    
    /**
     * Synchronizes membership from Foundry to Matrix
     * 
     * @param state - The room membership state
     */
    private async syncMembershipToMatrix(state: IRoomMembershipState): Promise<void> {
        // In a real implementation, this would:
        // 1. Invite Matrix users corresponding to Foundry users
        // 2. Kick Matrix users that are no longer in Foundry
        
        this.logger.debug(`Syncing membership from Foundry to Matrix for ${state.matrixRoomId}`);
    }
    
    /**
     * Handles Matrix room member events
     * 
     * @param event - The Matrix room member event
     */
    private async handleMatrixRoomMember(event: any): Promise<void> {
        const roomId = event.room_id;
        const userId = event.state_key;
        const membership = event.content?.membership;
        
        this.logger.debug(`Matrix room member event: ${userId} in ${roomId} (${membership})`);
        
        // Find rooms that include this Matrix room
        for (const [roomKey, config] of this.roomSyncConfigs) {
            if (config.matrixRoomId === roomId) {
                // Update room membership state
                const state = this.roomMembershipStates.get(roomKey);
                if (state) {
                    if (membership === 'join') {
                        state.matrixUsers.add(userId);
                    } else if (membership === 'leave' || membership === 'ban') {
                        state.matrixUsers.delete(userId);
                    }
                    
                    // Sync to Foundry
                    if (config.direction === 'matrix_to_foundry' || config.direction === 'both') {
                        await this.syncMembershipToFoundry(state);
                    }
                }
            }
        }
    }
    
    /**
     * Handles Foundry user joined events
     * 
     * @param foundryUserId - The Foundry user ID
     * @param foundryWorldId - The Foundry world ID
     */
    private async handleFoundryUserJoined(foundryUserId: string, foundryWorldId: string): Promise<void> {
        this.logger.debug(`Foundry user joined: ${foundryUserId} in ${foundryWorldId}`);
        
        // Find rooms that include this Foundry world
        for (const [roomKey, config] of this.roomSyncConfigs) {
            if (config.foundryWorldId === foundryWorldId) {
                // Update room membership state
                const state = this.roomMembershipStates.get(roomKey);
                if (state) {
                    state.foundryUsers.add(foundryUserId);
                    
                    // Update user cache
                    this.userMapper.updateFoundryUserCache(
                        foundryUserId,
                        foundryUserId, // Use user ID as display name for now
                        undefined
                    );
                    
                    // Sync to Matrix
                    if (config.direction === 'foundry_to_matrix' || config.direction === 'both') {
                        await this.syncMembershipToMatrix(state);
                    }
                }
            }
        }
    }
    
    /**
     * Handles Foundry user left events
     * 
     * @param foundryUserId - The Foundry user ID
     * @param foundryWorldId - The Foundry world ID
     */
    private async handleFoundryUserLeft(foundryUserId: string, foundryWorldId: string): Promise<void> {
        this.logger.debug(`Foundry user left: ${foundryUserId} from ${foundryWorldId}`);
        
        // Find rooms that include this Foundry world
        for (const [roomKey, config] of this.roomSyncConfigs) {
            if (config.foundryWorldId === foundryWorldId) {
                // Update room membership state
                const state = this.roomMembershipStates.get(roomKey);
                if (state) {
                    state.foundryUsers.delete(foundryUserId);
                    
                    // Sync to Matrix
                    if (config.direction === 'foundry_to_matrix' || config.direction === 'both') {
                        await this.syncMembershipToMatrix(state);
                    }
                }
            }
        }
    }
    
    /**
     * Synchronizes user presence between systems
     * 
     * @param roomId - The room key
     */
    private async syncUserPresence(roomId: string): Promise<void> {
        const config = this.roomSyncConfigs.get(roomId);
        if (!config) {
            return;
        }
        
        this.logger.debug(`Syncing user presence for room: ${roomId}`);
        
        // In a real implementation, this would:
        // 1. Get presence from Matrix
        // 2. Get presence from Foundry
        // 3. Sync in the appropriate direction
    }
    
    /**
     * Handles Matrix presence events
     * 
     * @param event - The Matrix presence event
     */
    private async handleMatrixPresence(event: any): Promise<void> {
        const userId = event.state_key;
        const presence = event.content?.presence;
        const lastActive = event.content?.last_active_ago;
        
        this.logger.debug(`Matrix presence: ${userId} is ${presence}`);
        
        // Update user presence state
        const state: IUserPresenceState = this.userPresenceStates.get(userId) || {
            userId,
        };
        
        state.matrixPresence = presence as MatrixPresence;
        state.matrixLastActive = Date.now() - (lastActive || 0);
        
        this.userPresenceStates.set(userId, state);
        
        // Sync to Foundry if user has a mapping
        const foundryUserId = this.userMapper.getFoundryUser(userId);
        if (foundryUserId && this.foundryClient) {
            // In a real implementation, send presence update to Foundry
            this.logger.debug(`Syncing presence to Foundry for ${userId} -> ${foundryUserId}`);
        }
    }
    
    /**
     * Synchronizes typing indicators between systems
     * 
     * @param roomId - The room key
     */
    private async syncTyping(roomId: string): Promise<void> {
        const config = this.roomSyncConfigs.get(roomId);
        const state = this.typingStates.get(roomId);
        
        if (!config || !state) {
            return;
        }
        
        this.logger.debug(`Syncing typing for room: ${roomId}`);
        
        // Sync Matrix -> Foundry
        if (config.direction === 'matrix_to_foundry' || config.direction === 'both') {
            for (const userId of state.matrixTyping) {
                const foundryUserId = this.userMapper.getFoundryUser(userId);
                if (foundryUserId && this.foundryClient) {
                    await this.foundryClient.sendTypingIndicator(
                        config.foundryWorldId,
                        foundryUserId,
                        true
                    );
                }
            }
        }
        
        // Sync Foundry -> Matrix
        if (config.direction === 'foundry_to_matrix' || config.direction === 'both') {
            for (const userId of state.foundryTyping) {
                const matrixUserId = this.userMapper.getMatrixUser(userId);
                if (matrixUserId && this.matrixAppService) {
                    await this.matrixAppService.sendTypingIndicator(
                        config.matrixRoomId,
                        true
                    );
                }
            }
        }
        
        state.lastSync = Date.now();
    }
    
    /**
     * Handles Matrix typing events
     * 
     * @param event - The Matrix typing event
     */
    private async handleMatrixTyping(event: any): Promise<void> {
        const roomId = event.room_id;
        const userId = event.sender;
        const userIds = event.content?.user_ids || [];
        const isTyping = userIds.includes(userId);
        
        this.logger.debug(`Matrix typing: ${userId} in ${roomId} (${isTyping ? 'typing' : 'not typing'})`);
        
        // Find rooms that include this Matrix room
        for (const [roomKey, config] of this.roomSyncConfigs) {
            if (config.matrixRoomId === roomId) {
                const state = this.typingStates.get(roomKey);
                if (state) {
                    if (isTyping) {
                        state.matrixTyping.add(userId);
                    } else {
                        state.matrixTyping.delete(userId);
                    }
                    
                    // Sync to Foundry
                    if (config.direction === 'matrix_to_foundry' || config.direction === 'both') {
                        const foundryUserId = this.userMapper.getFoundryUser(userId);
                        if (foundryUserId && this.foundryClient) {
                            await this.foundryClient.sendTypingIndicator(
                                config.foundryWorldId,
                                foundryUserId,
                                isTyping
                            );
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Handles Foundry typing events
     * 
     * @param foundryUserId - The Foundry user ID
     * @param foundryWorldId - The Foundry world ID
     * @param isTyping - Whether the user is typing
     */
    private async handleFoundryTyping(
        foundryUserId: string,
        foundryWorldId: string,
        isTyping: boolean
    ): Promise<void> {
        this.logger.debug(`Foundry typing: ${foundryUserId} in ${foundryWorldId} (${isTyping ? 'typing' : 'not typing'})`);
        
        // Find rooms that include this Foundry world
        for (const [roomKey, config] of this.roomSyncConfigs) {
            if (config.foundryWorldId === foundryWorldId) {
                const state = this.typingStates.get(roomKey);
                if (state) {
                    if (isTyping) {
                        state.foundryTyping.add(foundryUserId);
                    } else {
                        state.foundryTyping.delete(foundryUserId);
                    }
                    
                    // Sync to Matrix
                    if (config.direction === 'foundry_to_matrix' || config.direction === 'both') {
                        const matrixUserId = this.userMapper.getMatrixUser(foundryUserId);
                        if (matrixUserId && this.matrixAppService) {
                            await this.matrixAppService.sendTypingIndicator(
                                config.matrixRoomId,
                                isTyping
                            );
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Synchronizes read receipts between systems
     * 
     * @param roomId - The room key
     */
    private async syncReadReceipts(roomId: string): Promise<void> {
        const config = this.roomSyncConfigs.get(roomId);
        const state = this.readReceiptStates.get(roomId);
        
        if (!config || !state) {
            return;
        }
        
        this.logger.debug(`Syncing read receipts for room: ${roomId}`);
        
        // In a real implementation, this would:
        // 1. Get read receipts from Matrix
        // 2. Get read receipts from Foundry
        // 3. Sync in the appropriate direction
    }
    
    /**
     * Handles Matrix read receipt events
     * 
     * @param event - The Matrix receipt event
     */
    private async handleMatrixReceipt(event: any): Promise<void> {
        const roomId = event.room_id;
        const userId = event.sender;
        const content = event.content || {};
        
        this.logger.debug(`Matrix receipt: ${userId} in ${roomId}`);
        
        // Extract receipt information
        for (const [targetUserId, receipts] of Object.entries(content)) {
            for (const [eventId, receipt] of Object.entries(receipts)) {
                // Find rooms that include this Matrix room
                for (const [roomKey, config] of this.roomSyncConfigs) {
                    if (config.matrixRoomId === roomId) {
                        const state = this.readReceiptStates.get(roomKey);
                        if (state) {
                            state.matrixReceipts.set(userId, eventId);
                            
                            // Sync to Foundry
                            if (config.direction === 'matrix_to_foundry' || config.direction === 'both') {
                                const foundryUserId = this.userMapper.getFoundryUser(userId);
                                if (foundryUserId) {
                                    // In a real implementation, send read receipt to Foundry
                                    this.logger.debug(`Syncing read receipt to Foundry for ${userId} -> ${foundryUserId}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Updates feature flags
     * 
     * @param features - The feature flags to update
     */
    public updateFeatures(features: Partial<typeof this.features>): void {
        this.features = { ...this.features, ...features };
        this.logger.info('Updated state sync features:', features);
    }
    
    /**
     * Gets the current feature flags
     */
    public getFeatures(): typeof this.features {
        return { ...this.features };
    }
    
    /**
     * Gets statistics about the state synchronization
     */
    public getStats(): object {
        return {
            roomCount: this.roomSyncConfigs.size,
            membershipStates: this.roomMembershipStates.size,
            userPresenceStates: this.userPresenceStates.size,
            typingStates: this.typingStates.size,
            readReceiptStates: this.readReceiptStates.size,
            features: this.features,
        };
    }
    
    /**
     * Clears all state
     */
    public clearAllState(): void {
        this.roomMembershipStates.clear();
        this.userPresenceStates.clear();
        this.typingStates.clear();
        this.readReceiptStates.clear();
        
        // Stop all sync intervals
        for (const interval of this.syncIntervals.values()) {
            clearInterval(interval);
        }
        this.syncIntervals.clear();
        
        this.logger.info('Cleared all state synchronization data');
    }
}
