/**
 * Shared Constants
 * 
 * Defines constants used throughout the module.
 * This is SYSTEM-AGNOSTIC - works with any FoundryVTT game system.
 */

export const MODULE_ID = 'matrix-bridge';
export const MODULE_TITLE = 'Matrix Bridge';
export const MODULE_VERSION = '1.0.0';

// API constants
export const API_BASE_PATH = '/api/matrix-bridge';
export const DEFAULT_API_PORT = 30001;

// Log levels
export const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
};

// Dice types (standard polyhedral dice)
export const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

// Common dice expressions for quick reference
export const COMMON_DICE = {
    D4: '1d4',
    D6: '1d6',
    D8: '1d8',
    D10: '1d10',
    D12: '1d12',
    D20: '1d20',
    D100: '1d100',
    D20_PLUS_5: '1d20 + 5',
    D20_PLUS_10: '1d20 + 10',
    TWO_D6: '2d6',
    THREE_D6: '3d6',
    FOUR_D6: '4d6',
};

// Error codes
export const ERROR_CODES = {
    SUCCESS: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
    RATE_LIMITED: 429,
};

// HTTP methods
export const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    OPTIONS: 'OPTIONS',
};

// Event types - these are generic and work with any system
export const EVENT_TYPES = {
    CHAT_MESSAGE: 'chatMessage',
    DICE_ROLL: 'diceRoll',
    ATTRIBUTE_CHECK: 'attributeCheck',
    SAVING_THROW: 'savingThrow',
    SIMPLE_CHECK: 'simpleCheck',
    USER_JOINED: 'userJoined',
    USER_LEFT: 'userLeft',
    WORLD_READY: 'worldReady',
};

// Result types
export const RESULT_TYPES = {
    SUCCESS: 'success',
    FAILURE: 'failure',
    CRITICAL_SUCCESS: 'criticalSuccess',
    CRITICAL_FAILURE: 'criticalFailure',
};

// Check types
export const CHECK_TYPES = {
    ATTRIBUTE: 'attribute',
    SKILL: 'skill',
    SAVE: 'save',
    SIMPLE: 'simple',
    CUSTOM: 'custom',
};
