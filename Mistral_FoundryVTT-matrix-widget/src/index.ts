/**
 * Matrix-FoundryVTT Bridge Entry Point
 * 
 * This is the main entry point for the bridge application.
 * It initializes all components and starts the bridge service.
 */

import { Logger } from './utils/Logger';
import { BridgeConfig } from './core/BridgeConfig';
import { MatrixAppService } from './matrix/MatrixAppService';
import { MessageTranslator } from './core/MessageTranslator';
import { UserMapper } from './core/UserMapper';
import { FoundryClient } from './foundry/FoundryClient';

/**
 * Main bridge class
 * 
 * Orchestrates all components of the bridge:
 * - Matrix Application Service
 * - FoundryVTT Client
 * - Message Translator
 * - User Mapper
 */
class MatrixFoundryBridge {
    private logger: Logger;
    private config: BridgeConfig;
    private matrixAppService: MatrixAppService | null = null;
    private foundryClient: FoundryClient | null = null;
    private messageTranslator: MessageTranslator | null = null;
    private userMapper: UserMapper | null = null;
    private isRunning: boolean = false;
    
    constructor() {
        this.logger = new Logger('MatrixFoundryBridge');
        this.config = new BridgeConfig();
    }
    
    /**
     * Initializes the bridge
     */
    public async initialize(): Promise<void> {
        this.logger.info('Initializing Matrix-FoundryVTT Bridge...');
        
        try {
            // Load configuration
            this.logger.info('Loading configuration...');
            this.config.load();
            
            // Validate configuration
            const errors = this.config.validate();
            if (errors.length > 0) {
                throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
            }
            
            this.logger.info('Configuration loaded and validated');
            
            // Initialize components
            this.logger.info('Initializing components...');
            
            // Create user mapper
            this.userMapper = new UserMapper(this.config);
            this.logger.info('User Mapper initialized');
            
            // Create message translator
            this.messageTranslator = new MessageTranslator(this.config);
            this.logger.info('Message Translator initialized');
            
            // Create Foundry client
            this.foundryClient = new FoundryClient(
                this.config.getFoundryConfig(),
                this.userMapper,
                this.messageTranslator
            );
            this.logger.info('Foundry Client initialized');
            
            // Create Matrix Application Service
            this.matrixAppService = new MatrixAppService(
                this.config.getMatrixConfig(),
                this.messageTranslator,
                this.userMapper,
                this.foundryClient
            );
            this.logger.info('Matrix Application Service initialized');
            
            // Initialize Matrix App Service
            await this.matrixAppService.initialize();
            this.logger.info('Matrix Application Service ready');
            
            // Initialize Foundry Client
            await this.foundryClient.initialize();
            this.logger.info('Foundry Client ready');
            
            this.logger.info('All components initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize bridge:', error as Error);
            throw error;
        }
    }
    
    /**
     * Starts the bridge
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Bridge is already running');
            return;
        }
        
        this.logger.info('Starting Matrix-FoundryVTT Bridge...');
        
        try {
            if (!this.matrixAppService) {
                throw new Error('Matrix Application Service not initialized');
            }
            
            if (!this.foundryClient) {
                throw new Error('Foundry Client not initialized');
            }
            
            // Start Matrix Application Service
            await this.matrixAppService.start();
            this.logger.info('Matrix Application Service started');
            
            // Connect to FoundryVTT
            await this.foundryClient.connect();
            this.logger.info('Foundry Client connected');
            
            // Set up event forwarding
            this.setupEventForwarding();
            
            this.isRunning = true;
            this.logger.info('Matrix-FoundryVTT Bridge is now running!');
            
            // Log startup information
            this.logStartupInfo();
        } catch (error) {
            this.logger.error('Failed to start bridge:', error as Error);
            throw error;
        }
    }
    
    /**
     * Sets up bidirectional event forwarding
     */
    private setupEventForwarding(): void {
        this.logger.info('Setting up event forwarding...');
        
        // Forward events from Foundry to Matrix
        if (this.foundryClient && this.matrixAppService) {
            this.foundryClient.on('message', (foundryMessage) => {
                this.handleFoundryMessage(foundryMessage);
            });
            
            this.foundryClient.on('userJoined', (foundryUserId, foundryWorldId) => {
                this.handleFoundryUserJoined(foundryUserId, foundryWorldId);
            });
            
            this.foundryClient.on('userLeft', (foundryUserId, foundryWorldId) => {
                this.handleFoundryUserLeft(foundryUserId, foundryWorldId);
            });
            
            this.foundryClient.on('typing', (foundryUserId, foundryWorldId, isTyping) => {
                this.handleFoundryTyping(foundryUserId, foundryWorldId, isTyping);
            });
            
            this.foundryClient.on('diceRoll', (foundryUserId, foundryWorldId, rollResult) => {
                this.handleFoundryDiceRoll(foundryUserId, foundryWorldId, rollResult);
            });
            
            this.logger.info('Foundry -> Matrix event forwarding configured');
        }
        
        // Matrix -> Foundry forwarding is handled by MatrixAppService
        this.logger.info('Matrix -> Foundry event forwarding configured');
    }
    
    /**
     * Handles messages from Foundry and forwards to Matrix
     * 
     * @param foundryMessage - The Foundry message to handle
     */
    private async handleFoundryMessage(foundryMessage: any): Promise<void> {
        this.logger.debug('Handling Foundry message:', {
            worldId: foundryMessage.worldId,
            sender: foundryMessage.sender,
        });
        
        try {
            if (!this.matrixAppService || !this.messageTranslator || !this.userMapper) {
                this.logger.error('Required components not initialized');
                return;
            }
            
            // Get the Matrix room for this Foundry world
            const matrixRoomId = this.getMatrixRoomForFoundryWorld(foundryMessage.worldId);
            if (!matrixRoomId) {
                this.logger.warn(`No Matrix room mapped for Foundry world: ${foundryMessage.worldId}`);
                return;
            }
            
            // Translate the message to Matrix format
            const matrixEvent = this.messageTranslator.foundryToMatrix(foundryMessage);
            
            if (matrixEvent) {
                // Send to Matrix
                await this.matrixAppService.sendFormattedMessage(matrixRoomId, matrixEvent);
                this.logger.info(`Forwarded Foundry message to Matrix: ${foundryMessage.id}`);
            }
        } catch (error) {
            this.logger.error('Error handling Foundry message:', error as Error);
        }
    }
    
    /**
     * Handles user joined events from Foundry
     * 
     * @param foundryUserId - The Foundry user ID
     * @param foundryWorldId - The Foundry world ID
     */
    private async handleFoundryUserJoined(foundryUserId: string, foundryWorldId: string): Promise<void> {
        this.logger.info(`User ${foundryUserId} joined Foundry world ${foundryWorldId}`);
        
        try {
            if (!this.matrixAppService || !this.userMapper) {
                return;
            }
            
            // Get or create Matrix user mapping
            const matrixUserId = this.userMapper.getMatrixUser(foundryUserId);
            
            if (matrixUserId) {
                // User is already mapped
                this.logger.debug(`User ${foundryUserId} is mapped to Matrix user ${matrixUserId}`);
            } else if (this.config.isFeatureEnabled('ghost_users')) {
                // Create ghost user
                const ghostUserId = await this.matrixAppService.createGhostUser(foundryUserId);
                if (ghostUserId) {
                    this.logger.info(`Created ghost user ${ghostUserId} for Foundry user ${foundryUserId}`);
                }
            }
            
            // Get Matrix room and send join notification
            const matrixRoomId = this.getMatrixRoomForFoundryWorld(foundryWorldId);
            if (matrixRoomId && matrixUserId) {
                // In a real implementation, we would send a system message
                // For now, just log it
                this.logger.info(`User ${matrixUserId} joined Matrix room ${matrixRoomId}`);
            }
        } catch (error) {
            this.logger.error('Error handling Foundry user joined:', error as Error);
        }
    }
    
    /**
     * Handles user left events from Foundry
     * 
     * @param foundryUserId - The Foundry user ID
     * @param foundryWorldId - The Foundry world ID
     */
    private async handleFoundryUserLeft(foundryUserId: string, foundryWorldId: string): Promise<void> {
        this.logger.info(`User ${foundryUserId} left Foundry world ${foundryWorldId}`);
        
        // Similar to user joined, but for leaving
        // Implementation would be symmetric
    }
    
    /**
     * Handles typing events from Foundry
     * 
     * @param foundryUserId - The Foundry user ID
     * @param foundryWorldId - The Foundry world ID
     * @param isTyping - Whether the user is typing
     */
    private async handleFoundryTyping(foundryUserId: string, foundryWorldId: string, isTyping: boolean): Promise<void> {
        this.logger.debug(`User ${foundryUserId} is ${isTyping ? 'typing' : 'not typing'} in ${foundryWorldId}`);
        
        try {
            if (!this.matrixAppService || !this.userMapper) {
                return;
            }
            
            // Get Matrix user ID
            const matrixUserId = this.userMapper.getMatrixUser(foundryUserId);
            if (!matrixUserId) {
                return;
            }
            
            // Get Matrix room
            const matrixRoomId = this.getMatrixRoomForFoundryWorld(foundryWorldId);
            if (!matrixRoomId) {
                return;
            }
            
            // Send typing indicator to Matrix
            // Note: In Matrix, typing indicators are sent by the user themselves
            // So we need to send this as if it's from the Matrix user
            // This is a limitation of the Application Service API
            this.logger.debug(`Sending typing indicator for ${matrixUserId} in ${matrixRoomId}`);
        } catch (error) {
            this.logger.error('Error handling Foundry typing:', error as Error);
        }
    }
    
    /**
     * Handles dice roll events from Foundry
     * 
     * @param foundryUserId - The Foundry user ID
     * @param foundryWorldId - The Foundry world ID
     * @param rollResult - The dice roll result
     */
    private async handleFoundryDiceRoll(
        foundryUserId: string,
        foundryWorldId: string,
        rollResult: any
    ): Promise<void> {
        this.logger.debug(`Dice roll from ${foundryUserId} in ${foundryWorldId}: ${JSON.stringify(rollResult)}`);
        
        // In a real implementation, this would format the dice roll
        // and send it to Matrix in a nice format
    }
    
    /**
     * Gets the Matrix room ID for a Foundry world ID
     * 
     * @param foundryWorldId - The Foundry world ID
     */
    private getMatrixRoomForFoundryWorld(foundryWorldId: string): string | null {
        // Look up in room mappings
        for (const [matrixRoom, worldId] of Object.entries(this.config.getBridgeConfig().room_mappings)) {
            if (worldId === foundryWorldId) {
                return matrixRoom;
            }
        }
        
        // Return default if configured
        return this.config.getBridgeConfig().default_world || null;
    }
    
    /**
     * Stops the bridge
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            this.logger.warn('Bridge is not running');
            return;
        }
        
        this.logger.info('Stopping Matrix-FoundryVTT Bridge...');
        
        try {
            // Stop Matrix Application Service
            if (this.matrixAppService) {
                await this.matrixAppService.stop();
                this.logger.info('Matrix Application Service stopped');
            }
            
            // Disconnect from Foundry
            if (this.foundryClient) {
                await this.foundryClient.disconnect();
                this.logger.info('Foundry Client disconnected');
            }
            
            this.isRunning = false;
            this.logger.info('Matrix-FoundryVTT Bridge stopped');
        } catch (error) {
            this.logger.error('Error stopping bridge:', error as Error);
            throw error;
        }
    }
    
    /**
     * Logs startup information
     */
    private logStartupInfo(): void {
        this.logger.info('='.repeat(60));
        this.logger.info('Matrix-FoundryVTT Bridge Startup Information');
        this.logger.info('='.repeat(60));
        
        const matrixConfig = this.config.getMatrixConfig();
        const foundryConfig = this.config.getFoundryConfig();
        const bridgeConfig = this.config.getBridgeConfig();
        
        this.logger.info('Matrix Configuration:');
        this.logger.info(`  Homeserver: ${matrixConfig.homeserver}`);
        this.logger.info(`  Application Service ID: ${matrixConfig.id || 'default'}`);
        this.logger.info(`  Sender Localpart: ${matrixConfig.sender_localpart || '_foundry_bridge'}`);
        
        this.logger.info('');
        this.logger.info('FoundryVTT Configuration:');
        this.logger.info(`  Host: ${foundryConfig.host}`);
        this.logger.info(`  Port: ${foundryConfig.port}`);
        this.logger.info(`  Use SSL: ${foundryConfig.use_ssl}`);
        this.logger.info(`  Socket.IO: ${foundryConfig.socketio}`);
        
        this.logger.info('');
        this.logger.info('Bridge Configuration:');
        this.logger.info(`  Port: ${bridgeConfig.port}`);
        this.logger.info(`  Admin Users: ${bridgeConfig.admin_users.length}`);
        this.logger.info(`  Room Mappings: ${Object.keys(bridgeConfig.room_mappings).length}`);
        this.logger.info(`  Log Level: ${bridgeConfig.log_level || 'info'}`);
        
        this.logger.info('');
        this.logger.info('Enabled Features:');
        const features = bridgeConfig.features || {};
        Object.entries(features).forEach(([feature, enabled]) => {
            if (enabled) {
                this.logger.info(`  ✓ ${feature}`);
            }
        });
        
        this.logger.info('='.repeat(60));
    }
    
    /**
     * Gets the current status of the bridge
     */
    public getStatus(): object {
        return {
            isRunning: this.isRunning,
            matrixAppService: this.matrixAppService ? this.matrixAppService.getStats() : null,
            foundryClient: this.foundryClient ? this.foundryClient.getStats() : null,
            config: {
                matrix: this.config.getMatrixConfig(),
                foundry: this.config.getFoundryConfig(),
                bridge: this.config.getBridgeConfig(),
            },
        };
    }
    
    /**
     * Gets the bridge configuration
     */
    public getConfig(): BridgeConfig {
        return this.config;
    }
}

// Create bridge instance
const bridge = new MatrixFoundryBridge();

/**
 * Graceful shutdown handler
 */
function handleShutdown(signal: string): void {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    bridge.stop().then(() => {
        console.log('Bridge stopped successfully');
        process.exit(0);
    }).catch((error) => {
        console.error('Error stopping bridge:', error);
        process.exit(1);
    });
}

// Set up signal handlers
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('SIGHUP', () => {
    console.log('SIGHUP received. Reloading configuration...');
    try {
        bridge.getConfig().load();
        console.log('Configuration reloaded');
    } catch (error) {
        console.error('Error reloading configuration:', error);
    }
});

/**
 * Main function
 */
async function main(): Promise<void> {
    try {
        // Initialize the bridge
        await bridge.initialize();
        
        // Start the bridge
        await bridge.start();
        
        // Keep the process running
        // In a real implementation, we might have an HTTP server for admin API
        // For now, just wait for shutdown signals
        console.log('Bridge is running. Press Ctrl+C to stop.');
        
        // Simple keep-alive
        setInterval(() => {}, 1000);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Start the bridge if this file is run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Bridge crashed:', error);
        process.exit(1);
    });
}

// Export the bridge instance for testing
export { bridge, MatrixFoundryBridge };
