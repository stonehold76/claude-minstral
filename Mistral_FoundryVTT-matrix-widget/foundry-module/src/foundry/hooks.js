/**
 * Foundry Hooks
 * 
 * Registers all Foundry hooks for the module.
 */

import { MODULE_ID } from '../constants.js';
import { rollDice, handleDiceRoll } from './dice.js';
import { performSkillCheck, performAbilityCheck, performSavingThrow, handleCheck } from './checks.js';
import { handleChatMessage } from './chat.js';

/**
 * Register all Foundry hooks
 * 
 * @param {Object} config - Module configuration
 */
export function registerHooks(config) {
    console.log(`[${MODULE_ID}] Registering Foundry hooks...`);
    
    // =========================================================================
    // INITIALIZATION HOOKS
    // =========================================================================
    
    /**
     * Fires when the FoundryVTT application is first initialized
     */
    Hooks.once('init', () => {
        console.log(`[${MODULE_ID}] Foundry initialized`);
    });
    
    /**
     * Fires when the game world has finished initializing
     */
    Hooks.once('ready', () => {
        console.log(`[${MODULE_ID}] World ready: ${game.world.title}`);
        initializeWorld();
    });
    
    // =========================================================================
    // CHAT HOOKS
    // =========================================================================
    
    /**
     * Fires when a chat message is created
     */
    Hooks.on('createChatMessage', (message, options, userId) => {
        handleChatMessage(message, options, userId);
    });
    
    /**
     * Fires when a chat message is rendered
     */
    Hooks.on('renderChatMessage', (message, html, data) => {
        // Can be used to modify how messages are displayed
    });
    
    // =========================================================================
    // DICE HOOKS
    // =========================================================================
    
    /**
     * Fires when a dice roll is completed
     */
    Hooks.on('diceSoNiceRollComplete', (message, roll) => {
        handleDiceRoll(message, roll);
    });
    
    /**
     * Fires when a roll is evaluated
     */
    Hooks.on('evaluateDiceRoll', (roll, context) => {
        // Can be used to modify dice rolls
    });
    
    // =========================================================================
    // USER HOOKS
    // =========================================================================
    
    /**
     * Fires when a user connects to the game
     */
    Hooks.on('userConnected', (user) => {
        console.log(`[${MODULE_ID}] User connected: ${user.name} (${user.id})`);
        handleUserConnected(user);
    });
    
    /**
     * Fires when a user disconnects from the game
     */
    Hooks.on('userDisconnected', (user) => {
        console.log(`[${MODULE_ID}] User disconnected: ${user.name} (${user.id})`);
        handleUserDisconnected(user);
    });
    
    // =========================================================================
    // ACTOR (CHARACTER) HOOKS
    // =========================================================================
    
    /**
     * Fires when an actor is created
     */
    Hooks.on('createActor', (actor, options, userId) => {
        console.log(`[${MODULE_ID}] Actor created: ${actor.name} (${actor.id})`);
    });
    
    /**
     * Fires when an actor is updated
     */
    Hooks.on('updateActor', (actor, changes, options, userId) => {
        // Can be used to track character changes
    });
    
    /**
     * Fires when an actor is deleted
     */
    Hooks.on('deleteActor', (actor, options, userId) => {
        console.log(`[${MODULE_ID}] Actor deleted: ${actor.name} (${actor.id})`);
    });
    
    // =========================================================================
    // ITEM HOOKS
    // =========================================================================
    
    /**
     * Fires when an item is created
     */
    Hooks.on('createItem', (item, options, userId) => {
        console.log(`[${MODULE_ID}] Item created: ${item.name} (${item.id})`);
    });
    
    /**
     * Fires when an item is updated
     */
    Hooks.on('updateItem', (item, changes, options, userId) => {
        // Can be used to track item changes
    });
    
    /**
     * Fires when an item is deleted
     */
    Hooks.on('deleteItem', (item, options, userId) => {
        console.log(`[${MODULE_ID}] Item deleted: ${item.name} (${item.id})`);
    });
    
    // =========================================================================
    // COMBAT HOOKS
    // =========================================================================
    
    /**
     * Fires when combat starts
     */
    Hooks.on('combatStart', (combat) => {
        console.log(`[${MODULE_ID}] Combat started: ${combat.id}`);
    });
    
    /**
     * Fires when a new turn begins in combat
     */
    Hooks.on('combatTurnStart', (combat, turn) => {
        console.log(`[${MODULE_ID}] Turn started: ${turn.tokenId}`);
    });
    
    /**
     * Fires when combat ends
     */
    Hooks.on('combatEnd', (combat) => {
        console.log(`[${MODULE_ID}] Combat ended: ${combat.id}`);
    });
    
    // =========================================================================
    // SOCKET HOOKS
    // =========================================================================
    
    /**
     * Fires when a module socket message is received
     */
    Hooks.on('socketlib.socket', (module, message) => {
        if (module === MODULE_ID) {
            handleSocketMessage(message);
        }
    });
    
    // =========================================================================
    // RENDER HOOKS
    // =========================================================================
    
    /**
     * Fires when the chat log is rendered
     */
    Hooks.on('renderChatLog', (app, html, data) => {
        // Can be used to modify chat log display
    });
    
    /**
     * Fires when the scene navigation is rendered
     */
    Hooks.on('renderSceneNavigation', (app, html, data) => {
        // Can be used to add custom scene controls
    });
    
    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================
    
    /**
     * Initialize world-specific features
     */
    function initializeWorld() {
        // Store world info for API access
        globalThis.currentWorld = {
            id: game.world.id,
            title: game.world.title,
            system: game.world.system,
            active: true,
        };
        
        // Update users cache
        updateUsersCache();
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
            active: user.active,
        }));
        
        globalThis.currentWorldUsers = users;
        console.log(`[${MODULE_ID}] Updated users cache: ${users.length} users`);
    }
    
    /**
     * Handle user connected
     */
    function handleUserConnected(user) {
        updateUsersCache();
        
        // Emit event
        if (game.socket) {
            game.socket.emit(`module.${MODULE_ID}`, {
                type: 'userJoined',
                data: {
                    userId: user.id,
                    worldId: game.world.id,
                    userName: user.name,
                    isGM: user.isGM,
                },
            });
        }
    }
    
    /**
     * Handle user disconnected
     */
    function handleUserDisconnected(user) {
        updateUsersCache();
        
        // Emit event
        if (game.socket) {
            game.socket.emit(`module.${MODULE_ID}`, {
                type: 'userLeft',
                data: {
                    userId: user.id,
                    worldId: game.world.id,
                    userName: user.name,
                },
            });
        }
    }
    
    /**
     * Handle socket messages
     */
    function handleSocketMessage(message) {
        switch (message.type) {
            case 'rollDice':
                // Handle dice roll request from socket
                break;
            case 'checkSkill':
                // Handle skill check request from socket
                break;
            case 'checkAbility':
                // Handle ability check request from socket
                break;
            case 'saveThrow':
                // Handle saving throw request from socket
                break;
            default:
                console.log(`[${MODULE_ID}] Unknown socket message type: ${message.type}`);
        }
    }
}

/**
 * Unregister all hooks (for cleanup)
 */
export function unregisterHooks() {
    console.log(`[${MODULE_ID}] Unregistering hooks...`);
    
    // Remove all hooks
    Hooks.offAll(MODULE_ID);
}
