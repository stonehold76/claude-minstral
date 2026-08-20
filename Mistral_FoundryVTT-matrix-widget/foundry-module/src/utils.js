/**
 * Utilities
 * 
 * Shared utility functions used throughout the module.
 */

import { MODULE_ID } from './constants.js';

/**
 * Logger class for consistent logging
 */
export class Logger {
    constructor(namespace) {
        this.namespace = namespace || MODULE_ID;
    }
    
    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const prefix = `[${this.namespace}] ${timestamp}`;
        
        switch (level) {
            case 'debug':
                console.debug(`${prefix} [DEBUG] ${message}`, data);
                break;
            case 'info':
                console.log(`${prefix} [INFO] ${message}`, data);
                break;
            case 'warn':
                console.warn(`${prefix} [WARN] ${message}`, data);
                break;
            case 'error':
                console.error(`${prefix} [ERROR] ${message}`, data);
                break;
            default:
                console.log(`${prefix} [${level.toUpperCase()}] ${message}`, data);
        }
    }
    
    debug(message, data = {}) {
        this.log('debug', message, data);
    }
    
    info(message, data = {}) {
        this.log('info', message, data);
    }
    
    warn(message, data = {}) {
        this.log('warn', message, data);
    }
    
    error(message, data = {}) {
        this.log('error', message, data);
    }
}

// Create a default logger
export const logger = new Logger(MODULE_ID);

/**
 * Generate a unique ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a secure random token
 * 
 * @param {number} length - Token length
 * @returns {string} Random token
 */
export function generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return token;
}

/**
 * Validate an object has required fields
 * 
 * @param {Object} obj - Object to validate
 * @param {string[]} requiredFields - Required field names
 * @throws {Error} If validation fails
 */
export function validateRequired(obj, requiredFields) {
    const missing = requiredFields.filter(field => !(field in obj));
    
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
}

/**
 * Sanitize a string for use in HTML
 * 
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeHtml(str) {
    if (!str) return '';
    
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Escape regex special characters
 * 
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a value is a valid dice expression
 * 
 * @param {string} expression - Dice expression to validate
 * @returns {boolean} Whether the expression is valid
 */
export function isValidDiceExpression(expression) {
    if (!expression || typeof expression !== 'string') {
        return false;
    }
    
    // Simple validation - check for common dice patterns
    const dicePattern = /^[\d\s+\-*/()d]+$/i;
    return dicePattern.test(expression.trim());
}

/**
 * Parse a dice expression into its components
 * 
 * @param {string} expression - Dice expression
 * @returns {Object} Parsed components
 */
export function parseDiceExpression(expression) {
    const result = {
        dice: [],
        modifiers: [],
        constants: [],
    };
    
    // Simple parsing - this is a basic implementation
    // Foundry's Roll class does the actual parsing
    const parts = expression.split(/[+\-*/()]/);
    
    for (const part of parts) {
        const trimmed = part.trim();
        
        if (!trimmed) continue;
        
        // Check for dice (e.g., 1d20, d20)
        const diceMatch = trimmed.match(/^(\d*)d(\d+)$/i);
        if (diceMatch) {
            result.dice.push({
                count: diceMatch[1] || 1,
                sides: parseInt(diceMatch[2]),
            });
            continue;
        }
        
        // Check for constants
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
            result.constants.push(num);
        }
    }
    
    return result;
}

/**
 * Get the current timestamp
 * 
 * @returns {number} Current timestamp
 */
export function getTimestamp() {
    return Date.now();
}

/**
 * Format a timestamp as ISO string
 * 
 * @param {number} timestamp - Timestamp to format
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(timestamp = Date.now()) {
    return new Date(timestamp).toISOString();
}

/**
 * Deep clone an object
 * 
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }
    
    const cloned = {};
    for (const key of Object.keys(obj)) {
        cloned[key] = deepClone(obj[key]);
    }
    
    return cloned;
}

/**
 * Merge objects deeply
 * 
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
export function deepMerge(...objects) {
    const result = {};
    
    for (const obj of objects) {
        if (!obj || typeof obj !== 'object') continue;
        
        for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object') {
                if (Array.isArray(obj[key])) {
                    result[key] = [...(result[key] || []), ...obj[key]];
                } else {
                    result[key] = deepMerge(result[key] || {}, obj[key]);
                }
            } else {
                result[key] = obj[key];
            }
        }
    }
    
    return result;
}

/**
 * Check if two objects are deeply equal
 * 
 * @param {*} obj1 - First object
 * @param {*} obj2 - Second object
 * @returns {boolean} Whether objects are equal
 */
export function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 === null || obj2 === null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
}

/**
 * Sleep for a specified duration
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the delay
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Promise that resolves when the function succeeds
 */
export async function retry(fn, options = {}) {
    const {
        maxAttempts = 3,
        initialDelay = 100,
        maxDelay = 5000,
        backoff = 2,
    } = options;
    
    let attempt = 0;
    let lastError;
    
    while (attempt < maxAttempts) {
        attempt++;
        
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt >= maxAttempts) break;
            
            const delay = Math.min(initialDelay * Math.pow(backoff, attempt - 1), maxDelay);
            await sleep(delay);
        }
    }
    
    throw lastError;
}
