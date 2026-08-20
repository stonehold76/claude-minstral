/**
 * Checks Integration
 * 
 * Handles skill checks, ability checks, and saving throws with Foundry's
 * character system and dice roller.
 */

import { MODULE_ID } from '../constants.js';
import { rollDice } from './dice.js';

/**
 * Perform a skill check
 * 
 * @param {string} userId - User ID performing the check
 * @param {string} characterId - Character ID (optional)
 * @param {string} skill - Skill name
 * @param {number} dc - Difficulty class (optional)
 * @param {boolean} advantage - Whether to roll with advantage
 * @param {boolean} disadvantage - Whether to roll with disadvantage
 * @returns {Object} Check result
 */
export function performSkillCheck(userId, characterId, skill, dc, advantage = false, disadvantage = false) {
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
        let ability = '';
        let rollExpression = '1d20';
        
        // If we have a character, get the skill modifier
        if (character && character.system?.skills?.[skill]) {
            const skillData = character.system.skills[skill];
            modifier = skillData.mod || skillData.value || 0;
            ability = skillData.ability || '';
            rollExpression = `1d20 + ${modifier}`;
        } else {
            // No character, just roll 1d20
            console.warn(`[${MODULE_ID}] No character found for skill check, rolling 1d20`);
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
            content: `${skill} check: ${total}` + (dc !== undefined ? ` (DC ${dc})` : ''),
            roll: result,
        };
        
        ChatMessage.create(messageData);
        
        // Return the result
        const checkResult = {
            id: result.id,
            userId,
            characterId: characterId || null,
            skill,
            ability,
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
        
        console.log(`[${MODULE_ID}] Skill check: ${user.name} rolled ${skill} = ${total}`);
        
        return checkResult;
    } catch (error) {
        console.error(`[${MODULE_ID}] Error performing skill check:`, error);
        throw error;
    }
}

/**
 * Perform an ability check
 * 
 * @param {string} userId - User ID performing the check
 * @param {string} characterId - Character ID (optional)
 * @param {string} ability - Ability name (str, dex, con, int, wis, cha)
 * @param {number} dc - Difficulty class (optional)
 * @param {boolean} advantage - Whether to roll with advantage
 * @param {boolean} disadvantage - Whether to roll with disadvantage
 * @returns {Object} Check result
 */
export function performAbilityCheck(userId, characterId, ability, dc, advantage = false, disadvantage = false) {
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
        let abilityName = ability.toLowerCase();
        let rollExpression = '1d20';
        
        // Map ability abbreviations to full names
        const abilityMap = {
            str: 'strength',
            dex: 'dexterity',
            con: 'constitution',
            int: 'intelligence',
            wis: 'wisdom',
            cha: 'charisma',
        };
        
        abilityName = abilityMap[abilityName] || abilityName;
        
        // If we have a character, get the ability modifier
        if (character && character.system?.abilities?.[abilityName]) {
            const abilityData = character.system.abilities[abilityName];
            modifier = abilityData.mod || abilityData.value || 0;
            rollExpression = `1d20 + ${modifier}`;
        } else {
            // No character, just roll 1d20
            console.warn(`[${MODULE_ID}] No character found for ability check, rolling 1d20`);
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
            content: `${ability.toUpperCase()} check: ${total}` + (dc !== undefined ? ` (DC ${dc})` : ''),
            roll: result,
        };
        
        ChatMessage.create(messageData);
        
        // Return the result
        const checkResult = {
            id: result.id,
            userId,
            characterId: characterId || null,
            ability: abilityName,
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
        
        console.log(`[${MODULE_ID}] Ability check: ${user.name} rolled ${ability} = ${total}`);
        
        return checkResult;
    } catch (error) {
        console.error(`[${MODULE_ID}] Error performing ability check:`, error);
        throw error;
    }
}

/**
 * Perform a saving throw
 * 
 * @param {string} userId - User ID performing the save
 * @param {string} characterId - Character ID (optional)
 * @param {string} ability - Ability name (str, dex, con, int, wis, cha)
 * @param {number} dc - Difficulty class
 * @param {boolean} advantage - Whether to roll with advantage
 * @param {boolean} disadvantage - Whether to roll with disadvantage
 * @returns {Object} Saving throw result
 */
export function performSavingThrow(userId, characterId, ability, dc, advantage = false, disadvantage = false) {
    try {
        // Get the character
        const character = characterId ? game.actors.get(characterId) : null;
        
        if (characterId && !character) {
            throw new Error(`Character not found: ${characterId}`);
        }
        
        if (!dc) {
            throw new Error('DC is required for saving throws');
        }
        
        // Get the user
        const user = game.users.get(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }
        
        let modifier = 0;
        let abilityName = ability.toLowerCase();
        let rollExpression = '1d20';
        
        // Map ability abbreviations
        const abilityMap = {
            str: 'strength',
            dex: 'dexterity',
            con: 'constitution',
            int: 'intelligence',
            wis: 'wisdom',
            cha: 'charisma',
        };
        
        abilityName = abilityMap[abilityName] || abilityName;
        
        // If we have a character, get the saving throw modifier
        if (character) {
            // Different systems have different ways of storing saves
            // Try to get from system.saves or system.abilities
            if (character.system?.saves?.[abilityName]) {
                const saveData = character.system.saves[abilityName];
                modifier = saveData.mod || saveData.value || 0;
            } else if (character.system?.abilities?.[abilityName]) {
                const abilityData = character.system.abilities[abilityName];
                modifier = abilityData.save || abilityData.mod || 0;
            }
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
            content: `${ability.toUpperCase()} save: ${total} vs DC ${dc} - ${success ? 'SAVED' : 'FAILED'}`,
            roll: result,
        };
        
        ChatMessage.create(messageData);
        
        // Return the result
        const saveResult = {
            id: result.id,
            userId,
            characterId: characterId || null,
            ability: abilityName,
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
        
        console.log(`[${MODULE_ID}] Saving throw: ${user.name} rolled ${ability} vs DC ${dc} = ${total} (${success ? 'saved' : 'failed'})`);
        
        return saveResult;
    } catch (error) {
        console.error(`[${MODULE_ID}] Error performing saving throw:`, error);
        throw error;
    }
}

/**
 * Handle check events from Foundry
 * 
 * @param {string} type - Check type (skill, ability, save)
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
