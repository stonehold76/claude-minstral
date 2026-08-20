/**
 * Configuration Management
 * 
 * Handles loading, saving, and managing module configuration.
 */

const MODULE_ID = 'matrix-bridge';
const CONFIG_FILE = `modules/${MODULE_ID}/config.json`;

// Default configuration
const DEFAULT_CONFIG = {
    apiEnabled: true,
    apiPort: 30001,
    apiToken: '',
    allowCORS: true,
    corsOrigins: '*',
    logLevel: 'info',
    maxConnections: 10,
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Load configuration from file
 */
export function loadConfig() {
    try {
        // Check if file exists
        if (game.modules.get(MODULE_ID)?.data.path) {
            const configPath = game.modules.get(MODULE_ID).data.path + '/config.json';
            
            // Read config file
            return fetch(configPath)
                .then(response => response.json())
                .then(data => {
                    config = { ...DEFAULT_CONFIG, ...data };
                    return config;
                })
                .catch(() => {
                    // If file doesn't exist or can't be read, use defaults
                    saveConfig(config);
                    return config;
                });
        }
    } catch (error) {
        console.error(`[${MODULE_ID}] Error loading config:`, error);
    }
    
    // If we can't load from file, use defaults
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
        if (game.modules.get(MODULE_ID)?.data.path) {
            const configPath = game.modules.get(MODULE_ID).data.path + '/config.json';
            
            // In Foundry, we can't directly write files, but we can use the FilePicker
            // For now, we'll just store in memory
            console.log(`[${MODULE_ID}] Config saved to memory (persist via settings dialog)`);
        }
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
