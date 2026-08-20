/**
 * License Routes
 * 
 * Provides endpoints for license validation and room management.
 * This ensures the bridge is only used in one Matrix room at a time,
 * maintaining license integrity.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';
import { validateLicense, setLicensedRoomId, clearLicensedRoomId, createRoomValidationResponse } from '../../config.js';

const router = Router();

// Store license configuration in memory
let licenseConfig = {
    licensed_room_id: null,
    enforce_license: true,
};

/**
 * GET /license/status - Get current license status
 * 
 * Returns information about the current license configuration.
 */
router.get('/status', (req, res) => {
    try {
        const status = {
            enforce_license: licenseConfig.enforce_license,
            licensed_room_id: licenseConfig.licensed_room_id || null,
            has_license: !!licenseConfig.licensed_room_id,
        };
        
        res.json({
            success: true,
            data: status,
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /license/status:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get license status',
            code: 500,
        });
    }
});

/**
 * POST /license/set - Set the licensed room ID
 * 
 * Configures which Matrix room is licensed to use the bridge.
 * Only requests from this room will be accepted when enforcement is enabled.
 * 
 * Request body:
 * {
 *   "room_id": "!roomId:matrix.org",
 *   "enforce": true (optional, default: true)
 * }
 */
router.post('/set', (req, res) => {
    try {
        const { room_id, enforce = true } = req.body;
        
        if (!room_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: room_id',
                code: 400,
            });
        }
        
        // Validate room ID format (Matrix room IDs start with !)
        if (typeof room_id !== 'string' || !room_id.startsWith('!')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid room_id: must be a valid Matrix room ID (starts with !)',
                code: 400,
            });
        }
        
        // Set the licensed room
        licenseConfig = {
            licensed_room_id: room_id,
            enforce_license: enforce,
        };
        
        console.log(`[${MODULE_ID}] Licensed room set to: ${room_id} (enforce: ${enforce})`);
        
        res.json({
            success: true,
            data: {
                licensed_room_id: room_id,
                enforce_license: enforce,
                message: `Licensed room set to ${room_id}`,
            },
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /license/set:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to set licensed room: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /license/clear - Clear the licensed room ID
 * 
 * Removes the license restriction, allowing the bridge to be used in any room.
 * 
 * Request body:
 * {
 *   "confirm": true (required for safety)
 * }
 */
router.post('/clear', (req, res) => {
    try {
        const { confirm } = req.body;
        
        if (confirm !== true) {
            return res.status(400).json({
                success: false,
                error: 'Missing or invalid confirmation. Set confirm: true to clear license.',
                code: 400,
            });
        }
        
        // Clear the licensed room
        licenseConfig = {
            licensed_room_id: null,
            enforce_license: true,
        };
        
        console.log(`[${MODULE_ID}] Licensed room cleared - all rooms allowed`);
        
        res.json({
            success: true,
            data: {
                licensed_room_id: null,
                enforce_license: true,
                message: 'Licensed room cleared - all rooms allowed',
            },
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /license/clear:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to clear licensed room: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /license/enforce - Enable or disable license enforcement
 * 
 * Request body:
 * {
 *   "enforce": true
 * }
 */
router.post('/enforce', (req, res) => {
    try {
        const { enforce } = req.body;
        
        if (enforce === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: enforce',
                code: 400,
            });
        }
        
        licenseConfig.enforce_license = enforce;
        
        console.log(`[${MODULE_ID}] License enforcement ${enforce ? 'enabled' : 'disabled'}`);
        
        res.json({
            success: true,
            data: {
                enforce_license: enforce,
                licensed_room_id: licenseConfig.licensed_room_id || null,
                message: `License enforcement ${enforce ? 'enabled' : 'disabled'}`,
            },
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /license/enforce:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to update license enforcement: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /license/validate - Validate a room ID against the license
 * 
 * This is the main endpoint for checking if a room is allowed to use the bridge.
 * All API requests should include the room ID for validation.
 * 
 * Request body:
 * {
 *   "room_id": "!roomId:matrix.org"
 * }
 * 
 * Response:
 * {
 *   "success": true/false,
 *   "is_licensed": true/false,
 *   "room_id": "!roomId:matrix.org",
 *   "licensed_room_id": "!licensedRoom:matrix.org",
 *   "error": "..." (if not licensed)
 * }
 */
router.post('/validate', (req, res) => {
    try {
        const { room_id } = req.body;
        
        if (!room_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: room_id',
                code: 400,
            });
        }
        
        // Create a temporary config for validation
        const config = {
            enforce_license: licenseConfig.enforce_license,
            licensed_room_id: licenseConfig.licensed_room_id,
        };
        
        // Validate the room
        const validation = validateLicense(config, room_id);
        
        // Create response
        const response = createRoomValidationResponse(validation);
        
        // Log the validation
        if (validation.valid) {
            console.log(`[${MODULE_ID}] Room validation passed: ${room_id}`);
        } else {
            console.warn(`[${MODULE_ID}] Room validation failed: ${room_id} - ${validation.error}`);
        }
        
        res.status(validation.valid ? 200 : 403).json(response);
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /license/validate:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to validate room: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /license/validate/:roomId - Validate a room ID via GET
 * 
 * Same as POST /license/validate but using GET for convenience.
 */
router.get('/validate/:roomId', (req, res) => {
    try {
        const { roomId } = req.params;
        
        // Validate room ID format
        if (!roomId.startsWith('!')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid room_id: must be a valid Matrix room ID (starts with !)',
                code: 400,
            });
        }
        
        // Create a temporary config for validation
        const config = {
            enforce_license: licenseConfig.enforce_license,
            licensed_room_id: licenseConfig.licensed_room_id,
        };
        
        // Validate the room
        const validation = validateLicense(config, roomId);
        
        // Create response
        const response = createRoomValidationResponse(validation);
        
        res.status(validation.valid ? 200 : 403).json(response);
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /license/validate/:roomId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to validate room: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * Middleware to validate room ID from request headers
 * 
 * This can be used to protect other routes.
 * 
 * @returns Express middleware function
 */
export function licenseMiddleware(req, res, next) {
    // Skip validation if enforcement is disabled
    if (!licenseConfig.enforce_license || !licenseConfig.licensed_room_id) {
        return next();
    }
    
    // Get room ID from headers or query
    const roomId = req.headers['x-matrix-room-id'] || req.query.room_id;
    
    if (!roomId) {
        return res.status(403).json({
            success: false,
            error: 'Room ID required for license validation. Provide via X-Matrix-Room-Id header or room_id query parameter.',
            code: 403,
        });
    }
    
    // Validate the room
    const config = {
        enforce_license: licenseConfig.enforce_license,
        licensed_room_id: licenseConfig.licensed_room_id,
    };
    
    const validation = validateLicense(config, roomId);
    
    if (!validation.valid) {
        return res.status(403).json({
            success: false,
            error: validation.error,
            code: 403,
        });
    }
    
    // Room is valid, proceed
    req.licensed_room_id = roomId;
    next();
}

/**
 * Get the current license configuration
 */
export function getLicenseConfig() {
    return { ...licenseConfig };
}

/**
 * Set the license configuration
 */
export function setLicenseConfig(config) {
    licenseConfig = { ...config };
}

export { router as licenseRouter };
