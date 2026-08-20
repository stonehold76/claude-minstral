/**
 * Checks Integration
 * 
 * Handles generic checks (attributes, skills, abilities) with Foundry's
 * character system and dice roller. This is SYSTEM-AGNOSTIC and works
 * with any FoundryVTT game system (D&D 5e, Alien RPG, Call of Cthulhu, etc.)
 */

import { MODULE_ID } from '../constants.js';

/**
 * Get modifier from character data for a given path
 * Tries multiple common paths used by different game systems
 * 
 * @param {Object} character - Character object
 * @param {string} path - Path to the attribute (e.g., "skills.stealth", "attributes.dexterity")
 * @returns {number} Modifier value or 0 if not found
 */
function getModifierFromPath(character, path) {
    if (!character || !character.system) return 0;
    
    const parts = path.split('.');
    let value = character.system;
    
    for (const part of parts) {
        if (value && value[part] !== undefined) {
            value = value[part];
        } else {
            return 0;
        }
    }
    
    // Handle different formats: mod, value, modifier, total, etc.
    if (typeof value === 'object' && value !== null) {
        return value.mod || value.value || value.modifier || value.total || 0;
    }
    
    return typeof value === 'number' ? value : 0;
}

/**
 * Discover available attributes from a character
 * Returns all available paths that could be used for checks
 * Works with ANY game system
 * 
 * @param {Object} character - Character object
 * @returns {Object} Available attributes grouped by category
 */
export function discoverCharacterAttributes(character) {
    if (!character || !character.system) {
        return { attributes: [], skills: [], saves: [], custom: [] };
    }
    
    const result = {
        attributes: [],
        skills: [],
        saves: [],
        custom: []
    };
    
    // Helper to traverse object and find numeric values
    function traverse(obj, path = '', category = 'custom') {
        if (!obj || typeof obj !== 'object') return;
        
        for (const [key, value] of Object.entries(obj)) {
            const newPath = path ? `${path}.${key}` : key;
            
            if (typeof value === 'object' && value !== null) {
                // Check if this looks like an attribute object with numeric values
                if ('mod' in value || 'value' in value || 'modifier' in value || 'total' in value) {
                    result[category].push({
                        name: key,
                        path: newPath,
                        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                    });
                }
                traverse(value, newPath, category);
            }
        }
    }
    
    // Try to find attributes/abilities - works with any system
    if (character.system.attributes) {
        traverse(character.system.attributes, '', 'attributes');
    }
    if (character.system.abilities) {
        traverse(character.system.abilities, '', 'attributes');
    }
    if (character.system.characteristics) {
        traverse(character.system.characteristics, '', 'attributes');
    }
    
    // Try to find skills - works with any system
    if (character.system.skills) {
        traverse(character.system.skills, '', 'skills');
    }
    
    // Try to find saves - works with any system
    if (character.system.saves) {
        traverse(character.system.saves, '', 'saves');
    }
    if (character.system.savingThrows) {
        traverse(character.system.savingThrows, '', 'saves');
    }
    
    // Traverse the entire system for anything we missed
    traverse(character.system, '', 'custom');
    
    return result;
}

/**
 * Get all available checkable attributes for a character
 * Returns a flat list of all possible check targets
 * 
 * @param {string} characterId - Character ID
 * @returns {Object} Available check options
 */
export function getAvailableChecks(characterId) {
    const character = game.actors.get(characterId);
    
    if (!character) {
        return {
            success: false,
            error: `Character not found: ${characterId}`,
        };
    }
    
    const attributes = discoverCharacterAttributes(character);
    
    // Combine all into a single flat list
    const allChecks = [
        ...attributes.attributes.map(a => ({ ...a, category: 'attribute' })),
        ...attributes.skills.map(s => ({ ...s, category: 'skill' })),
        ...attributes.saves.map(s => ({ ...s, category: 'save' })),
        ...attributes.custom.map(c => ({ ...c, category: 'custom' })),
    ];
    
    return {
        success: true,
        data: {
            byCategory: attributes,
            flatList: allChecks,
            system: character.system,
        },
    };
}

/**
 * Perform a generic attribute check
 * This is SYSTEM-AGNOSTIC and works with any FoundryVTT game system
 * 
 * @param {string} userId - User ID performing the check
 * @param {string} characterId - Character ID (optional)
 * @param {string} attributePath - Path to the attribute (e.g., "skills.stealth", "attributes.dexterity", "characteristics.agility")
 * @param {number} dc - Target number/Difficulty class (optional)
 * @param {boolean} advantage - Whether to roll with advantage
 * @param {boolean} disadvantage - Whether to roll with disadvantage
 * @param {string} checkType - Type of check for display (optional, defaults to last part of path)
 * @returns {Object} Check result
 */
export function performAttributeCheck(userId, characterId, attributePath, dc, advantage = false, disadvantage = false, checkType = null) {
    try {
        // Get the character
        const character = characterId ? game.actors.get(characterId) : null;
        
        if (characterId && !character) {
            throw new Error(`Character not found: ${characterId}`);
        }
        
        // Get the user
        const user = game.users.get(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        
        let modifier = 0;
        let rollExpression = '1d20';
        const attributeName = checkType || attributePath.split('.').pop();
        
        // If we have a character, get the modifier from the path
        if (character) {
            modifier = getModifierFromPath(character, attributePath);
            rollExpression = `1d20 + ${modifier}`;
        } else {
            // No character, just roll 1d20
            console.warn(`[${MODULE_ID}] No character found for check, rolling 1d20`);
        }
        
        // Apply advantage/disadvantage
        if (advantage) {
            rollExpression = `2d20kh1 + ${modifier}`;
        } else if (disadvantage) {
            rollExpression = `2d20kl1 + ${modifier}`;
        }
        
        // Roll the dice
        const roll = new Roll(rollExpression);
        const result = roll.roll();
        const total = result.total;
        
        // Determine success
        const success = dc !== undefined ? total >= dc : undefined;
        const criticalSuccess = result.rolls[0].includes(20);
        const criticalFailure = result.rolls[0].includes(1);
        
        // Create chat message
        const messageData = {
            speaker: {
                user: userId,
                actor: characterId || undefined,
            },
            content: `${attributeName} check: ${total}` + (dc !== undefined ? ` (Target ${dc})` : ''),
            roll: result,
        };
        
        ChatMessage.create(messageData);
        
        // Return the result
        const checkResult = {
            id: result.id,
            userId,
            characterId: characterId || null,
            attribute: attributePath,
            attributeName,
            roll: result.total,
            dc: dc !== undefined ? dc : null,
            success,
            criticalSuccess,
            criticalFailure,
            modifier,
            total,
            breakdown: `${rollExpression} = ${total}`,
            timestamp: Date.now(),
        };
        
        console.log(`[${MODULE_ID}] Check: ${user.name} rolled ${attributePath} = ${total}`);
        
        return checkResult;
    } catch (error) {
        console.error(`[${MODULE_ID}] Error performing check:`, error);
        throw error;
    }
}

/**
 * Perform a saving throw or resistance check (system-agnostic)
 * 
 * @param {string} userId - User ID performing the save
 * @param {string} characterId - Character ID (optional)
 * @param {string} attributePath - Path to the save attribute
 * @param {number} dc - Target number/Difficulty class
 * @param {boolean} advantage - Whether to roll with advantage
 * @param {boolean} disadvantage - Whether to roll with disadvantage
 * @returns {Object} Saving throw result
 */
export function performSavingThrow(userId, characterId, attributePath, dc, advantage = false, disadvantage = false) {
    try {
        // Get the character
        const character = characterId ? game.actors.get(characterId) : null;
        
        if (characterId && !character) {
            throw new Error(`Character not found: ${characterId}`);
        }
        
        if (!dc) {
            throw new Error('Target number (DC) is required for saving throws');
        }
        
        // Get the user
        const user = game.users.get(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        
        let modifier = 0;
        let rollExpression = '1d20';
        const attributeName = attributePath.split('.').pop();
        
        // If we have a character, get the modifier
        if (character) {
            modifier = getModifierFromPath(character, attributePath);
            rollExpression = `1d20 + ${modifier}`;
        } else {
            // No character, just roll 1d20
            console.warn(`[${MODULE_ID}] No character found for saving throw, rolling 1d20`);
        }
        
        // Apply advantage/disadvantage
        if (advantage) {
            rollExpression = `2d20kh1 + ${modifier}`;
        } else if (disadvantage) {
            rollExpression = `2d20kl1 + ${modifier}`;
        }
        
        // Roll the dice
        const roll = new Roll(rollExpression);
        const result = roll.roll();
        const total = result.total;
        
        // Determine success
        const success = total >= dc;
        const criticalSuccess = result.rolls[0].includes(20);
        const criticalFailure = result.rolls[0].includes(1);
        
        // Create chat message
        const messageData = {
            speaker: {
                user: userId,
                actor: characterId || undefined,
            },
            content: `${attributeName} save: ${total} vs ${dc} - ${success ? 'SUCCESS' : 'FAILURE'}`,
            roll: result,
        };
        
        ChatMessage.create(messageData);
        
        // Return the result
        const saveResult = {
            id: result.id,
            userId,
            characterId: characterId || null,
            attribute: attributePath,
            attributeName,
            roll: result.total,
            dc,
            success,
            criticalSuccess,
            criticalFailure,
            modifier,
            total,
            breakdown: `${rollExpression} = ${total}`,
            timestamp: Date.now(),
        };
        
        console.log(`[${MODULE_ID}] Saving throw: ${user.name} rolled ${attributePath} vs ${dc} = ${total} (${success ? 'success' : 'failure'})`);
        
        return saveResult;
    } catch (error) {
        console.error(`[${MODULE_ID}] Error performing saving throw:`, error);
        throw error;
    }
}

/**
 * Perform a simple dice check (no character attributes)
 * Just rolls dice and compares to DC
 * 
 * @param {string} userId - User ID
 * @param {string} characterId - Character ID (optional)
 * @param {string} expression - Dice expression to roll
 * @param {number} dc - Target number/Difficulty class (optional)
 * @returns {Object} Check result
 */
export function performSimpleCheck(userId, characterId, expression, dc) {
    try {
        // Get the user
        const user = game.users.get(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        
        // Roll the dice
        const roll = new Roll(expression);
        const result = roll.roll();
        const total = result.total;
        
        // Determine success
        const success = dc !== undefined ? total >= dc : undefined;
        const criticalSuccess = result.rolls[0].includes(20);
        const criticalFailure = result.rolls[0].includes(1);
        
        // Create chat message
        const messageData = {
            speaker: {
                user: userId,
                actor: characterId || undefined,
            },
            content: `${expression}: ${total}` + (dc !== undefined ? ` vs ${dc}` : ''),
            roll: result,
        };
        
        ChatMessage.create(messageData);
        
        // Return the result
        const checkResult = {
            id: result.id,
            userId,
            characterId: characterId || null,
            expression,
            roll: result.total,
            dc: dc !== undefined ? dc : null,
            success,
            criticalSuccess,
            criticalFailure,
            total,
            breakdown: `${expression} = ${total}`,
            timestamp: Date.now(),
        };
        
        return checkResult;
    } catch (error) {
        console.error(`[${MODULE_ID}] Error performing simple check:`, error);
        throw error;
    }
}

/**
 * Get the current game system information
 * 
 * @returns {Object} System information
 */
export function getCurrentSystem() {
    const world = game.world;
    
    if (!world) {
        return {
            success: false,
            error: 'No active world',
        };
    }
    
    return {
        success: true,
        data: {
            id: world.system,
            title: world.title,
            version: world.version,
        },
    };
}

/**
 * Handle check events from Foundry
 * 
 * @param {string} type - Check type
 * @param {Object} data - Check data
 */
export function handleCheck(type, data) {
    if (game.socket) {
        game.socket.emit(`module.${MODULE_ID}`, {
            type: `${type}Check`,
            data,
        });
    }
}
