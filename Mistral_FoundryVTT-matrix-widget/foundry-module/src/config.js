/**
 * Configuration Management
 * 
 * Handles loading, saving, and managing module configuration.
 * Includes license enforcement for single-room usage.
 */

const MODULE_ID = 'matrix-bridge';

// Default configuration
const DEFAULT_CONFIG = {
    apiEnabled: true,
    apiPort: 30001,
    apiToken: '',
    allowCORS: true,
    corsOrigins: '*',
    logLevel: 'info',
    maxConnections: 10,
    
    // License settings
    licensedRoomId: null, // The Matrix room ID that is licensed to use this bridge
    enforceLicense: true, // Whether to enforce single-room license validation
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Load configuration from file
 */
export function loadConfig() {
    try {
        // Try to load from Foundry's module storage
        if (game.modules.get(MODULE_ID)?.data.path) {
            const configPath = game.modules.get(MODULE_ID).data.path + '/config.json';
            
            // In Foundry, we can use FilePicker or fetch
            // For now, we'll use a simple approach
            try {
                // This would be replaced with actual file loading in production
                return fetch(configPath)
                    .then(response => response.json())
                    .then(data => {
                        config = { ...DEFAULT_CONFIG, ...data };
                        return config;
                    })
                    .catch(() => {
                        // If file doesn't exist, use defaults
                        saveConfig(config);
                        return config;
                    });
            } catch (e) {
                return config;
            }
        }
    } catch (error) {
        console.error(`[${MODULE_ID}] Error loading config:`, error);
    }
    
    return config;
}

/**
 * Save configuration to file
 * 
 * @param {Object} newConfig - The new configuration to save
 */
export function saveConfig(newConfig) {
    config = { ...config, ...newConfig };
    
    try {
        // In Foundry, we would save to the module's data directory
        // For now, just log
        console.log(`[${MODULE_ID}] Config saved`);
    } catch (error) {
        console.error(`[${MODULE_ID}] Error saving config:`, error);
    }
}

/**
 * Get current configuration
 */
export function getConfig() {
    return config;
}

/**
 * Get a specific configuration value
 * 
 * @param {string} key - The configuration key
 */
export function getConfigValue(key) {
    return config[key];
}

/**
 * Set a specific configuration value
 * 
 * @param {string} key - The configuration key
 * @param {*} value - The value to set
 */
export function setConfigValue(key, value) {
    config[key] = value;
    saveConfig(config);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig() {
    config = { ...DEFAULT_CONFIG };
    saveConfig(config);
}

/**
 * Get configuration for API server
 */
export function getApiConfig() {
    return {
        enabled: config.apiEnabled,
        port: config.apiPort,
        token: config.apiToken,
        corsOrigins: config.corsOrigins,
        maxConnections: config.maxConnections,
    };
}

/**
 * Get configuration for logging
 */
export function getLogConfig() {
    return {
        level: config.logLevel,
    };
}

/**
 * Get license configuration
 */
export function getLicenseConfig() {
    return {
        licensedRoomId: config.licensedRoomId,
        enforceLicense: config.enforceLicense,
    };
}

/**
 * Set the licensed room ID
 * 
 * @param {string} roomId - The Matrix room ID to license
 */
export function setLicensedRoomId(roomId) {
    if (!roomId || typeof roomId !== 'string' || !roomId.startsWith('!')) {
        throw new Error('Invalid room ID: must be a valid Matrix room ID (starts with !)');
    }
    
    config.licensedRoomId = roomId;
    config.enforceLicense = true;
    saveConfig(config);
    
    console.log(`[${MODULE_ID}] Licensed room set to: ${roomId}`);
}

/**
 * Clear the licensed room ID
 */
export function clearLicensedRoomId() {
    config.licensedRoomId = null;
    saveConfig(config);
    
    console.log(`[${MODULE_ID}] Licensed room cleared - all rooms allowed`);
}

/**
 * Enable or disable license enforcement
 * 
 * @param {boolean} enforce - Whether to enforce license
 */
export function setLicenseEnforcement(enforce) {
    config.enforceLicense = enforce;
    saveConfig(config);
    
    console.log(`[${MODULE_ID}] License enforcement ${enforce ? 'enabled' : 'disabled'}`);
}

/**
 * Validate a room ID against the license
 * 
 * @param {string} roomId - The Matrix room ID to validate
 * @returns {Object} Validation result
 */
export function validateLicense(roomId) {
    const result = {
        valid: true,
        roomId: roomId,
        licensedRoomId: config.licensedRoomId,
        error: null,
    };
    
    // If enforcement is disabled, always valid
    if (!config.enforceLicense) {
        result.valid = true;
        return result;
    }
    
    // If no licensed room is set, all rooms are valid
    if (!config.licensedRoomId) {
        result.valid = true;
        return result;
    }
    
    // If no room ID provided, invalid
    if (!roomId) {
        result.valid = false;
        result.error = 'No room ID provided for license validation';
        return result;
    }
    
    // Check if room matches
    if (roomId !== config.licensedRoomId) {
        result.valid = false;
        result.error = `Room ${roomId} is not licensed. Only room ${config.licensedRoomId} is authorized.`;
        return result;
    }
    
    // Room matches
    result.valid = true;
    return result;
}

/**
 * Create a room validation response for the API
 * 
 * @param {Object} validation - Validation result
 * @returns {Object} Formatted response
 */
export function createRoomValidationResponse(validation) {
    return {
        success: validation.valid,
        roomId: validation.roomId,
        licensedRoomId: validation.licensedRoomId,
        isLicensed: validation.valid,
        error: validation.error,
        timestamp: Date.now(),
    };
}
