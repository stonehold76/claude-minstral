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
    username: string;
    password: string;
    device_id?: string;
    
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
 * Complete bridge configuration
 */
export interface IBridgeConfig {
    foundry: IFoundryConfig;
    matrix: IMatrixConfig;
    scene_sync: ISceneSyncConfig;
    
    // General settings
    log_level: 'debug' | 'info' | 'warn' | 'error';
    debug_mode: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: IBridgeConfig = {
    foundry: {
        host: 'localhost',
        port: 30000,
        use_ssl: false,
        api_enabled: true,
        api_port: 30001,
        module_enabled: true,
        enforce_license: true,
    },
    matrix: {
        homeserver: 'https://matrix.org',
        username: '',
        password: '',
        display_name: 'FoundryVTT Bridge',
    },
    scene_sync: {
        enabled: true,
        check_interval: 5000,
        sync_background: true,
        thumbnail_mode: false,
        max_image_size: 10 * 1024 * 1024, // 10MB
    },
    log_level: 'info',
    debug_mode: false,
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
 * License validation result
 */
export interface ILicenseValidation {
    valid: boolean;
    room_id?: string;
    licensed_room_id?: string;
    error?: string;
    warning?: string;
}

/**
 * Room validation result for API responses
 */
export interface IRoomValidationResponse {
    success: boolean;
    room_id?: string;
    licensed_room_id?: string;
    is_licensed: boolean;
    error?: string;
    timestamp: number;
}

/**
 * Load configuration from file
 */
export function loadConfig(): IBridgeConfig {
    // In a real implementation, this would load from a config file
    // For now, return defaults
    return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file
 */
export function saveConfig(config: IBridgeConfig): void {
    // In a real implementation, this would save to a config file
    console.log('Configuration saved:', config);
}

/**
 * Validate license for a given room ID
 * 
 * This ensures the bridge is only used in the licensed Matrix room.
 * 
 * @param config - Foundry configuration
 * @param roomId - The Matrix room ID to validate
 * @returns License validation result
 */
export function validateLicense(config: IFoundryConfig, roomId?: string): ILicenseValidation {
    const result: ILicenseValidation = {
        valid: true,
    };
    
    // If license enforcement is disabled, always valid
    if (!config.enforce_license) {
        result.valid = true;
        result.warning = 'License enforcement is disabled';
        return result;
    }
    
    // If no licensed room is set, it's valid (unlimited)
    if (!config.licensed_room_id) {
        result.valid = true;
        result.warning = 'No licensed room configured - all rooms allowed';
        return result;
    }
    
    // If no room ID provided, it's invalid
    if (!roomId) {
        result.valid = false;
        result.error = 'No room ID provided for license validation';
        result.licensed_room_id = config.licensed_room_id;
        return result;
    }
    
    // Check if the room matches
    if (roomId !== config.licensed_room_id) {
        result.valid = false;
        result.room_id = roomId;
        result.licensed_room_id = config.licensed_room_id;
        result.error = `Room ${roomId} is not licensed. Only room ${config.licensed_room_id} is authorized for use with this bridge.`;
        return result;
    }
    
    // Room matches - valid
    result.valid = true;
    result.room_id = roomId;
    result.licensed_room_id = config.licensed_room_id;
    
    return result;
}

/**
 * Set the licensed room ID
 * 
 * Call this to configure which Matrix room is licensed to use the bridge.
 * 
 * @param config - Current configuration
 * @param roomId - The Matrix room ID to license
 * @returns Updated configuration
 */
export function setLicensedRoomId(config: IFoundryConfig, roomId: string): IFoundryConfig {
    console.log(`Setting licensed room ID to: ${roomId}`);
    return {
        ...config,
        licensed_room_id: roomId,
        enforce_license: true,
    };
}

/**
 * Clear the licensed room ID (disable license enforcement)
 * 
 * @param config - Current configuration
 * @returns Updated configuration
 */
export function clearLicensedRoomId(config: IFoundryConfig): IFoundryConfig {
    console.log('Clearing licensed room ID - all rooms allowed');
    return {
        ...config,
        licensed_room_id: undefined,
    };
}

/**
 * Create a room validation response for the API
 * 
 * @param validation - License validation result
 * @returns Formatted response
 */
export function createRoomValidationResponse(validation: ILicenseValidation): IRoomValidationResponse {
    return {
        success: validation.valid,
        room_id: validation.room_id,
        licensed_room_id: validation.licensed_room_id,
        is_licensed: validation.valid,
        error: validation.error,
        timestamp: Date.now(),
    };
}
