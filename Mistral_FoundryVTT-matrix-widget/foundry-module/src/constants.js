/**
 * Shared Constants
 * 
 * Defines constants used throughout the module.
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

// Dice types
export const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

// Ability names
export const ABILITIES = {
    STR: 'strength',
    DEX: 'dexterity',
    CON: 'constitution',
    INT: 'intelligence',
    WIS: 'wisdom',
    CHA: 'charisma',
};

// Ability abbreviations
export const ABILITY_ABBREVIATIONS = {
    str: 'strength',
    dex: 'dexterity',
    con: 'constitution',
    int: 'intelligence',
    wis: 'wisdom',
    cha: 'charisma',
};

// Common skill names (D&D 5e)
export const COMMON_SKILLS = [
    'acrobatics',
    'animal handling',
    'arcana',
    'athletics',
    'deception',
    'history',
    'insight',
    'intimidation',
    'investigation',
    'medicine',
    'nature',
    'perception',
    'performance',
    'persuasion',
    'religion',
    'sleight of hand',
    'stealth',
    'survival',
];

// Item types
export const ITEM_TYPES = [
    'weapon',
    'equipment',
    'consumable',
    'tool',
    'loot',
    'item',
    'spell',
    'feat',
    'class',
    'race',
    'background',
];

// Event types
export const EVENT_TYPES = {
    CHAT_MESSAGE: 'chatMessage',
    DICE_ROLL: 'diceRoll',
    SKILL_CHECK: 'skillCheck',
    ABILITY_CHECK: 'abilityCheck',
    SAVING_THROW: 'savingThrow',
    USER_JOINED: 'userJoined',
    USER_LEFT: 'userLeft',
    WORLD_READY: 'worldReady',
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
