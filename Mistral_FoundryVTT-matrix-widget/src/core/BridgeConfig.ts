/**
 * Bridge Configuration
 * 
 * Central configuration for the Matrix-FoundryVTT bridge.
 * Includes FoundryVTT connection settings and Matrix integration settings.
 * 
 * LICENSE ENFORCEMENT:
 * This module supports single-room license validation to ensure the bridge
 * is only used in one Matrix room at a time, maintaining license integrity.
 */

/**
 * FoundryVTT connection configuration
 */
export interface IFoundryConfig {
    // Connection settings
    host: string;
    port: number;
    use_ssl: boolean;
    
    // Socket.IO settings
    socketio: boolean;
    socketio_path?: string;
    
    // API settings
    api_token?: string;
    api_enabled: boolean;
    api_port: number;
    
    // Module settings
    module_enabled: boolean;
    
    // License settings
    licensed_room_id?: string; // The Matrix room ID that is licensed to use this bridge
    enforce_license: boolean; // Whether to enforce single-room license validation
}

/**
 * Matrix connection configuration
 */
export interface IMatrixConfig {
    // Matrix server settings
    homeserver: string;
    id?: string; // Application Service ID
    sender_localpart?: string; // Sender localpart for AS
    
    // Authentication
    username?: string;
    password?: string;
    device_id?: string;
    
    // User token (for client-server API)
    user_token?: string;
    
    // Room settings
    default_room?: string;
    
    // Display settings
    display_name: string;
    avatar_url?: string;
}

/**
 * Scene background sync configuration
 */
export interface ISceneSyncConfig {
    enabled: boolean;
    // How often to check for scene changes (in milliseconds)
    check_interval: number;
    // Whether to use the scene background as the Matrix room background
    sync_background: boolean;
    // Quality/optimization settings
    thumbnail_mode: boolean; // Use thumbnail instead of full image
    max_image_size: number; // Max file size to transfer (in bytes)
}

/**
 * Room mapping configuration
 */
export interface IRoomMapping {
    [roomId: string]: string; // Maps Matrix room ID to Foundry world ID
}

/**
 * Bridge configuration
 */
export interface IBridgeConfig {
    foundry: IFoundryConfig;
    matrix: IMatrixConfig;
    scene_sync: ISceneSyncConfig;
    
    // Room mappings (Matrix room -> Foundry world)
    room_mappings: IRoomMapping;
    
    // Admin users (Matrix user IDs with admin privileges)
    admin_users: string[];
    
    // Default Foundry world for unmapped rooms
    default_world?: string;
    
    // General settings
    port: number; // Port for the bridge server
    log_level: 'debug' | 'info' | 'warn' | 'error';
    debug_mode: boolean;
    
    // Feature flags
    features: {
        ghost_users?: boolean;
        dice_rolls?: boolean;
        character_sync?: boolean;
        item_sync?: boolean;
        scene_sync?: boolean;
        license_enforcement?: boolean;
    };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: IBridgeConfig = {
    foundry: {
        host: 'localhost',
        port: 30000,
        use_ssl: false,
        socketio: true,
        api_enabled: true,
        api_port: 30001,
        module_enabled: true,
        enforce_license: true,
    },
    matrix: {
        homeserver: 'https://matrix.org',
        display_name: 'FoundryVTT Bridge',
    },
    scene_sync: {
        enabled: true,
        check_interval: 5000,
        sync_background: true,
        thumbnail_mode: false,
        max_image_size: 10 * 1024 * 1024, // 10MB
    },
    room_mappings: {},
    admin_users: [],
    port: 3001,
    log_level: 'info',
    debug_mode: false,
    features: {
        ghost_users: false,
        dice_rolls: true,
        character_sync: true,
        item_sync: true,
        scene_sync: true,
        license_enforcement: true,
    },
};

/**
 * Runtime configuration with additional state
 */
export interface IRuntimeConfig extends IBridgeConfig {
    // Runtime state
    is_connected: boolean;
    last_connect_time?: number;
    last_error?: string;
    
    // Current state
    current_world_id?: string;
    current_scene_id?: string;
    current_room_id?: string; // The Matrix room currently being served
    
    // License state
    license_valid: boolean;
    license_error?: string;
}

/**
 * Bridge Configuration Manager
 * 
 * Manages loading, saving, and validating bridge configuration.
 */
export class BridgeConfig {
    private config: IBridgeConfig;
    
    /**
     * Creates a new BridgeConfig instance
     */
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
    }
    
    /**
     * Loads configuration from file
     */
    public load(): void {
        // In a real implementation, this would load from a config file
        // For now, we'll use environment variables or defaults
        
        // Try to load from environment variables
        if (process.env.FOUNDRY_HOST) {
            this.config.foundry.host = process.env.FOUNDRY_HOST;
        }
        if (process.env.FOUNDRY_PORT) {
            this.config.foundry.port = parseInt(process.env.FOUNDRY_PORT);
        }
        if (process.env.FOUNDRY_USE_SSL) {
            this.config.foundry.use_ssl = process.env.FOUNDRY_USE_SSL === 'true';
        }
        if (process.env.MATRIX_HOMESERVER) {
            this.config.matrix.homeserver = process.env.MATRIX_HOMESERVER;
        }
        if (process.env.BRIDGE_PORT) {
            this.config.port = parseInt(process.env.BRIDGE_PORT);
        }
        
        // Load license settings from environment
        if (process.env.LICENSED_ROOM_ID) {
            this.config.foundry.licensed_room_id = process.env.LICENSED_ROOM_ID;
        }
        if (process.env.ENFORCE_LICENSE) {
            this.config.foundry.enforce_license = process.env.ENFORCE_LICENSE !== 'false';
        }
        
        console.log('Bridge configuration loaded');
    }
    
    /**
     * Saves configuration to file
     */
    public save(): void {
        // In a real implementation, this would save to a config file
        console.log('Bridge configuration saved');
    }
    
    /**
     * Validates the configuration
     * 
     * @returns Array of validation errors
     */
    public validate(): string[] {
        const errors: string[] = [];
        
        // Validate Foundry configuration
        if (!this.config.foundry.host) {
            errors.push('Foundry host is required');
        }
        if (!this.config.foundry.port) {
            errors.push('Foundry port is required');
        }
        
        // Validate Matrix configuration
        if (!this.config.matrix.homeserver) {
            errors.push('Matrix homeserver is required');
        }
        
        // Validate port
        if (!this.config.port) {
            errors.push('Bridge port is required');
        }
        
        return errors;
    }
    
    /**
     * Gets the Foundry configuration
     */
    public getFoundryConfig(): IFoundryConfig {
        return this.config.foundry;
    }
    
    /**
     * Gets the Matrix configuration
     */
    public getMatrixConfig(): IMatrixConfig {
        return this.config.matrix;
    }
    
    /**
     * Gets the bridge configuration
     */
    public getBridgeConfig(): IBridgeConfig {
        return this.config;
    }
    
    /**
     * Gets the scene sync configuration
     */
    public getSceneSyncConfig(): ISceneSyncConfig {
        return this.config.scene_sync;
    }
    
    /**
     * Sets the Foundry configuration
     * 
     * @param config - Foundry configuration
     */
    public setFoundryConfig(config: Partial<IFoundryConfig>): void {
        this.config.foundry = { ...this.config.foundry, ...config };
    }
    
    /**
     * Sets the Matrix configuration
     * 
     * @param config - Matrix configuration
     */
    public setMatrixConfig(config: Partial<IMatrixConfig>): void {
        this.config.matrix = { ...this.config.matrix, ...config };
    }
    
    /**
     * Sets the bridge configuration
     * 
     * @param config - Bridge configuration
     */
    public setBridgeConfig(config: Partial<IBridgeConfig>): void {
        this.config = { ...this.config, ...config };
    }
    
    /**
     * Checks if a feature is enabled
     * 
     * @param feature - Feature name
     * @returns Whether the feature is enabled
     */
    public isFeatureEnabled(feature: string): boolean {
        return this.config.features?.[feature] !== false;
    }
    
    /**
     * Sets a feature enabled/disabled
     * 
     * @param feature - Feature name
     * @param enabled - Whether to enable the feature
     */
    public setFeatureEnabled(feature: string, enabled: boolean): void {
        if (!this.config.features) {
            this.config.features = {};
        }
        this.config.features[feature] = enabled;
    }
    
    /**
     * Gets the full configuration
     */
    public getConfig(): IBridgeConfig {
        return this.config;
    }
}

/**
 * Load configuration from file
 */
export function loadConfig(): IBridgeConfig {
    // In a real implementation, this would load from a config file
    // For now, return defaults with environment variable overrides
    
    const config: IBridgeConfig = { ...DEFAULT_CONFIG };
    
    // Override from environment variables
    if (process.env.FOUNDRY_HOST) {
        config.foundry.host = process.env.FOUNDRY_HOST;
    }
    if (process.env.FOUNDRY_PORT) {
        config.foundry.port = parseInt(process.env.FOUNDRY_PORT);
    }
    if (process.env.FOUNDRY_USE_SSL) {
        config.foundry.use_ssl = process.env.FOUNDRY_USE_SSL === 'true';
    }
    if (process.env.MATRIX_HOMESERVER) {
        config.matrix.homeserver = process.env.MATRIX_HOMESERVER;
    }
    if (process.env.BRIDGE_PORT) {
        config.port = parseInt(process.env.BRIDGE_PORT);
    }
    if (process.env.LICENSED_ROOM_ID) {
        config.foundry.licensed_room_id = process.env.LICENSED_ROOM_ID;
    }
    if (process.env.ENFORCE_LICENSE) {
        config.foundry.enforce_license = process.env.ENFORCE_LICENSE !== 'false';
    }
    
    return config;
}

/**
 * Save configuration to file
 */
export function saveConfig(config: IBridgeConfig): void {
    // In a real implementation, this would save to a config file
    console.log('Configuration saved:', JSON.stringify(config, null, 2));
}
