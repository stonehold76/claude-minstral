/**
 * Scene Sync Manager
 * 
 * Manages synchronization between FoundryVTT scenes and Matrix rooms.
 * Handles:
 * - Fetching scene backgrounds from Foundry
 * - Applying backgrounds to Matrix rooms
 * - License validation for room usage
 * - Real-time updates when scenes change
 */

import { Logger } from '../utils/Logger';
import { IBridgeConfig, ISceneSyncConfig } from './BridgeConfig';
import { ModuleAPI } from '../foundry/ModuleAPI';

/**
 * Scene background information
 */
export interface ISceneBackground {
    hasBackground: boolean;
    src: string | null;
    type: 'image' | 'video' | 'color' | null;
    thumbnail: string | null;
    color: string | null;
    alpha: number;
    fullUrl: string | null;
    thumbnailUrl: string | null;
}

/**
 * Scene information
 */
export interface ISceneInfo {
    id: string;
    name: string;
    worldId: string;
    active: boolean;
    background: ISceneBackground;
    dimensions: {
        width: number;
        height: number;
        scale: number;
    };
    timestamp: number;
}

/**
 * License validation result
 */
export interface ILicenseCheck {
    valid: boolean;
    roomId?: string;
    licensedRoomId?: string;
    error?: string;
    timestamp: number;
}

/**
 * Scene Sync Manager class
 */
export class SceneSyncManager {
    private logger: Logger;
    private config: ISceneSyncConfig;
    private moduleAPI: ModuleAPI | null = null;
    private bridgeConfig: IBridgeConfig;
    
    // Current state
    private currentScene: ISceneInfo | null = null;
    private currentBackground: ISceneBackground | null = null;
    private currentRoomId: string | null = null;
    
    // Timers
    private syncInterval: NodeJS.Timeout | null = null;
    private licenseCheckInterval: NodeJS.Timeout | null = null;
    
    // Callbacks
    private onBackgroundChange: ((background: ISceneBackground) => void) | null = null;
    private onLicenseChange: ((license: ILicenseCheck) => void) | null = null;
    
    // License state
    private licenseValid: boolean = true;
    private licenseError: string | null = null;
    
    /**
     * Creates a new SceneSyncManager
     * 
     * @param config - Scene sync configuration
     * @param bridgeConfig - Full bridge configuration
     * @param moduleAPI - Module API instance
     */
    constructor(config: ISceneSyncConfig, bridgeConfig: IBridgeConfig, moduleAPI: ModuleAPI | null = null) {
        this.logger = new Logger('SceneSyncManager');
        this.config = config;
        this.bridgeConfig = bridgeConfig;
        this.moduleAPI = moduleAPI;
    }
    
    /**
     * Initializes the scene sync manager
     */
    public async initialize(): Promise<void> {
        this.logger.info('Initializing Scene Sync Manager...');
        
        try {
            // Check if scene sync is enabled
            if (!this.config.enabled) {
                this.logger.info('Scene sync is disabled');
                return;
            }
            
            // Validate configuration
            if (!this.bridgeConfig.foundry.host || !this.bridgeConfig.foundry.port) {
                this.logger.warn('Foundry connection not configured, scene sync disabled');
                this.config.enabled = false;
                return;
            }
            
            // Create ModuleAPI if not provided
            if (!this.moduleAPI) {
                this.moduleAPI = new ModuleAPI({
                    host: this.bridgeConfig.foundry.host,
                    port: this.bridgeConfig.foundry.port,
                    use_ssl: this.bridgeConfig.foundry.use_ssl,
                    api_token: this.bridgeConfig.foundry.api_token,
                    api_enabled: this.bridgeConfig.foundry.api_enabled,
                    api_port: this.bridgeConfig.foundry.api_port,
                    module_enabled: this.bridgeConfig.foundry.module_enabled,
                    enforce_license: this.bridgeConfig.foundry.enforce_license,
                    licensed_room_id: this.bridgeConfig.foundry.licensed_room_id,
                });
                
                // Initialize the module API
                await this.moduleAPI.initialize();
                this.logger.info('Module API initialized for scene sync');
            }
            
            // Start sync intervals
            this.startSyncIntervals();
            
            // Initial sync
            await this.syncScene();
            
            this.logger.info('Scene Sync Manager initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Scene Sync Manager:', error as Error);
            throw error;
        }
    }
    
    /**
     * Starts the sync intervals
     */
    private startSyncIntervals(): void {
        // Stop existing intervals
        this.stopSyncIntervals();
        
        // Start scene sync interval
        if (this.config.enabled) {
            this.syncInterval = setInterval(() => {
                this.syncScene().catch(error => {
                    this.logger.error('Error syncing scene:', error);
                });
            }, this.config.check_interval);
            
            this.logger.info(`Scene sync interval started: ${this.config.check_interval}ms`);
        }
        
        // Start license check interval
        if (this.bridgeConfig.foundry.enforce_license) {
            this.licenseCheckInterval = setInterval(() => {
                this.checkLicense().catch(error => {
                    this.logger.error('Error checking license:', error);
                });
            }, this.config.check_interval);
            
            this.logger.info('License check interval started');
        }
    }
    
    /**
     * Stops the sync intervals
     */
    private stopSyncIntervals(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        if (this.licenseCheckInterval) {
            clearInterval(this.licenseCheckInterval);
            this.licenseCheckInterval = null;
        }
    }
    
    /**
     * Sets the current Matrix room ID
     * 
     * @param roomId - The Matrix room ID
     */
    public setCurrentRoom(roomId: string): void {
        if (roomId !== this.currentRoomId) {
            this.currentRoomId = roomId;
            this.logger.info(`Current room set to: ${roomId}`);
            
            // Check license for the new room
            this.checkLicense().catch(error => {
                this.logger.error('Error checking license for new room:', error);
            });
            
            // Trigger background sync
            this.syncScene().catch(error => {
                this.logger.error('Error syncing scene for new room:', error);
            });
        }
    }
    
    /**
     * Gets the current Matrix room ID
     */
    public getCurrentRoom(): string | null {
        return this.currentRoomId;
    }
    
    /**
     * Checks if the current room is licensed
     */
    public async checkLicense(): Promise<ILicenseCheck> {
        const result: ILicenseCheck = {
            valid: true,
            roomId: this.currentRoomId || undefined,
            timestamp: Date.now(),
        };
        
        try {
            // If no room set, check is invalid
            if (!this.currentRoomId) {
                result.valid = false;
                result.error = 'No Matrix room ID set';
                this.licenseValid = false;
                this.licenseError = result.error;
                this.emitLicenseChange(result);
                return result;
            }
            
            // If license enforcement is disabled, always valid
            if (!this.bridgeConfig.foundry.enforce_license) {
                result.valid = true;
                this.licenseValid = true;
                this.licenseError = null;
                this.emitLicenseChange(result);
                return result;
            }
            
            // If no licensed room configured, all rooms are valid
            if (!this.bridgeConfig.foundry.licensed_room_id) {
                result.valid = true;
                result.licensedRoomId = null;
                this.licenseValid = true;
                this.licenseError = null;
                this.emitLicenseChange(result);
                return result;
            }
            
            // Check if current room matches licensed room
            if (this.currentRoomId !== this.bridgeConfig.foundry.licensed_room_id) {
                result.valid = false;
                result.licensedRoomId = this.bridgeConfig.foundry.licensed_room_id;
                result.error = `Room ${this.currentRoomId} is not licensed. Only room ${this.bridgeConfig.foundry.licensed_room_id} is authorized.`;
                this.licenseValid = false;
                this.licenseError = result.error;
                this.emitLicenseChange(result);
                return result;
            }
            
            // Room is licensed
            result.valid = true;
            result.licensedRoomId = this.bridgeConfig.foundry.licensed_room_id;
            this.licenseValid = true;
            this.licenseError = null;
            this.emitLicenseChange(result);
            
        } catch (error) {
            result.valid = false;
            result.error = `License check failed: ${(error as Error).message}`;
            this.licenseValid = false;
            this.licenseError = result.error;
            this.emitLicenseChange(result);
        }
        
        return result;
    }
    
    /**
     * Gets the current license status
     */
    public getLicenseStatus(): ILicenseCheck {
        return {
            valid: this.licenseValid,
            roomId: this.currentRoomId || undefined,
            licensedRoomId: this.bridgeConfig.foundry.licensed_room_id || undefined,
            error: this.licenseError || undefined,
            timestamp: Date.now(),
        };
    }
    
    /**
     * Checks if the current room is licensed
     */
    public isLicensed(): boolean {
        return this.licenseValid;
    }
    
    /**
     * Syncs the current scene from Foundry
     */
    public async syncScene(): Promise<ISceneInfo | null> {
        try {
            if (!this.moduleAPI) {
                this.logger.error('Module API not initialized');
                return null;
            }
            
            // Get current scene background
            const response = await this.moduleAPI.getCurrentSceneBackground();
            
            if (!response || !response.success) {
                this.logger.debug('No scene background available');
                return null;
            }
            
            const sceneInfo: ISceneInfo = {
                id: response.data.sceneId,
                name: response.data.sceneName,
                worldId: response.data.worldId,
                active: true,
                background: response.data.background,
                dimensions: response.data.dimensions,
                timestamp: Date.now(),
            };
            
            // Check if background changed
            if (!this.currentScene || 
                this.currentScene.id !== sceneInfo.id ||
                JSON.stringify(this.currentScene.background) !== JSON.stringify(sceneInfo.background)) {
                
                this.currentScene = sceneInfo;
                this.currentBackground = sceneInfo.background;
                
                this.logger.info(`Scene changed: ${sceneInfo.name} (${sceneInfo.id})`);
                this.emitBackgroundChange(sceneInfo.background);
            }
            
            return sceneInfo;
        } catch (error) {
            this.logger.error('Error syncing scene:', error as Error);
            return null;
        }
    }
    
    /**
     * Gets the current scene information
     */
    public getCurrentScene(): ISceneInfo | null {
        return this.currentScene;
    }
    
    /**
     * Gets the current background
     */
    public getCurrentBackground(): ISceneBackground | null {
        return this.currentBackground;
    }
    
    /**
     * Gets the CSS for the current background
     */
    public getBackgroundCSS(): string {
        if (!this.currentBackground) {
            return '';
        }
        
        const { hasBackground, src, type, color, fullUrl, alpha } = this.currentBackground;
        
        if (!hasBackground) {
            return '';
        }
        
        // If it's a color background
        if (type === 'color' && color) {
            return `background-color: ${color};`;
        }
        
        // If it's an image or video
        if (src && fullUrl) {
            const url = this.config.thumbnail_mode && this.currentBackground.thumbnailUrl 
                ? this.currentBackground.thumbnailUrl 
                : fullUrl;
            
            if (type === 'video') {
                return `background: url('${url}') center/cover no-repeat fixed;`;
            } else {
                // For images, add opacity if alpha is set
                const opacity = alpha !== undefined ? alpha : 1;
                return `background: url('${url}') center/cover no-repeat fixed; background-size: cover;`;
            }
        }
        
        return '';
    }
    
    /**
     * Gets the background style object for React
     */
    public getBackgroundStyle(): React.CSSProperties {
        if (!this.currentBackground) {
            return {};
        }
        
        const { hasBackground, src, type, color, fullUrl, alpha } = this.currentBackground;
        
        if (!hasBackground) {
            return {};
        }
        
        if (type === 'color' && color) {
            return {
                backgroundColor: color,
            };
        }
        
        if (src && fullUrl) {
            const url = this.config.thumbnail_mode && this.currentBackground.thumbnailUrl 
                ? this.currentBackground.thumbnailUrl 
                : fullUrl;
            
            return {
                backgroundImage: `url('${url}')`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed',
                opacity: alpha !== undefined ? alpha : 1,
            };
        }
        
        return {};
    }
    
    /**
     * Sets the callback for background changes
     * 
     * @param callback - Callback function
     */
    public onBackgroundChange(callback: (background: ISceneBackground) => void): void {
        this.onBackgroundChange = callback;
    }
    
    /**
     * Sets the callback for license changes
     * 
     * @param callback - Callback function
     */
    public onLicenseChange(callback: (license: ILicenseCheck) => void): void {
        this.onLicenseChange = callback;
    }
    
    /**
     * Emits a background change event
     * 
     * @param background - The new background
     */
    private emitBackgroundChange(background: ISceneBackground): void {
        if (this.onBackgroundChange) {
            this.onBackgroundChange(background);
        }
    }
    
    /**
     * Emits a license change event
     * 
     * @param license - The license check result
     */
    private emitLicenseChange(license: ILicenseCheck): void {
        if (this.onLicenseChange) {
            this.onLicenseChange(license);
        }
    }
    
    /**
     * Stops the scene sync manager
     */
    public async stop(): Promise<void> {
        this.logger.info('Stopping Scene Sync Manager...');
        
        this.stopSyncIntervals();
        
        if (this.moduleAPI) {
            // Clean up ModuleAPI
            this.moduleAPI.clearCaches();
        }
        
        this.currentScene = null;
        this.currentBackground = null;
        this.currentRoomId = null;
        this.licenseValid = true;
        this.licenseError = null;
        
        this.logger.info('Scene Sync Manager stopped');
    }
    
    /**
     * Gets statistics about the scene sync manager
     */
    public getStats(): object {
        return {
            enabled: this.config.enabled,
            currentRoomId: this.currentRoomId,
            currentSceneId: this.currentScene?.id || null,
            currentSceneName: this.currentScene?.name || null,
            hasBackground: this.currentBackground?.hasBackground || false,
            backgroundType: this.currentBackground?.type || null,
            licenseValid: this.licenseValid,
            licenseError: this.licenseError,
            syncInterval: this.config.check_interval,
        };
    }
}
