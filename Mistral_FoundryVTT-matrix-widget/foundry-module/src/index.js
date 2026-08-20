/**
 * Matrix Bridge Module for FoundryVTT
 * 
 * Entry point for the module. Initializes both the Foundry hooks
 * and the REST API server for communication with the Matrix bridge.
 */

// Module metadata
const MODULE_ID = 'matrix-bridge';
const MODULE_TITLE = 'Matrix Bridge';
const MODULE_VERSION = '1.0.0';

// Import module components
import { registerHooks } from './foundry/hooks.js';
import { startApiServer, stopApiServer } from './api/server.js';
import { loadConfig, saveConfig, getConfig } from './config.js';

// Global state
let apiServer = null;
let config = null;

// =============================================================================
// FOUNDRY HOOKS
// =============================================================================

/**
 * Initialize the module when Foundry starts
 */
Hooks.once('init', () => {
    console.log(`[${MODULE_ID}] Initializing ${MODULE_TITLE} v${MODULE_VERSION}...`);
    
    try {
        // Load configuration
        config = loadConfig();
        
        // Register Foundry hooks
        registerHooks(config);
        
        // Start API server if enabled
        if (config.apiEnabled) {
            apiServer = startApiServer(config);
        } else {
            console.log(`[${MODULE_ID}] API server is disabled`);
        }
        
        console.log(`[${MODULE_ID}] ${MODULE_TITLE} initialized successfully`);
        
        // Add settings button
        addSettingsButton();
        
    } catch (error) {
        console.error(`[${MODULE_ID}] Failed to initialize:`, error);
        ui.notifications.error(`[${MODULE_ID}] Failed to initialize: ${error.message}`);
    }
});

/**
 * Clean up when Foundry closes
 */
Hooks.once('close', () => {
    console.log(`[${MODULE_ID}] Cleaning up...`);
    
    // Stop API server
    if (apiServer) {
        stopApiServer();
        apiServer = null;
    }
    
    console.log(`[${MODULE_ID}] Cleanup complete`);
});

/**
 * Handle world ready event
 */
Hooks.once('ready', () => {
    console.log(`[${MODULE_ID}] World is ready`);
    
    // Initialize world-specific features
    initializeWorld();
});

// =============================================================================
// WORLD INITIALIZATION
// =============================================================================

/**
 * Initialize world-specific features
 */
function initializeWorld() {
    const world = game.world;
    console.log(`[${MODULE_ID}] World: ${world.title} (${world.id})`);
    
    // Store world info for API access
    // This will be used by the API routes
    globalThis.currentWorld = {
        id: world.id,
        title: world.title,
        system: world.system,
        active: true,
    };
    
    // Update users cache
    updateUsersCache();
    
    // Listen for user changes
    Hooks.on('userConnected', (user) => {
        console.log(`[${MODULE_ID}] User connected: ${user.name} (${user.id})`);
        updateUsersCache();
    });
    
    Hooks.on('userDisconnected', (user) => {
        console.log(`[${MODULE_ID}] User disconnected: ${user.name} (${user.id})`);
        updateUsersCache();
    });
}

/**
 * Update the users cache
 */
function updateUsersCache() {
    const users = game.users.map(user => ({
        id: user.id,
        name: user.name,
        isGM: user.isGM,
        avatar: user.avatar,
        color: user.color,
    }));
    
    globalThis.currentWorldUsers = users;
    console.log(`[${MODULE_ID}] Updated users cache: ${users.length} users`);
}

// =============================================================================
// SETTINGS
// =============================================================================

/**
 * Add settings button to Foundry
 */
function addSettingsButton() {
    // Add settings button to the Game Settings sidebar
    Hooks.on('renderSettings', (app, html) => {
        const button = $(`
            <button class="matrix-bridge-settings" data-action="matrix-bridge">
                <i class="fas fa-comments"></i> ${MODULE_TITLE} Settings
            </button>
        `);
        
        button.on('click', () => {
            showSettingsDialog();
        });
        
        html.find('.settings-nav').append(button);
    });
}

/**
 * Show settings dialog
 */
function showSettingsDialog() {
    const dialog = new Dialog({
        title: `${MODULE_TITLE} Settings`,
        content: getSettingsHtml(),
        buttons: {
            save: {
                icon: '<i class="fas fa-save"></i>',
                label: 'Save',
                callback: saveSettings,
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel',
            },
        },
        default: 'save',
    });
    
    dialog.render(true);
}

/**
 * Get settings HTML
 */
function getSettingsHtml() {
    return `
        <form id="matrix-bridge-settings-form">
            <div class="form-group">
                <label for="matrix-bridge-api-enabled">Enable API Server</label>
                <input type="checkbox" id="matrix-bridge-api-enabled" name="apiEnabled" ${config.apiEnabled ? 'checked' : ''}>
                <p class="hint">Enable the REST API server for Matrix bridge communication</p>
            </div>
            
            <div class="form-group">
                <label for="matrix-bridge-api-port">API Port</label>
                <input type="number" id="matrix-bridge-api-port" name="apiPort" value="${config.apiPort || 30001}" min="1024" max="65535">
                <p class="hint">Port for the API server to listen on</p>
            </div>
            
            <div class="form-group">
                <label for="matrix-bridge-api-token">API Token</label>
                <input type="text" id="matrix-bridge-api-token" name="apiToken" value="${config.apiToken || ''}" placeholder="Generate a secure token">
                <button type="button" class="generate-token-btn" style="margin-top: 5px;">
                    <i class="fas fa-sync"></i> Generate Token
                </button>
                <p class="hint">Secure token for API authentication</p>
            </div>
            
            <div class="form-group">
                <label for="matrix-bridge-cors-origins">CORS Origins</label>
                <input type="text" id="matrix-bridge-cors-origins" name="corsOrigins" value="${config.corsOrigins || '*'}" placeholder="comma-separated origins">
                <p class="hint">Allowed CORS origins for API requests (comma-separated)</p>
            </div>
            
            <div class="form-group">
                <label for="matrix-bridge-log-level">Log Level</label>
                <select id="matrix-bridge-log-level" name="logLevel">
                    <option value="debug" ${config.logLevel === 'debug' ? 'selected' : ''}>Debug</option>
                    <option value="info" ${config.logLevel === 'info' ? 'selected' : ''}>Info</option>
                    <option value="warn" ${config.logLevel === 'warn' ? 'selected' : ''}>Warn</option>
                    <option value="error" ${config.logLevel === 'error' ? 'selected' : ''}>Error</option>
                </select>
                <p class="hint">Logging verbosity level</p>
            </div>
            
            <div class="form-group">
                <label for="matrix-bridge-max-connections">Max Connections</label>
                <input type="number" id="matrix-bridge-max-connections" name="maxConnections" value="${config.maxConnections || 10}" min="1" max="100">
                <p class="hint">Maximum number of concurrent connections</p>
            </div>
        </form>
    `;
}

/**
 * Save settings
 */
function saveSettings(html) {
    const form = html.find('#matrix-bridge-settings-form')[0];
    const formData = new FormData(form);
    
    const newConfig = {
        apiEnabled: formData.get('apiEnabled') === 'on',
        apiPort: parseInt(formData.get('apiPort') || '30001'),
        apiToken: formData.get('apiToken') || generateToken(),
        corsOrigins: formData.get('corsOrigins') || '*',
        logLevel: formData.get('logLevel') || 'info',
        maxConnections: parseInt(formData.get('maxConnections') || '10'),
    };
    
    // Save configuration
    saveConfig(newConfig);
    config = newConfig;
    
    // Restart API server if needed
    if (apiServer) {
        stopApiServer();
        apiServer = null;
    }
    
    if (newConfig.apiEnabled) {
        apiServer = startApiServer(newConfig);
    }
    
    ui.notifications.info(`[${MODULE_ID}] Settings saved successfully`);
}

/**
 * Generate a secure random token
 */
function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return token;
}

// =============================================================================
// GLOBAL EXPORTS
// =============================================================================

// Export for other modules to use
globalThis.MatrixBridge = {
    MODULE_ID,
    MODULE_TITLE,
    MODULE_VERSION,
    getConfig: () => config,
    rollDice: (expression, userId, whisperTo, blind) => {
        // Import and call the dice roller
        import('./foundry/dice.js').then(module => {
            return module.rollDice(expression, userId, game.world.id, whisperTo, blind);
        });
    },
    performSkillCheck: (userId, characterId, skill, dc, advantage, disadvantage) => {
        import('./foundry/checks.js').then(module => {
            return module.performSkillCheck(userId, characterId, skill, dc, advantage, disadvantage);
        });
    },
    performAbilityCheck: (userId, characterId, ability, dc, advantage, disadvantage) => {
        import('./foundry/checks.js').then(module => {
            return module.performAbilityCheck(userId, characterId, ability, dc, advantage, disadvantage);
        });
    },
    performSavingThrow: (userId, characterId, ability, dc, advantage, disadvantage) => {
        import('./foundry/checks.js').then(module => {
            return module.performSavingThrow(userId, characterId, ability, dc, advantage, disadvantage);
        });
    },
};

// Log initialization
console.log(`[${MODULE_ID}] ${MODULE_TITLE} v${MODULE_VERSION} loaded`);
