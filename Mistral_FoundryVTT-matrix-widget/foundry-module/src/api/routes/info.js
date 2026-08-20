/**
 * Module Info Route
 * 
 * Provides information about the module.
 */

import { Router } from 'express';
import { MODULE_ID, MODULE_TITLE, MODULE_VERSION } from '../../constants.js';
import { getConfig } from '../../config.js';

const router = Router();

/**
 * GET /info - Get module information
 */
router.get('/', (req, res) => {
    try {
        const config = getConfig();
        
        const moduleInfo = {
            id: MODULE_ID,
            title: MODULE_TITLE,
            description: 'FoundryVTT module for Matrix integration',
            version: MODULE_VERSION,
            author: 'stonehold76',
            compatibleCoreVersion: '11.0.0',
            minimumCoreVersion: '10.0.0',
            features: {
                apiEnabled: config.apiEnabled,
                diceRoller: true,
                skillChecks: true,
                abilityChecks: true,
                savingThrows: true,
                characterData: true,
                itemSearch: true,
                chatMessages: true,
                events: true,
            },
            config: {
                apiPort: config.apiPort,
                allowCORS: config.allowCORS,
                corsOrigins: config.corsOrigins,
                maxConnections: config.maxConnections,
            },
        };
        
        res.json({
            success: true,
            data: moduleInfo,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in /info:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get module info',
            code: 500,
        });
    }
});

export { router as infoRouter };
