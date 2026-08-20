/**
 * Checks Routes
 * 
 * Provides endpoints for skill checks, ability checks, and saving throws.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';
import { performSkillCheck, performAbilityCheck, performSavingThrow } from '../../foundry/checks.js';

const router = Router();

/**
 * POST /checks/skill - Perform a skill check
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "characterId": "character-id" (optional),
 *   "skill": "stealth",
 *   "dc": 15 (optional),
 *   "advantage": false (optional),
 *   "disadvantage": false (optional)
 * }
 */
router.post('/skill', (req, res) => {
    try {
        const { worldId, userId, characterId, skill, dc, advantage = false, disadvantage = false } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !skill) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, skill',
                code: 400,
            });
        }
        
        // Validate skill
        if (typeof skill !== 'string' || skill.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Invalid skill: must be a non-empty string',
                code: 400,
            });
        }
        
        // Perform the skill check
        const result = performSkillCheck(userId, characterId, skill, dc, advantage, disadvantage);
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /checks/skill:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to perform skill check: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /checks/ability - Perform an ability check
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "characterId": "character-id" (optional),
 *   "ability": "dex",
 *   "dc": 15 (optional),
 *   "advantage": false (optional),
 *   "disadvantage": false (optional)
 * }
 */
router.post('/ability', (req, res) => {
    try {
        const { worldId, userId, characterId, ability, dc, advantage = false, disadvantage = false } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !ability) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, ability',
                code: 400,
            });
        }
        
        // Validate ability
        const validAbilities = ['str', 'dex', 'con', 'int', 'wis', 'cha',
                                'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        
        if (typeof ability !== 'string' || !validAbilities.includes(ability.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: `Invalid ability: must be one of ${validAbilities.join(', ')}`,
                code: 400,
            });
        }
        
        // Perform the ability check
        const result = performAbilityCheck(userId, characterId, ability, dc, advantage, disadvantage);
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /checks/ability:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to perform ability check: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * POST /checks/save - Perform a saving throw
 * 
 * Request body:
 * {
 *   "worldId": "world-id",
 *   "userId": "user-id",
 *   "characterId": "character-id" (optional),
 *   "ability": "dex",
 *   "dc": 15,
 *   "advantage": false (optional),
 *   "disadvantage": false (optional)
 * }
 */
router.post('/save', (req, res) => {
    try {
        const { worldId, userId, characterId, ability, dc, advantage = false, disadvantage = false } = req.body;
        
        // Validate required fields
        if (!worldId || !userId || !ability || dc === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: worldId, userId, ability, dc',
                code: 400,
            });
        }
        
        // Validate ability
        const validAbilities = ['str', 'dex', 'con', 'int', 'wis', 'cha',
                                'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        
        if (typeof ability !== 'string' || !validAbilities.includes(ability.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: `Invalid ability: must be one of ${validAbilities.join(', ')}`,
                code: 400,
            });
        }
        
        // Validate DC
        if (typeof dc !== 'number' || dc < 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid DC: must be a non-negative number',
                code: 400,
            });
        }
        
        // Perform the saving throw
        const result = performSavingThrow(userId, characterId, ability, dc, advantage, disadvantage);
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in POST /checks/save:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to perform saving throw: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /checks/skills - Get list of available skills
 */
router.get('/skills', (req, res) => {
    try {
        // Get skills from the current world's system
        const world = game.world;
        let skills = [];
        
        // Try to get skills from the system
        if (world && world.system) {
            // Different systems have different ways of storing skills
            // For D&D 5e, skills are in the actor system
            try {
                const sampleActor = game.actors.find(a => a.type === 'character');
                if (sampleActor && sampleActor.system?.skills) {
                    skills = Object.keys(sampleActor.system.skills);
                }
            } catch (e) {
                // Fall back to common skills
                skills = [
                    'acrobatics', 'animal handling', 'arcana', 'athletics', 'deception',
                    'history', 'insight', 'intimidation', 'investigation', 'medicine',
                    'nature', 'perception', 'performance', 'persuasion', 'religion',
                    'sleight of hand', 'stealth', 'survival',
                ];
            }
        }
        
        // If no skills found, use defaults
        if (skills.length === 0) {
            skills = [
                'acrobatics', 'animal handling', 'arcana', 'athletics', 'deception',
                'history', 'insight', 'intimidation', 'investigation', 'medicine',
                'nature', 'perception', 'performance', 'persuasion', 'religion',
                'sleight of hand', 'stealth', 'survival',
            ];
        }
        
        res.json({
            success: true,
            data: skills,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /checks/skills:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get skills',
            code: 500,
        });
    }
});

/**
 * GET /checks/abilities - Get list of available abilities
 */
router.get('/abilities', (req, res) => {
    try {
        const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        
        res.json({
            success: true,
            data: abilities,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /checks/abilities:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get abilities',
            code: 500,
        });
    }
});

export { router as checksRouter };
