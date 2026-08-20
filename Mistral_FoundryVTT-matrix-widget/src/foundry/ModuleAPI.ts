/**
 * FoundryVTT Module API Client
 * 
 * Provides REST API communication with a FoundryVTT module for tighter integration.
 * This enables features like:
 * - Full dice roller integration
 * - Generic attribute/skill checks (SYSTEM-AGNOSTIC - works with any FoundryVTT game system)
 * - Saving throws
 * - Character sheet data
 * - Equipment and inventory access
 * - Custom module events
 * 
 * SYSTEM-AGNOSTIC DESIGN:
 * This API is designed to work with ANY FoundryVTT game system (D&D 5e, Alien RPG,
 * Call of Cthulhu, etc.). It discovers available attributes from characters at
 * runtime rather than hardcoding specific attributes like "strength" or "dexterity".
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
 * Generic check request - works with any game system
 */
export interface IAttributeCheckRequest {
    worldId: string;
    userId: string;
    characterId?: string; // Optional - if omitted, just rolls dice
    attribute: string; // Path to the attribute (e.g., "attributes.agility", "skills.stealth", "characteristics.stress")
    dc?: number; // Target number to beat
    advantage?: boolean;
    disadvantage?: boolean;
    displayName?: string; // Custom display name for the check
}

/**
 * Generic check response
 */
export interface IAttributeCheckResponse {
    id: string;
    userId: string;
    characterId?: string | null;
    attribute: string;
    attributeName: string;
    roll: number;
    dc?: number | null;
    success?: boolean;
    criticalSuccess?: boolean;
    criticalFailure?: boolean;
    modifier: number;
    total: number;
    breakdown: string;
    timestamp: number;
}

/**
 * Saving throw request - works with any game system
 */
export interface ISavingThrowRequest {
    worldId: string;
    userId: string;
    characterId?: string;
    attribute: string; // Path to the save attribute
    dc: number; // Required - target number
    advantage?: boolean;
    disadvantage?: boolean;
}

/**
 * Saving throw response
 */
export interface ISavingThrowResponse {
    id: string;
    userId: string;
    characterId?: string | null;
    attribute: string;
    attributeName: string;
    roll: number;
    dc: number;
    success: boolean;
    criticalSuccess?: boolean;
    criticalFailure?: boolean;
    modifier: number;
    total: number;
    breakdown: string;
    timestamp: number;
}

/**
 * Simple dice check request
 */
export interface ISimpleCheckRequest {
    worldId: string;
    userId: string;
    characterId?: string;
    expression: string; // Dice expression (e.g., "1d20 + 5")
    dc?: number;
    displayName?: string;
}

/**
 * Simple check response
 */
export interface ISimpleCheckResponse {
    id: string;
    userId: string;
    characterId?: string | null;
    expression: string;
    roll: number;
    dc?: number | null;
    success?: boolean;
    criticalSuccess?: boolean;
    criticalFailure?: boolean;
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
    fields?: string[]; // Specific fields to retrieve (optional)
}

/**
 * Character data response
 */
export interface ICharacterDataResponse {
    id: string;
    name: string;
    type: string;
    system: string;
    data: Record<string, any>;
    timestamp: number;
}

/**
 * Available checks for a character
 */
export interface IAvailableChecks {
    byCategory: {
        attributes: Array<{ name: string; path: string; label: string }>;
        skills: Array<{ name: string; path: string; label: string }>;
        saves: Array<{ name: string; path: string; label: string }>;
        custom: Array<{ name: string; path: string; label: string }>;
    };
    flatList: Array<{ name: string; path: string; label: string; category: string }>;
    system: string;
}

/**
 * Discover attributes response
 */
export interface IDiscoverAttributesResponse {
    characterId: string;
    characterName: string;
    system: string;
    attributes: {
        attributes: Array<{ name: string; path: string; label: string }>;
        skills: Array<{ name: string; path: string; label: string }>;
        saves: Array<{ name: string; path: string; label: string }>;
        custom: Array<{ name: string; path: string; label: string }>;
    };
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
 * Character attribute info
 */
export interface ICharacterAttributeInfo {
    id: string;
    name: string;
    type: string;
    system: string;
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
    features: {
        apiEnabled: boolean;
        diceRoller: boolean;
        attributeChecks: boolean;
        savingThrows: boolean;
        characterData: boolean;
        itemSearch: boolean;
        chatMessages: boolean;
        events: boolean;
    };
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
 * System information
 */
export interface ISystemInfo {
    systemId: string;
    systemTitle: string;
    systemVersion: string;
    worldId: string;
    worldTitle: string;
}

/**
 * ModuleAPI class
 * 
 * Communicates with a FoundryVTT module via REST API for:
 * - Dice rolls with full Foundry dice roller
 * - Generic attribute checks (works with ANY game system)
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
    
    // Current system info
    private currentSystem: ISystemInfo | null = null;
    
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
            
            // Get current system
            const systemInfo = await this.getCurrentSystem();
            if (systemInfo) {
                this.currentSystem = systemInfo;
                this.logger.info(`Current system: ${systemInfo.systemTitle} (${systemInfo.systemId})`);
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
     * Gets the current game system information
     */
    public async getCurrentSystem(): Promise<ISystemInfo | null> {
        try {
            const response = await this.makeRequest<ISystemInfo>('/checks/system');
            return response.data || null;
        } catch (error) {
            this.logger.error('Failed to get current system:', error as Error);
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
     * Executes an attribute check (SYSTEM-AGNOSTIC)
     * Works with ANY FoundryVTT game system
     * 
     * @param request - The attribute check request
     */
    public async checkAttribute(request: IAttributeCheckRequest): Promise<IAttributeCheckResponse | null> {
        try {
            const response = await this.makeRequest<IAttributeCheckResponse>('/checks/attribute', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.info(`Attribute check: ${request.attribute} = ${result.roll}`);
                
                // Emit check event
                this.emit('attributeCheck', {
                    worldId: request.worldId,
                    attribute: request.attribute,
                    result,
                });
            }
            
            return result || null;
        } catch (error) {
            this.logger.error('Failed to check attribute:', error as Error);
            return null;
        }
    }
    
    /**
     * Executes a saving throw (SYSTEM-AGNOSTIC)
     * 
     * @param request - The saving throw request
     */
    public async saveThrow(request: ISavingThrowRequest): Promise<ISavingThrowResponse | null> {
        try {
            const response = await this.makeRequest<ISavingThrowResponse>('/checks/save', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.info(`Saving throw: ${request.attribute} vs DC ${request.dc} = ${result.roll} (${result.success ? 'saved' : 'failed'})`);
                
                // Emit saving throw event
                this.emit('savingThrow', {
                    worldId: request.worldId,
                    attribute: request.attribute,
                    dc: request.dc,
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
     * Executes a simple dice check
     * 
     * @param request - The simple check request
     */
    public async simpleCheck(request: ISimpleCheckRequest): Promise<ISimpleCheckResponse | null> {
        try {
            const response = await this.makeRequest<ISimpleCheckResponse>('/checks/simple', 'POST', request);
            const result = response.data;
            
            if (result) {
                this.logger.info(`Simple check: ${request.expression} = ${result.roll}`);
            }
            
            return result || null;
        } catch (error) {
            this.logger.error('Failed to perform simple check:', error as Error);
            return null;
        }
    }
    
    /**
     * Gets available checks for a character
     * This discovers what attributes/skills/saves are available for checking
     * based on the character's game system
     * 
     * @param characterId - The character ID
     */
    public async getAvailableChecks(characterId: string): Promise<IAvailableChecks | null> {
        try {
            const response = await this.makeRequest<IAvailableChecks>(`/checks/available/${characterId}`);
            return response.data || null;
        } catch (error) {
            this.logger.error(`Failed to get available checks for character ${characterId}:`, error as Error);
            return null;
        }
    }
    
    /**
     * Discovers all attributes for a character
     * 
     * @param characterId - The character ID
     */
    public async discoverCharacterAttributes(characterId: string): Promise<IDiscoverAttributesResponse | null> {
        try {
            const response = await this.makeRequest<IDiscoverAttributesResponse>(`/checks/discover/${characterId}`);
            return response.data || null;
        } catch (error) {
            this.logger.error(`Failed to discover attributes for character ${characterId}:`, error as Error);
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
     * Gets all characters in a world
     * 
     * @param worldId - The world ID
     */
    public async getAllCharacters(worldId: string): Promise<ICharacterAttributeInfo[]> {
        try {
            const response = await this.makeRequest<ICharacterAttributeInfo[]>(`/characters?worldId=${worldId}`);
            return response.data || [];
        } catch (error) {
            this.logger.error(`Failed to get characters for world ${worldId}:`, error as Error);
            return [];
        }
    }
    
    /**
     * Gets a specific character
     * 
     * @param characterId - The character ID
     */
    public async getCharacterById(characterId: string): Promise<ICharacterAttributeInfo | null> {
        try {
            const response = await this.makeRequest<ICharacterAttributeInfo>(`/characters/${characterId}`);
            return response.data || null;
        } catch (error) {
            this.logger.error(`Failed to get character ${characterId}:`, error as Error);
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
     * Gets the current system ID
     */
    public getCurrentSystemId(): string | null {
        return this.currentSystem?.systemId || null;
    }
    
    /**
     * Gets the current system title
     */
    public getCurrentSystemTitle(): string | null {
        return this.currentSystem?.systemTitle || null;
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
            currentSystem: this.currentSystem,
        };
    }
}
