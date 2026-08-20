/**
 * User Mapper
 * 
 * Handles bidirectional user identity mapping between Matrix and FoundryVTT.
 * Supports explicit configuration, automatic matching, and ghost user creation.
 */

import { Logger } from '../utils/Logger';
import { BridgeConfig, IUserMappingConfig } from './BridgeConfig';

/**
 * User mapping interface
 */
export interface IUserMapping {
    matrixUserId: string;
    foundryUserId: string;
    displayName?: string;
    isGhost: boolean;
    permissions: string[];
    lastActive?: number;
}

/**
 * Ghost user settings
 */
export interface IGhostUserSettings {
    prefix: string;
    permissions: string[];
    displayNameFormat: string;
    avatarUrl?: string;
}

/**
 * User mapping strategy
 */
export type UserMappingStrategy = 'explicit' | 'automatic' | 'create_ghost' | 'ignore' | 'error';

/**
 * UserMapper class
 * 
 * Manages user identity mapping between Matrix and FoundryVTT:
 * - Explicit user mappings from configuration
 * - Automatic username matching
 * - Ghost user creation for unmapped users
 * - Bidirectional lookup
 */
export class UserMapper {
    private logger: Logger;
    private config: BridgeConfig;
    private userConfig: IUserMappingConfig | null = null;
    
    // User mappings (Matrix user ID -> Foundry user ID)
    private matrixToFoundry: Map<string, IUserMapping> = new Map();
    
    // User mappings (Foundry user ID -> Matrix user ID)
    private foundryToMatrix: Map<string, IUserMapping> = new Map();
    
    // Ghost users (Matrix user ID -> Foundry user ID)
    private ghostUsers: Map<string, IUserMapping> = new Map();
    
    // Default ghost user settings
    private defaultGhostSettings: IGhostUserSettings;
    
    // Default strategy for unmapped users
    private defaultStrategy: UserMappingStrategy = 'create_ghost';
    
    // User cache for automatic matching
    private matrixUserCache: Map<string, { displayName: string; avatarUrl?: string }> = new Map();
    private foundryUserCache: Map<string, { displayName: string; avatarUrl?: string }> = new Map();
    
    /**
     * Creates a new UserMapper instance
     * 
     * @param config - Bridge configuration
     */
    constructor(config: BridgeConfig) {
        this.logger = new Logger('UserMapper');
        this.config = config;
        
        // Load user mapping configuration
        this.loadUserConfig();
        
        // Initialize default ghost settings
        this.defaultGhostSettings = {
            prefix: 'Matrix_',
            permissions: ['chat'],
            displayNameFormat: '{prefix}{displayName}',
        };
        
        // Load default strategy from config
        if (this.userConfig?.default?.strategy) {
            this.defaultStrategy = this.userConfig.default.strategy;
        }
        
        // Load ghost settings from config
        if (this.userConfig?.default?.ghost) {
            this.defaultGhostSettings = {
                ...this.defaultGhostSettings,
                ...this.userConfig.default.ghost,
            };
        }
        
        // Initialize with explicit mappings
        this.initializeExplicitMappings();
    }
    
    /**
     * Loads user mapping configuration
     */
    private loadUserConfig(): void {
        try {
            // In a real implementation, this would load from users.yaml
            // For now, we'll use the config directly
            this.userConfig = this.config.get('users') || null;
            this.logger.info('Loaded user mapping configuration');
        } catch (error) {
            this.logger.error('Failed to load user mapping configuration:', error as Error);
        }
    }
    
    /**
     * Initializes explicit user mappings from configuration
     */
    private initializeExplicitMappings(): void {
        if (!this.userConfig?.mappings) {
            return;
        }
        
        for (const [key, value] of Object.entries(this.userConfig.mappings)) {
            // Check if this is a Matrix -> Foundry mapping
            if (key.startsWith('@')) {
                // Matrix user ID -> Foundry user ID
                this.addMapping(key, value, false);
            } else {
                // Foundry user ID -> Matrix user ID
                this.addMapping(value, key, false);
            }
        }
        
        this.logger.info(`Loaded ${this.matrixToFoundry.size} explicit user mappings`);
    }
    
    /**
     * Adds a user mapping
     * 
     * @param matrixUserId - The Matrix user ID
     * @param foundryUserId - The Foundry user ID
     * @param isGhost - Whether this is a ghost user
     */
    public addMapping(
        matrixUserId: string,
        foundryUserId: string,
        isGhost: boolean = false
    ): void {
        // Normalize user IDs
        const normalizedMatrix = this.normalizeMatrixUserId(matrixUserId);
        const normalizedFoundry = this.normalizeFoundryUserId(foundryUserId);
        
        // Get display names
        const matrixDisplayName = this.getMatrixDisplayName(normalizedMatrix);
        const foundryDisplayName = this.getFoundryDisplayName(normalizedFoundry);
        
        // Create mapping
        const mapping: IUserMapping = {
            matrixUserId: normalizedMatrix,
            foundryUserId: normalizedFoundry,
            displayName: matrixDisplayName || foundryDisplayName || normalizedFoundry,
            isGhost,
            permissions: isGhost ? this.defaultGhostSettings.permissions : ['chat', 'view', 'interact'],
        };
        
        // Store in both directions
        this.matrixToFoundry.set(normalizedMatrix, mapping);
        this.foundryToMatrix.set(normalizedFoundry, mapping);
        
        if (isGhost) {
            this.ghostUsers.set(normalizedMatrix, mapping);
        }
        
        this.logger.info(`Added user mapping: ${normalizedMatrix} <-> ${normalizedFoundry}`);
    }
    
    /**
     * Removes a user mapping
     * 
     * @param matrixUserId - The Matrix user ID
     */
    public removeMapping(matrixUserId: string): boolean {
        const normalized = this.normalizeMatrixUserId(matrixUserId);
        const mapping = this.matrixToFoundry.get(normalized);
        
        if (mapping) {
            this.matrixToFoundry.delete(normalized);
            this.foundryToMatrix.delete(mapping.foundryUserId);
            this.ghostUsers.delete(normalized);
            
            this.logger.info(`Removed user mapping: ${normalized} <-> ${mapping.foundryUserId}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Gets the Foundry user ID for a Matrix user ID
     * 
     * @param matrixUserId - The Matrix user ID
     * @param createGhost - Whether to create a ghost user if no mapping exists
     */
    public getFoundryUser(matrixUserId: string, createGhost: boolean = true): string | null {
        const normalized = this.normalizeMatrixUserId(matrixUserId);
        
        // Check explicit mapping
        const mapping = this.matrixToFoundry.get(normalized);
        if (mapping) {
            return mapping.foundryUserId;
        }
        
        // Try automatic matching
        const autoMatch = this.tryAutomaticMatch(normalized);
        if (autoMatch) {
            this.addMapping(normalized, autoMatch, false);
            return autoMatch;
        }
        
        // Create ghost user if enabled
        if (createGhost && this.defaultStrategy === 'create_ghost') {
            const ghostUserId = this.createGhostUser(normalized);
            return ghostUserId;
        }
        
        // Log and return null
        this.logger.warn(`No Foundry user mapping for Matrix user: ${normalized}`);
        return null;
    }
    
    /**
     * Gets the Matrix user ID for a Foundry user ID
     * 
     * @param foundryUserId - The Foundry user ID
     */
    public getMatrixUser(foundryUserId: string): string | null {
        const normalized = this.normalizeFoundryUserId(foundryUserId);
        
        // Check explicit mapping
        const mapping = this.foundryToMatrix.get(normalized);
        if (mapping) {
            return mapping.matrixUserId;
        }
        
        // Try automatic matching
        const autoMatch = this.tryAutomaticMatch(normalized, true);
        if (autoMatch) {
            this.addMapping(autoMatch, normalized, false);
            return autoMatch;
        }
        
        // Log and return null
        this.logger.warn(`No Matrix user mapping for Foundry user: ${normalized}`);
        return null;
    }
    
    /**
     * Gets a user mapping by Matrix user ID
     * 
     * @param matrixUserId - The Matrix user ID
     */
    public getMappingByMatrix(matrixUserId: string): IUserMapping | null {
        const normalized = this.normalizeMatrixUserId(matrixUserId);
        return this.matrixToFoundry.get(normalized) || null;
    }
    
    /**
     * Gets a user mapping by Foundry user ID
     * 
     * @param foundryUserId - The Foundry user ID
     */
    public getMappingByFoundry(foundryUserId: string): IUserMapping | null {
        const normalized = this.normalizeFoundryUserId(foundryUserId);
        return this.foundryToMatrix.get(normalized) || null;
    }
    
    /**
     * Gets all user mappings
     */
    public getAllMappings(): IUserMapping[] {
        return Array.from(this.matrixToFoundry.values());
    }
    
    /**
     * Gets all ghost users
     */
    public getAllGhostUsers(): IUserMapping[] {
        return Array.from(this.ghostUsers.values());
    }
    
    /**
     * Creates a ghost user for a Matrix user
     * 
     * @param matrixUserId - The Matrix user ID
     */
    public createGhostUser(matrixUserId: string): string {
        const normalized = this.normalizeMatrixUserId(matrixUserId);
        
        // Get display name from Matrix
        const matrixDisplayName = this.getMatrixDisplayName(normalized);
        
        // Generate ghost user ID
        const ghostUserId = this.generateGhostUserId(normalized, matrixDisplayName);
        
        // Add mapping
        this.addMapping(normalized, ghostUserId, true);
        
        this.logger.info(`Created ghost user: ${normalized} -> ${ghostUserId}`);
        
        return ghostUserId;
    }
    
    /**
     * Generates a ghost user ID
     * 
     * @param matrixUserId - The Matrix user ID
     * @param displayName - The user's display name
     */
    private generateGhostUserId(matrixUserId: string, displayName?: string): string {
        // Use display name if available
        if (displayName) {
            // Clean up display name for use as username
            const cleanName = displayName
                .replace(/[^a-zA-Z0-9_]/g, '_')
                .substring(0, 32);
            
            return `${this.defaultGhostSettings.prefix}${cleanName}`;
        }
        
        // Fall back to user ID
        const localPart = matrixUserId.split(':')[0].replace('@', '');
        const cleanLocalPart = localPart
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .substring(0, 32);
        
        return `${this.defaultGhostSettings.prefix}${cleanLocalPart}`;
    }
    
    /**
     * Tries to automatically match a user based on display name
     * 
     * @param userId - The user ID to match
     * @param isFoundry - Whether the user ID is from Foundry
     */
    private tryAutomaticMatch(userId: string, isFoundry: boolean = false): string | null {
        if (!this.config.isFeatureEnabled('ghost_users')) {
            return null;
        }
        
        try {
            const displayName = isFoundry 
                ? this.getFoundryDisplayName(userId)
                : this.getMatrixDisplayName(userId);
            
            if (!displayName) {
                return null;
            }
            
            // Normalize display name for matching
            const normalizedDisplayName = displayName
                .toLowerCase()
                .replace(/[^a-zA-Z0-9]/g, '');
            
            // Search for matching users
            if (isFoundry) {
                // Find Matrix user with matching display name
                for (const [matrixUserId, userData] of this.matrixUserCache) {
                    const matrixNormalized = userData.displayName
                        .toLowerCase()
                        .replace(/[^a-zA-Z0-9]/g, '');
                    
                    if (matrixNormalized === normalizedDisplayName) {
                        return matrixUserId;
                    }
                }
            } else {
                // Find Foundry user with matching display name
                for (const [foundryUserId, userData] of this.foundryUserCache) {
                    const foundryNormalized = userData.displayName
                        .toLowerCase()
                        .replace(/[^a-zA-Z0-9]/g, '');
                    
                    if (foundryNormalized === normalizedDisplayName) {
                        return foundryUserId;
                    }
                }
            }
            
            return null;
        } catch (error) {
            this.logger.error('Error in automatic user matching:', error as Error);
            return null;
        }
    }
    
    /**
     * Normalizes a Matrix user ID
     * 
     * @param userId - The Matrix user ID
     */
    private normalizeMatrixUserId(userId: string): string {
        // Ensure it starts with @
        if (!userId.startsWith('@')) {
            return `@${userId}`;
        }
        return userId;
    }
    
    /**
     * Normalizes a Foundry user ID
     * 
     * @param userId - The Foundry user ID
     */
    private normalizeFoundryUserId(userId: string): string {
        // Foundry user IDs are typically just the username
        return userId.trim();
    }
    
    /**
     * Gets the display name for a Matrix user
     * 
     * @param userId - The Matrix user ID
     */
    private getMatrixDisplayName(userId: string): string | undefined {
        const cached = this.matrixUserCache.get(userId);
        if (cached) {
            return cached.displayName;
        }
        
        // In a real implementation, we would fetch from Matrix
        // For now, extract from user ID
        const localPart = userId.split(':')[0].replace('@', '');
        return localPart;
    }
    
    /**
     * Gets the display name for a Foundry user
     * 
     * @param userId - The Foundry user ID
     */
    private getFoundryDisplayName(userId: string): string | undefined {
        const cached = this.foundryUserCache.get(userId);
        if (cached) {
            return cached.displayName;
        }
        
        // In a real implementation, we would fetch from Foundry
        // For now, just return the user ID
        return userId;
    }
    
    /**
     * Updates the Matrix user cache
     * 
     * @param userId - The Matrix user ID
     * @param displayName - The display name
     * @param avatarUrl - The avatar URL
     */
    public updateMatrixUserCache(
        userId: string,
        displayName: string,
        avatarUrl?: string
    ): void {
        const normalized = this.normalizeMatrixUserId(userId);
        this.matrixUserCache.set(normalized, { displayName, avatarUrl });
        
        // Try to match with Foundry users
        const foundryMatch = this.tryAutomaticMatch(normalized);
        if (foundryMatch) {
            this.addMapping(normalized, foundryMatch, false);
        }
    }
    
    /**
     * Updates the Foundry user cache
     * 
     * @param userId - The Foundry user ID
     * @param displayName - The display name
     * @param avatarUrl - The avatar URL
     */
    public updateFoundryUserCache(
        userId: string,
        displayName: string,
        avatarUrl?: string
    ): void {
        const normalized = this.normalizeFoundryUserId(userId);
        this.foundryUserCache.set(normalized, { displayName, avatarUrl });
        
        // Try to match with Matrix users
        const matrixMatch = this.tryAutomaticMatch(normalized, true);
        if (matrixMatch) {
            this.addMapping(matrixMatch, normalized, false);
        }
    }
    
    /**
     * Checks if a user is a ghost user
     * 
     * @param matrixUserId - The Matrix user ID
     */
    public isGhostUser(matrixUserId: string): boolean {
        const normalized = this.normalizeMatrixUserId(matrixUserId);
        const mapping = this.matrixToFoundry.get(normalized);
        return mapping ? mapping.isGhost : false;
    }
    
    /**
     * Gets the display name for a user
     * 
     * @param userId - The user ID (Matrix or Foundry)
     * @param isMatrix - Whether the user ID is from Matrix
     */
    public getDisplayName(userId: string, isMatrix: boolean = true): string | undefined {
        if (isMatrix) {
            const mapping = this.getMappingByMatrix(userId);
            return mapping?.displayName;
        } else {
            const mapping = this.getMappingByFoundry(userId);
            return mapping?.displayName;
        }
    }
    
    /**
     * Sets the default strategy for unmapped users
     * 
     * @param strategy - The strategy to use
     */
    public setDefaultStrategy(strategy: UserMappingStrategy): void {
        this.defaultStrategy = strategy;
        this.logger.info(`Set default user mapping strategy to: ${strategy}`);
    }
    
    /**
     * Gets the current default strategy
     */
    public getDefaultStrategy(): UserMappingStrategy {
        return this.defaultStrategy;
    }
    
    /**
     * Updates ghost user settings
     * 
     * @param settings - The ghost user settings
     */
    public updateGhostSettings(settings: Partial<IGhostUserSettings>): void {
        this.defaultGhostSettings = {
            ...this.defaultGhostSettings,
            ...settings,
        };
        this.logger.info('Updated ghost user settings:', settings);
    }
    
    /**
     * Gets the current ghost user settings
     */
    public getGhostSettings(): IGhostUserSettings {
        return { ...this.defaultGhostSettings };
    }
    
    /**
     * Clears all user mappings
     */
    public clearAllMappings(): void {
        this.matrixToFoundry.clear();
        this.foundryToMatrix.clear();
        this.ghostUsers.clear();
        this.matrixUserCache.clear();
        this.foundryUserCache.clear();
        
        this.logger.info('Cleared all user mappings');
    }
    
    /**
     * Loads user mappings from a file
     * 
     * @param filePath - The path to the mappings file
     */
    public async loadMappingsFromFile(filePath: string): Promise<void> {
        // In a real implementation, this would load from a JSON or YAML file
        this.logger.info(`Loading user mappings from: ${filePath}`);
    }
    
    /**
     * Saves user mappings to a file
     * 
     * @param filePath - The path to save to
     */
    public async saveMappingsToFile(filePath: string): Promise<void> {
        // In a real implementation, this would save to a JSON or YAML file
        this.logger.info(`Saving user mappings to: ${filePath}`);
    }
    
    /**
     * Gets statistics about the user mapper
     */
    public getStats(): object {
        return {
            explicitMappings: this.matrixToFoundry.size - this.ghostUsers.size,
            ghostUsers: this.ghostUsers.size,
            totalMappings: this.matrixToFoundry.size,
            cachedMatrixUsers: this.matrixUserCache.size,
            cachedFoundryUsers: this.foundryUserCache.size,
            defaultStrategy: this.defaultStrategy,
        };
    }
}
