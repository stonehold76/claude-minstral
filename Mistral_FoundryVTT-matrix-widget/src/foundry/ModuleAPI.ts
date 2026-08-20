/**
 * FoundryVTT Module API Client
 * 
 * Provides REST API communication with a FoundryVTT module for tighter integration.
 * This enables features like:
 * - Full dice roller integration
 * - Skill checks and ability checks
 * - Equipment and inventory access
 * - Character sheet data
 * - Custom module events
 */

import { Logger } from '../utils/Logger';
import { IFoundryConfig } from '../core/BridgeConfig';
import { FoundryMessage, FoundryUser, FoundryWorld, DiceRollResult } from './FoundryClient';
import { EventEmitter } from 'events';

/**
 * Module API response wrapper
 */
export interface IModuleResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: number;
}

/**
 * Dice roll request
 */
export interface IDiceRollRequest {
    worldId: string;
    userId: string;
    expression: string;
    whisperTo?: string[];
    blind?: boolean;
}

/**
 * Dice roll response (from Foundry)
 */
export interface IDiceRollResponse {
    id: string;
    userId: string;
    worldId: string;
    expression: string;
    result: string;
    total: number;
    rolls: number[][];
    whisperTo?: string[];
    blind?: boolean;
    timestamp: number;
}

/**
 * Skill check request
 */
export interface ISkillCheckRequest {
    worldId: string;
    userId: string;
    characterId?: string;
    skill: string;
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
}

/**
 * Skill check response
 */
export interface ISkillCheckResponse {
    id: string;
    userId: string;
    characterId?: string;
    skill: string;
    roll: number;
    dc?: number;
    success: boolean;
    criticalSuccess?: boolean;
    criticalFailure?: boolean;
    total: number;
    breakdown: string;
    timestamp: number;
}

/**
 * Ability check request
 */
export interface IAbilityCheckRequest {
    worldId: string;
    userId: string;
    characterId?: string;
    ability: string;
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
}

/**
 * Ability check response
 */
export interface IAbilityCheckResponse {
    id: string;
    userId: string;
    characterId?: string;
    ability: string;
    roll: number;
    dc?: number;
    success: boolean;
    criticalSuccess?: boolean;
    criticalFailure?: boolean;
    modifier: number;
    total: number;
    breakdown: string;
    timestamp: number;
}

/**
 * Saving throw request
 */
export interface ISavingThrowRequest {
    worldId: string;
    userId: string;
    characterId?: string;
    ability: string;
    dc: number;
    advantage?: boolean;
    disadvantage?: boolean;
}

/**
 * Saving throw response
 */
export interface ISavingThrowResponse {
    id: string;
    userId: string;
    characterId?: string;
    ability: string;
    roll: number;
    dc: number;
    success: boolean;
    modifier: number;
    total: number;
    breakdown: string;
    timestamp: number;
}

/**
 * Character data request
 */
export interface ICharacterDataRequest {
    worldId: string;
    characterId: string;
    fields?: string[]; // Specific fields to retrieve
}

/**
 * Character data response
 */
export interface ICharacterDataResponse {
    id: string;
    name: string;
    system: string;
    data: Record<string, any>;
    timestamp: number;
}

/**
 * Equipment/Item request
 */
export interface IItemRequest {
    worldId: string;
    characterId?: string; // If null, search all items in world
    itemId?: string; // Specific item ID
    itemName?: string; // Search by name
    type?: string; // Filter by item type
}

/**
 * Item data response
 */
export interface IItemDataResponse {
    id: string;
    name: string;
    type: string;
    data: Record<string, any>;
    ownerId?: string;
    timestamp: number;
}

/**
 * Chat message request (to send to Foundry)
 */
export interface IChatMessageRequest {
    worldId: string;
    userId: string;
    content: string;
    formattedContent?: string;
    type?: 'chat' | 'whisper' | 'emote' | 'oob';
    whisperTo?: string[];
}

/**
 * Chat message response
 */
export interface IChatMessageResponse {
    id: string;
    worldId: string;
    userId: string;
    content: string;
    formattedContent?: string;
    timestamp: number;
}

/**
 * Module information
 */
export interface IModuleInfo {
    id: string;
    title: string;
    description: string;
    version: string;
    author: string;
    compatibleCoreVersion: string;
    minimumCoreVersion: string;
}

/**
 * World information from module
 */
export interface IModuleWorldInfo {
    id: string;
    title: string;
    system: string;
    isActive: boolean;
    players: IModuleUserInfo[];
    gmIds: string[];
}

/**
 * User information from module
 */
export interface IModuleUserInfo {
    id: string;
    name: string;
    isGM: boolean;
    avatar?: string;
    color?: string;
}

/**
 * ModuleAPI class
 * 
 * Communicates with a FoundryVTT module via REST API for:
 * - Dice rolls with full Foundry dice roller
 * - Skill checks and ability checks
 * - Saving throws
 * - Character sheet data
 * - Equipment and items
 * - Custom module events
 */
export class ModuleAPI extends EventEmitter {
    private logger: Logger;
    private config: IFoundryConfig;
    private baseUrl: string;
    private apiToken: string | null = null;
    
    // Connection state
    private isConnected: boolean = false;
    
    // Module info cache
    private moduleInfo: IModuleInfo | null = null;
    
    // World cache
    private worlds: Map<string, IModuleWorldInfo> = new Map();
    
    // User cache
    private users: Map<string, IModuleUserInfo> = new Map();
    
    /**
     * Creates a new ModuleAPI instance
     * 
     * @param config - FoundryVTT configuration
     */
    constructor(config: IFoundryConfig) {
        super();
        this.logger = new Logger('ModuleAPI');
        this.config = config;
        
        // Build base URL
        const protocol = config.use_ssl ? 'https' : 'http';
        const host = config.host;
        const port = config.port;
        this.baseUrl = `${protocol}://${host}:${port}`;
        
        // Set API token
        if (config.api_token) {
            this.apiToken = config.api_token;
        }
    }
    
    /**
     * Initializes the Module API connection
     */
    public async initialize(): Promise<void> {
        this.logger.info('Initializing Module API...');
        
        try {
            // Get module info
            const info = await this.getModuleInfo();
            if (info) {
                this.moduleInfo = info;
                this.logger.info(`Connected to module: ${info.title} v${info.version}`);
            }
            
            // Get worlds
            const worlds = await this.getWorlds();
            for (const world of worlds) {
                this.worlds.set(world.id, world);
                this.logger.debug(`Loaded world: ${world.title} (${world.id})`);
            }
            
            this.isConnected = true;
            this.logger.info('Module API initialized');
        } catch (error) {
            this.logger.error('Failed to initialize Module API:', error as Error);
            throw error;
        }
    }
    
    /**
     * Makes an API request
     * 
     * @param endpoint - The API endpoint
     * @param method - HTTP method
     * @param data - Request data
     */
    private async makeRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        data?: any
    ): Promise<IModuleResponse<T>> {
        const url = `${this.baseUrl}/api/matrix-bridge${endpoint}`;
        
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        // Add authorization if token is available
        if (this.apiToken) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${this.apiToken}`,
            };
        }
        
        // Add body for non-GET requests
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            // Use fetch (available in Node.js 18+)
            const response = await fetch(url, options);
            const result = await response.json() as IModuleResponse<T>;
            
            if (!result.success) {
                this.logger.error(`API request failed: ${result.error || 'Unknown error'}`, {
                    endpoint,
                    method,
                    status: response.status,
                });
                throw new Error(result.error || 'API request failed');
            }
            
            return result;
        } catch (error) {
            this.logger.error(`API request error: ${endpoint}`, error as Error);
            throw error;
        }
    }
    
    /**
     * Gets module information
     */
    public async getModuleInfo(): Promise<IModuleInfo | null> {
        try {
            const response = await this.makeRequest<IModuleInfo>('/info');
            return response.data || null;
        } catch (error) {
            this.logger.error('Failed to get module info:', error as Error);
            return null;
        }
    }
    
    /**
     * Gets all worlds
     */
    public async getWorlds(): Promise<IModuleWorldInfo[]> {
        try {
            const response = await this.makeRequest<IModuleWorldInfo[]>('/worlds');
            return response.data || [];
        } catch (error) {
            this.logger.error('Failed to get worlds:', error as Error);
            return [];
        }
    }
    
    /**
     * Gets a specific world
     * 
     * @param worldId - The world ID
     */
    public async getWorld(worldId: string): Promise<IModuleWorldInfo | null> {
        // Check cache first
        if (this.worlds.has(worldId)) {
            return this.worlds.get(worldId)!;
        }
        
        try {
            const response = await this.makeRequest<IModuleWorldInfo>(`/worlds/${worldId}`);
            const world = response.data;
            if (world) {
                this.worlds.set(worldId, world);
            }
            return world || null;
        } catch (error) {
            this.logger.error(`Failed to get world ${worldId}:`, error as Error);
            return null;
        }
    }
    
    /**
     * Gets all users in a world
     * 
     * @param worldId - The world ID
     */
    public async getUsers(worldId: string): Promise<IModuleUserInfo[]> {
        try {
            const response = await this.makeRequest<IModuleUserInfo[]>(`/worlds/${worldId}/users`);
            return response.data || [];
        } catch (error) {
            this.logger.error(`Failed to get users for world ${worldId}:`, error as Error);
            return [];
        }
    }
    
    /**
     * Gets a specific user
     * 
     * @param userId - The user ID
     */
    public async getUser(userId: string): Promise<IModuleUserInfo | null> {
        // Check cache first
        if (this.users.has(userId)) {
            return this.users.get(userId)!;
        }
        
        try {
            const response = await this.makeRequest<IModuleUserInfo>(`/users/${userId}`);
            const user = response.data;
            if (user) {
                this.users.set(userId, user);
            }
            return user || null;
        } catch (error) {
            this.logger.error(`Failed to get user ${userId}:`, error as Error);
            return null;
        }
    }
    
    /**
     * Executes a dice roll in Foundry
     * 
     * @param request - The dice roll request
     */
    public async rollDice(request: IDiceRollRequest): Promise<IDiceRollResponse | null> {
        try {
            const response = await this.makeRequest<IDiceRollResponse>('/dice/roll', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.info(`Dice roll: ${request.expression} = ${result.total}`);
                
                // Emit dice roll event
                this.emit('diceRoll', {
                    userId: result.userId,
                    worldId: result.worldId,
                    rollResult: {
                        userId: result.userId,
                        worldId: result.worldId,
                        expression: result.expression,
                        result: result.result,
                        total: result.total,
                        rolls: result.rolls,
                        timestamp: result.timestamp,
                    } as DiceRollResult,
                });
            }
            
            return result || null;
        } catch (error) {
            this.logger.error('Failed to roll dice:', error as Error);
            return null;
        }
    }
    
    /**
     * Executes a skill check in Foundry
     * 
     * @param request - The skill check request
     */
    public async checkSkill(request: ISkillCheckRequest): Promise<ISkillCheckResponse | null> {
        try {
            const response = await this.makeRequest<ISkillCheckResponse>('/checks/skill', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.info(`Skill check: ${request.skill} = ${result.roll} (${result.success ? 'success' : 'failure'})`);
                
                // Emit skill check event
                this.emit('skillCheck', {
                    worldId: result.userId,
                    skill: result.skill,
                    result,
                });
            }
            
            return result || null;
        } catch (error) {
            this.logger.error('Failed to check skill:', error as Error);
            return null;
        }
    }
    
    /**
     * Executes an ability check in Foundry
     * 
     * @param request - The ability check request
     */
    public async checkAbility(request: IAbilityCheckRequest): Promise<IAbilityCheckResponse | null> {
        try {
            const response = await this.makeRequest<IAbilityCheckResponse>('/checks/ability', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.info(`Ability check: ${request.ability} = ${result.roll} (${result.success ? 'success' : 'failure'})`);
                
                // Emit ability check event
                this.emit('abilityCheck', {
                    worldId: result.userId,
                    ability: result.ability,
                    result,
                });
            }
            
            return result || null;
        } catch (error) {
            this.logger.error('Failed to check ability:', error as Error);
            return null;
        }
    }
    
    /**
     * Executes a saving throw in Foundry
     * 
     * @param request - The saving throw request
     */
    public async saveThrow(request: ISavingThrowRequest): Promise<ISavingThrowResponse | null> {
        try {
            const response = await this.makeRequest<ISavingThrowResponse>('/checks/save', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.info(`Saving throw: ${request.ability} vs DC ${request.dc} = ${result.roll} (${result.success ? 'saved' : 'failed'})`);
                
                // Emit saving throw event
                this.emit('savingThrow', {
                    worldId: result.userId,
                    ability: result.ability,
                    dc: result.dc,
                    result,
                });
            }
            
            return result || null;
        } catch (error) {
            this.logger.error('Failed to save throw:', error as Error);
            return null;
        }
    }
    
    /**
     * Gets character data
     * 
     * @param request - The character data request
     */
    public async getCharacter(request: ICharacterDataRequest): Promise<ICharacterDataResponse | null> {
        try {
            const response = await this.makeRequest<ICharacterDataResponse>('/characters/get', 'POST', request);
            return response.data || null;
        } catch (error) {
            this.logger.error('Failed to get character data:', error as Error);
            return null;
        }
    }
    
    /**
     * Gets item data
     * 
     * @param request - The item request
     */
    public async getItem(request: IItemRequest): Promise<IItemDataResponse[] | null> {
        try {
            const response = await this.makeRequest<IItemDataResponse[]>('/items/search', 'POST', request);
            return response.data || null;
        } catch (error) {
            this.logger.error('Failed to get item data:', error as Error);
            return null;
        }
    }
    
    /**
     * Sends a chat message to Foundry
     * 
     * @param request - The chat message request
     */
    public async sendChatMessage(request: IChatMessageRequest): Promise<IChatMessageResponse | null> {
        try {
            const response = await this.makeRequest<IChatMessageResponse>('/chat/send', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.debug(`Sent chat message: ${result.id}`);
                
                // Emit message event
                this.emit('message', {
                    worldId: result.worldId,
                    userId: result.userId,
                    message: {
                        id: result.id,
                        worldId: result.worldId,
                        sender: result.userId,
                        content: result.content,
                        formattedContent: result.formattedContent,
                        timestamp: result.timestamp,
                    } as FoundryMessage,
                });
            }
            
            return result || null;
        } catch (error) {
            this.logger.error('Failed to send chat message:', error as Error);
            return null;
        }
    }
    
    /**
     * Subscribes to module events via WebSocket or Server-Sent Events
     * 
     * @param callback - Callback for events
     */
    public async subscribeToEvents(callback: (event: string, data: any) => void): Promise<void> {
        // In a real implementation, this would establish a WebSocket or SSE connection
        // For now, just log and use polling
        this.logger.info('Event subscription not yet implemented (use polling for now)');
    }
    
    /**
     * Polls for new events from the module
     */
    public async pollEvents(): Promise<void> {
        try {
            const response = await this.makeRequest<any[]>('/events/poll');
            const events = response.data || [];
            
            for (const event of events) {
                this.emit(event.type, event.data);
            }
        } catch (error) {
            this.logger.error('Failed to poll events:', error as Error);
        }
    }
    
    /**
     * Gets the current world ID for a user
     * 
     * @param userId - The user ID
     */
    public async getCurrentWorld(userId: string): Promise<string | null> {
        try {
            const response = await this.makeRequest<{ worldId: string }>(`/users/${userId}/current-world`);
            return response.data?.worldId || null;
        } catch (error) {
            this.logger.error(`Failed to get current world for user ${userId}:`, error as Error);
            return null;
        }
    }
    
    /**
     * Gets the list of characters for a user
     * 
     * @param userId - The user ID
     */
    public async getCharacters(userId: string): Promise<ICharacterDataResponse[] | null> {
        try {
            const response = await this.makeRequest<ICharacterDataResponse[]>(`/users/${userId}/characters`);
            return response.data || null;
        } catch (error) {
            this.logger.error(`Failed to get characters for user ${userId}:`, error as Error);
            return null;
        }
    }
    
    /**
     * Executes a custom module command
     * 
     * @param command - The command name
     * @param data - Command data
     */
    public async executeCommand(command: string, data: any = {}): Promise<any | null> {
        try {
            const response = await this.makeRequest<any>(`/commands/${command}`, 'POST', data);
            return response.data || null;
        } catch (error) {
            this.logger.error(`Failed to execute command ${command}:`, error as Error);
            return null;
        }
    }
    
    /**
     * Checks if connected to the module
     */
    public isConnectedToModule(): boolean {
        return this.isConnected && this.moduleInfo !== null;
    }
    
    /**
     * Gets the module information
     */
    public getModuleInformation(): IModuleInfo | null {
        return this.moduleInfo;
    }
    
    /**
     * Gets all cached worlds
     */
    public getAllWorlds(): IModuleWorldInfo[] {
        return Array.from(this.worlds.values());
    }
    
    /**
     * Gets all cached users
     */
    public getAllUsers(): IModuleUserInfo[] {
        return Array.from(this.users.values());
    }
    
    /**
     * Updates the API token
     * 
     * @param token - The new API token
     */
    public updateApiToken(token: string): void {
        this.apiToken = token;
        this.logger.info('Updated API token');
    }
    
    /**
     * Clears all caches
     */
    public clearCaches(): void {
        this.worlds.clear();
        this.users.clear();
        this.logger.info('Cleared all caches');
    }
    
    /**
     * Gets statistics about the Module API
     */
    public getStats(): object {
        return {
            isConnected: this.isConnected,
            moduleInfo: this.moduleInfo,
            worldCount: this.worlds.size,
            userCount: this.users.size,
            baseUrl: this.baseUrl,
            hasApiToken: !!this.apiToken,
        };
    }
}
