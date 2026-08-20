/**
 * Scenes Routes
 * 
 * Provides endpoints for querying scene information, including backgrounds.
 * This enables the Matrix widget to match the FoundryVTT scene background.
 */

import { Router } from 'express';
import { MODULE_ID } from '../../constants.js';

const router = Router();

/**
 * GET /scenes - Get all scenes in the current world
 */
router.get('/', (req, res) => {
    try {
        const { worldId } = req.query;
        const targetWorld = worldId ? game.worlds.get(worldId) : game.world;
        
        if (!targetWorld) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        const scenes = game.scenes.filter(scene => scene.data.worldId === targetWorld.id)
            .map(scene => formatScene(scene));
        
        res.json({
            success: true,
            data: scenes,
            currentSceneId: game.scenes.active?.id || null,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /scenes:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scenes',
            code: 500,
        });
    }
});

/**
 * GET /scenes/current - Get the current active scene
 * 
 * Returns detailed information about the currently active scene,
 * including its background image, which can be used to sync
 * the Matrix widget background.
 */
router.get('/current', (req, res) => {
    try {
        const { worldId } = req.query;
        
        // Get the target world
        const targetWorld = worldId ? game.worlds.get(worldId) : game.world;
        if (!targetWorld) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        // Get the current scene
        const currentScene = game.scenes.active;
        if (!currentScene) {
            return res.status(404).json({
                success: false,
                error: 'No active scene',
                code: 404,
            });
        }
        
        // Check if scene belongs to the requested world
        if (currentScene.data.worldId !== targetWorld.id) {
            return res.status(404).json({
                success: false,
                error: 'No active scene in specified world',
                code: 404,
            });
        }
        
        const sceneData = formatScene(currentScene);
        
        res.json({
            success: true,
            data: sceneData,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /scenes/current:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current scene',
            code: 500,
        });
    }
});

/**
 * GET /scenes/:sceneId - Get a specific scene
 */
router.get('/:sceneId', (req, res) => {
    try {
        const { sceneId } = req.params;
        const { worldId } = req.query;
        
        const scene = game.scenes.get(sceneId);
        if (!scene) {
            return res.status(404).json({
                success: false,
                error: 'Scene not found',
                code: 404,
            });
        }
        
        // Check world if specified
        if (worldId) {
            const world = game.worlds.get(worldId);
            if (!world || scene.data.worldId !== worldId) {
                return res.status(404).json({
                    success: false,
                    error: 'Scene not found in specified world',
                    code: 404,
                });
            }
        }
        
        const sceneData = formatScene(scene);
        
        res.json({
            success: true,
            data: sceneData,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /scenes/:sceneId:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get scene: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /scenes/:sceneId/background - Get scene background image
 * 
 * Returns the background image URL and information for a scene.
 * This is the primary endpoint for syncing Matrix widget background.
 */
router.get('/:sceneId/background', (req, res) => {
    try {
        const { sceneId } = req.params;
        const { worldId, thumbnail = false } = req.query;
        
        const scene = game.scenes.get(sceneId);
        if (!scene) {
            return res.status(404).json({
                success: false,
                error: 'Scene not found',
                code: 404,
            });
        }
        
        // Check world if specified
        if (worldId) {
            const world = game.worlds.get(worldId);
            if (!world || scene.data.worldId !== worldId) {
                return res.status(404).json({
                    success: false,
                    error: 'Scene not found in specified world',
                    code: 404,
                });
            }
        }
        
        // Get background information
        const background = getSceneBackground(scene, thumbnail === 'true');
        
        res.json({
            success: true,
            data: background,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /scenes/:sceneId/background:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to get scene background: ${error.message}`,
            code: 500,
        });
    }
});

/**
 * GET /scenes/current/background - Get current scene background
 * 
 * Convenience endpoint to get the background of the currently active scene.
 * This is the easiest way to sync the Matrix widget background.
 */
router.get('/current/background', (req, res) => {
    try {
        const { worldId, thumbnail = false } = req.query;
        
        // Get the target world
        const targetWorld = worldId ? game.worlds.get(worldId) : game.world;
        if (!targetWorld) {
            return res.status(404).json({
                success: false,
                error: 'World not found',
                code: 404,
            });
        }
        
        // Get the current scene
        const currentScene = game.scenes.active;
        if (!currentScene) {
            return res.status(404).json({
                success: false,
                error: 'No active scene',
                code: 404,
            });
        }
        
        // Check if scene belongs to the requested world
        if (currentScene.data.worldId !== targetWorld.id) {
            return res.status(404).json({
                success: false,
                error: 'No active scene in specified world',
                code: 404,
            });
        }
        
        // Get background information
        const background = getSceneBackground(currentScene, thumbnail === 'true');
        
        res.json({
            success: true,
            data: background,
        });
    } catch (error) {
        console.error(`[${MODULE_ID}] Error in GET /scenes/current/background:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current scene background',
            code: 500,
        });
    }
});

/**
 * Format a scene for API response
 * 
 * @param {Object} scene - Scene object
 * @returns {Object} Formatted scene data
 */
function formatScene(scene) {
    return {
        id: scene.id,
        name: scene.name,
        worldId: scene.data.worldId,
        active: scene.active,
        navigation: scene.data.navigation,
        dimensions: {
            width: scene.data.width,
            height: scene.data.height,
            scale: scene.data.scale,
        },
        grid: {
            type: scene.data.gridType,
            size: scene.data.grid,
            units: scene.data.gridUnits,
        },
        background: getSceneBackground(scene, false),
        thumbnail: getSceneBackground(scene, true),
        tokens: scene.data.tokens.length,
        lights: scene.data.lights.length,
        drawings: scene.data.drawings.length,
        timestamp: Date.now(),
    };
}

/**
 * Get scene background information
 * 
 * @param {Object} scene - Scene object
 * @param {boolean} thumbnail - Whether to get thumbnail or full image
 * @returns {Object} Background information
 */
function getSceneBackground(scene, thumbnail = false) {
    const img = thumbnail ? scene.data.thumb : scene.data.img;
    
    // Check if the scene has a background
    if (!img || img === 'icons/svg/mystery-man.svg') {
        return {
            hasBackground: false,
            src: null,
            type: null,
            color: scene.data.backgroundColor || null,
        };
    }
    
    // Determine if it's a video
    const isVideo = img.endsWith('.webm') || img.endsWith('.mp4') || img.endsWith('.mov');
    
    return {
        hasBackground: true,
        src: img,
        type: isVideo ? 'video' : 'image',
        thumbnail: scene.data.thumb || null,
        color: scene.data.backgroundColor || null,
        alpha: scene.data.backgroundAlpha || 1.0,
        // Foundry stores images in the world's data directory
        fullUrl: getFullImageUrl(img),
        thumbnailUrl: getFullImageUrl(scene.data.thumb),
    };
}

/**
 * Get the full URL for an image path
 * 
 * @param {string} path - Image path
 * @returns {string} Full URL
 */
function getFullImageUrl(path) {
    if (!path) return null;
    
    // If it's already a full URL, return it
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
        return path;
    }
    
    // Get the current world
    const world = game.world;
    if (!world) return path;
    
    // Construct URL to the world's data directory
    // Note: This assumes the API is running on the same server as Foundry
    // For remote access, you'll need to configure Foundry's file serving
    return `/worlds/${world.id}/${path}`;
}

/**
 * Initialize scene hooks
 * 
 * This sets up listeners for scene changes to emit events
 */
export function initializeSceneHooks() {
    // Listen for scene activation changes
    Hooks.on('canvasReady', () => {
        const scene = game.scenes.active;
        if (scene) {
            emitSceneEvent('sceneActivated', {
                sceneId: scene.id,
                worldId: scene.data.worldId,
                sceneName: scene.name,
                background: getSceneBackground(scene, false),
            });
        }
    });
    
    // Listen for scene updates
    Hooks.on('updateScene', (scene, changes) => {
        // Check if background changed
        if (changes.img !== undefined || changes.thumb !== undefined || 
            changes.backgroundColor !== undefined || changes.backgroundAlpha !== undefined) {
            
            emitSceneEvent('sceneBackgroundChanged', {
                sceneId: scene.id,
                worldId: scene.data.worldId,
                sceneName: scene.name,
                background: getSceneBackground(scene, false),
            });
        }
    });
    
    // Listen for scene creation
    Hooks.on('createScene', (scene) => {
        emitSceneEvent('sceneCreated', {
            sceneId: scene.id,
            worldId: scene.data.worldId,
            sceneName: scene.name,
            background: getSceneBackground(scene, false),
        });
    });
}

/**
 * Emit a scene event
 * 
 * @param {string} type - Event type
 * @param {Object} data - Event data
 */
function emitSceneEvent(type, data) {
    if (game.socket) {
        game.socket.emit(`module.${MODULE_ID}`, {
            type,
            data: {
                ...data,
                timestamp: Date.now(),
            },
        });
    }
}

export { router as scenesRouter };
