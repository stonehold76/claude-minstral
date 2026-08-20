/**
 * Authentication Middleware
 * 
 * Validates API tokens for incoming requests.
 */

import { MODULE_ID } from '../../constants.js';

/**
 * Creates authentication middleware
 * 
 * @param {string} expectedToken - The expected API token
 * @returns {Function} Express middleware function
 */
export function authMiddleware(expectedToken) {
    return (req, res, next) => {
        // Skip authentication for health check
        if (req.path === '/health' || req.path === '/') {
            return next();
        }
        
        // Get token from header
        const authHeader = req.headers.authorization || req.headers.Authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Authorization header missing',
                code: 401,
            });
        }
        
        // Extract token from header
        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Invalid authorization header format. Use: Bearer <token>',
                code: 401,
            });
        }
        
        // Validate token
        if (token !== expectedToken) {
            console.warn(`[${MODULE_ID}] Invalid API token: ${token.substring(0, 8)}...`);
            return res.status(403).json({
                success: false,
                error: 'Invalid API token',
                code: 403,
            });
        }
        
        // Token is valid, proceed
        next();
    };
}

/**
 * Creates rate limiting middleware
 * 
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
export function rateLimitMiddleware(options = {}) {
    const {
        windowMs = 60000, // 1 minute
        max = 100, // Max requests per window
    } = options;
    
    const requests = new Map();
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        // Get or create request log for this IP
        let requestLog = requests.get(ip);
        if (!requestLog) {
            requestLog = [];
            requests.set(ip, requestLog);
        }
        
        // Remove old requests
        requestLog = requestLog.filter(timestamp => now - timestamp < windowMs);
        
        // Check if limit exceeded
        if (requestLog.length >= max) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests',
                code: 429,
            });
        }
        
        // Add current request
        requestLog.push(now);
        requests.set(ip, requestLog);
        
        // Proceed
        next();
    };
}

/**
 * Creates CORS middleware with dynamic origins
 * 
 * @param {string|string[]} origins - Allowed origins
 * @returns {Function} Express middleware function
 */
export function corsMiddleware(origins) {
    const allowedOrigins = Array.isArray(origins) ? origins : [origins];
    
    return (req, res, next) => {
        const origin = req.headers.origin;
        
        // Allow all if wildcard
        if (allowedOrigins.includes('*')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return next();
        }
        
        // Check if origin is allowed
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        next();
    };
}

/**
 * Creates logging middleware
 * 
 * @param {string} level - Log level
 * @returns {Function} Express middleware function
 */
export function loggingMiddleware(level = 'info') {
    return (req, res, next) => {
        const start = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - start;
            
            if (level === 'debug') {
                console.log(`[${MODULE_ID}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
            } else if (level === 'info' && res.statusCode >= 400) {
                console.log(`[${MODULE_ID}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
            }
        });
        
        next();
    };
}
