/**
 * Bridge Configuration Module
 * 
 * Handles loading, parsing, and validating bridge configuration
 * from YAML files and environment variables.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../utils/Logger';

/**
 * Matrix configuration interface
 */
export interface IMatrixConfig {
    // Matrix homeserver URL
    homeserver: string;
    
    // Application Service settings
    id?: string;
    as_token?: string;
    hs_token?: string;
    sender_localpart?: string;
    url?: string;
    as_registration?: string;
    
    // Bot user credentials (alternative to AS)
    bot_username?: string;
    bot_password?: string;
    
    // Namespaces for App Service
    namespaces?: {
        users?: Array<{
            exclusive: boolean;
            regex: string;
        }>;
        rooms?: Array<{
            exclusive: boolean;
            regex: string;
        }>;
        aliases?: Array<{
            exclusive: boolean;
            regex: string;
        }>;
    };
}

/**
 * FoundryVTT configuration interface
 */
export interface IFoundryConfig {
    // Connection settings
    host: string;
    port: number;
    use_ssl: boolean;
    socketio: boolean;
    
    // Authentication
    api_token?: string;
    username?: string;
    password?: string;
    
    // Module settings
    data_path?: string;
    module_enabled?: boolean;
    
    // Connection timeout
    timeout?: number;
    reconnect_interval?: number;
}

/**
 * Bridge configuration interface
 */
export interface IBridgeConfig {
    // Server settings
    port: number;
    host?: string;
    
    // Admin users
    admin_users: string[];
    
    // Room mappings (Matrix room -> Foundry world)
    room_mappings: Record<string, string>;
    
    // Default Foundry world
    default_world?: string;
    
    // Logging
    log_level?: string;
    log_file?: string;
    
    // Feature toggles
    features?: {
        dice_rolls?: boolean;
        file_upload?: boolean;
        presence_sync?: boolean;
        typing_indicators?: boolean;
        ghost_users?: boolean;
        whispers?: boolean;
        reactions?: boolean;
        read_receipts?: boolean;
    };
    
    // Rate limiting
    limits?: {
        max_message_length?: number;
        max_file_size_mb?: number;
        rate_limit_messages_per_minute?: number;
        rate_limit_api_calls_per_second?: number;
        max_retries?: number;
        retry?: {
            initial_delay_ms?: number;
            max_delay_ms?: number;
            multiplier?: number;
        };
    };
    
    // Security
    security?: {
        allowed_ips?: string[];
        blocked_users?: string[];
        allowed_users?: string[];
        tls?: {
            enabled: boolean;
            cert_file?: string;
            key_file?: string;
        };
        cors?: {
            origins: string[];
            methods: string[];
        };
    };
}

/**
 * User mapping configuration
 */
export interface IUserMappingConfig {
    mappings: Record<string, string>;
    default?: {
        strategy: 'create_ghost' | 'ignore' | 'error';
        ghost?: {
            prefix?: string;
            permissions?: string[];
        };
    };
}

/**
 * Room mapping configuration
 */
export interface IRoomMappingConfig {
    mappings: Array<{
        matrix_room: string;
        foundry_world: string;
        direction: 'matrix_to_foundry' | 'foundry_to_matrix' | 'both';
    }>;
    default?: {
        enabled: boolean;
        direction: 'matrix_to_foundry' | 'foundry_to_matrix' | 'both';
    };
}

/**
 * Complete bridge configuration
 */
export interface IConfig {
    matrix: IMatrixConfig;
    foundry: IFoundryConfig;
    bridge: IBridgeConfig;
    users?: IUserMappingConfig;
    rooms?: IRoomMappingConfig;
}

/**
 * BridgeConfig class
 * 
 * Handles loading and managing bridge configuration
 */
export class BridgeConfig {
    private logger: Logger;
    private config: IConfig;
    private configPath: string;
    
    /**
     * Creates a new BridgeConfig instance
     * 
     * @param configPath - Path to the configuration file
     */
    constructor(configPath?: string) {
        this.logger = new Logger('BridgeConfig');
        this.configPath = configPath || path.join(__dirname, '../../../config/config.yaml');
        this.config = this.getDefaultConfig();
    }
    
    /**
     * Gets the default configuration
     */
    private getDefaultConfig(): IConfig {
        return {
            matrix: {
                homeserver: process.env.MATRIX_HS_URL || 'https://matrix.org',
                as_token: process.env.MATRIX_AS_TOKEN,
                hs_token: process.env.MATRIX_HS_TOKEN,
                sender_localpart: process.env.MATRIX_SENDER_LOCALPART || '_foundry_bridge',
                as_registration: process.env.MATRIX_AS_REGISTRATION,
                namespaces: {
                    users: [
                        {
                            exclusive: true,
                            regex: `@_foundry_.*:${process.env.MATRIX_SERVER_NAME || 'matrix\\.org'}`
                        }
                    ],
                    rooms: [],
                    aliases: []
                },
            },
            foundry: {
                host: process.env.FOUNDRY_HOST || 'localhost',
                port: parseInt(process.env.FOUNDRY_PORT || '30000'),
                use_ssl: process.env.FOUNDRY_USE_SSL === 'true',
                socketio: process.env.FOUNDRY_SOCKETIO !== 'false',
                api_token: process.env.FOUNDRY_API_TOKEN,
                timeout: 30000,
                reconnect_interval: 5000,
            },
            bridge: {
                port: parseInt(process.env.BRIDGE_PORT || '8008'),
                host: process.env.BRIDGE_HOST || 'localhost',
                admin_users: process.env.BRIDGE_ADMIN_USERS?.split(',') || [],
                room_mappings: {},
                log_level: process.env.LOG_LEVEL || 'info',
                log_file: process.env.LOG_FILE || '/var/log/foundry-bridge.log',
                features: {
                    dice_rolls: process.env.FEATURE_DICE_ROLLS !== 'false',
                    file_upload: process.env.FEATURE_FILE_UPLOAD !== 'false',
                    presence_sync: process.env.FEATURE_PRESENCE_SYNC !== 'false',
                    typing_indicators: process.env.FEATURE_TYPING_INDICATORS !== 'false',
                    ghost_users: process.env.FEATURE_GHOST_USERS !== 'false',
                    whispers: process.env.FEATURE_WHISPERS !== 'false',
                    reactions: process.env.FEATURE_REACTIONS !== 'false',
                    read_receipts: process.env.FEATURE_READ_RECEIPTS === 'true',
                },
                limits: {
                    max_message_length: parseInt(process.env.MAX_MESSAGE_LENGTH || '4096'),
                    max_file_size_mb: parseInt(process.env.MAX_FILE_SIZE_MB || '10'),
                    rate_limit_messages_per_minute: parseInt(process.env.RATE_LIMIT_MESSAGES || '60'),
                    rate_limit_api_calls_per_second: parseInt(process.env.RATE_LIMIT_API || '10'),
                    max_retries: parseInt(process.env.MAX_RETRIES || '3'),
                    retry: {
                        initial_delay_ms: parseInt(process.env.RETRY_INITIAL_DELAY || '1000'),
                        max_delay_ms: parseInt(process.env.RETRY_MAX_DELAY || '30000'),
                        multiplier: parseInt(process.env.RETRY_MULTIPLIER || '2'),
                    },
                },
                security: {
                    allowed_ips: process.env.ALLOWED_IPS?.split(',') || [],
                    blocked_users: process.env.BLOCKED_USERS?.split(',') || [],
                    allowed_users: process.env.ALLOWED_USERS?.split(',') || [],
                    tls: {
                        enabled: process.env.TLS_ENABLED === 'true',
                        cert_file: process.env.TLS_CERT_FILE,
                        key_file: process.env.TLS_KEY_FILE,
                    },
                    cors: {
                        origins: process.env.CORS_ORIGINS?.split(',') || ['*'],
                        methods: process.env.CORS_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'DELETE'],
                    },
                },
            },
        };
    }
    
    /**
     * Loads configuration from file
     */
    public load(): void {
        this.logger.info(`Loading configuration from: ${this.configPath}`);
        
        try {
            // Check if file exists
            if (!fs.existsSync(this.configPath)) {
                this.logger.warn(`Configuration file not found: ${this.configPath}, using defaults`);
                return;
            }
            
            // Read and parse YAML file
            const fileContents = fs.readFileSync(this.configPath, 'utf8');
            const fileConfig = yaml.load(fileContents) as Partial<IConfig>;
            
            // Merge with defaults
            this.config = this.mergeConfigs(this.config, fileConfig);
            
            // Load environment variables (they take precedence)
            this.loadEnvironmentVariables();
            
            this.logger.info('Configuration loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load configuration:', error);
            throw error;
        }
    }
    
    /**
     * Loads configuration from environment variables
     */
    private loadEnvironmentVariables(): void {
        this.logger.debug('Loading configuration from environment variables');
        
        // Matrix configuration
        if (process.env.MATRIX_HS_URL) {
            this.config.matrix.homeserver = process.env.MATRIX_HS_URL;
        }
        if (process.env.MATRIX_AS_TOKEN) {
            this.config.matrix.as_token = process.env.MATRIX_AS_TOKEN;
        }
        if (process.env.MATRIX_HS_TOKEN) {
            this.config.matrix.hs_token = process.env.MATRIX_HS_TOKEN;
        }
        if (process.env.MATRIX_SENDER_LOCALPART) {
            this.config.matrix.sender_localpart = process.env.MATRIX_SENDER_LOCALPART;
        }
        
        // Foundry configuration
        if (process.env.FOUNDRY_HOST) {
            this.config.foundry.host = process.env.FOUNDRY_HOST;
        }
        if (process.env.FOUNDRY_PORT) {
            this.config.foundry.port = parseInt(process.env.FOUNDRY_PORT);
        }
        if (process.env.FOUNDRY_API_TOKEN) {
            this.config.foundry.api_token = process.env.FOUNDRY_API_TOKEN;
        }
        
        // Bridge configuration
        if (process.env.BRIDGE_PORT) {
            this.config.bridge.port = parseInt(process.env.BRIDGE_PORT);
        }
        if (process.env.LOG_LEVEL) {
            this.config.bridge.log_level = process.env.LOG_LEVEL;
        }
    }
    
    /**
     * Merges two configurations
     * 
     * @param defaultConfig - Default configuration
     * @param overrideConfig - Configuration to override with
     */
    private mergeConfigs(defaultConfig: IConfig, overrideConfig: Partial<IConfig>): IConfig {
        return {
            ...defaultConfig,
            ...overrideConfig,
            matrix: {
                ...defaultConfig.matrix,
                ...overrideConfig.matrix,
                namespaces: {
                    ...defaultConfig.matrix.namespaces,
                    ...overrideConfig.matrix?.namespaces,
                },
            },
            foundry: {
                ...defaultConfig.foundry,
                ...overrideConfig.foundry,
            },
            bridge: {
                ...defaultConfig.bridge,
                ...overrideConfig.bridge,
                features: {
                    ...defaultConfig.bridge.features,
                    ...overrideConfig.bridge?.features,
                },
                limits: {
                    ...defaultConfig.bridge.limits,
                    ...overrideConfig.bridge?.limits,
                    retry: {
                        ...defaultConfig.bridge.limits?.retry,
                        ...overrideConfig.bridge?.limits?.retry,
                    },
                },
                security: {
                    ...defaultConfig.bridge.security,
                    ...overrideConfig.bridge?.security,
                    tls: {
                        ...defaultConfig.bridge.security?.tls,
                        ...overrideConfig.bridge?.security?.tls,
                    },
                    cors: {
                        ...defaultConfig.bridge.security?.cors,
                        ...overrideConfig.bridge?.security?.cors,
                    },
                },
            },
        };
    }
    
    /**
     * Saves the current configuration to file
     */
    public save(): void {
        this.logger.info(`Saving configuration to: ${this.configPath}`);
        
        try {
            const yamlContent = yaml.dump(this.config, {
                indent: 2,
                sortKeys: true,
            });
            
            fs.writeFileSync(this.configPath, yamlContent, 'utf8');
            this.logger.info('Configuration saved successfully');
        } catch (error) {
            this.logger.error('Failed to save configuration:', error);
            throw error;
        }
    }
    
    /**
     * Validates the configuration
     */
    public validate(): string[] {
        const errors: string[] = [];
        
        // Validate Matrix configuration
        if (!this.config.matrix.homeserver) {
            errors.push('Matrix homeserver URL is required');
        }
        
        if (!this.config.matrix.as_token && !this.config.matrix.bot_username) {
            errors.push('Either Application Service token or bot username is required');
        }
        
        // Validate Foundry configuration
        if (!this.config.foundry.host) {
            errors.push('Foundry host is required');
        }
        
        if (!this.config.foundry.port) {
            errors.push('Foundry port is required');
        }
        
        // Validate Bridge configuration
        if (!this.config.bridge.port) {
            errors.push('Bridge port is required');
        }
        
        // Validate room mappings
        for (const [matrixRoom, foundryWorld] of Object.entries(this.config.bridge.room_mappings)) {
            if (!matrixRoom || !foundryWorld) {
                errors.push(`Invalid room mapping: ${matrixRoom} -> ${foundryWorld}`);
            }
        }
        
        return errors;
    }
    
    /**
     * Gets the complete configuration
     */
    public getConfig(): IConfig {
        return this.config;
    }
    
    /**
     * Gets Matrix configuration
     */
    public getMatrixConfig(): IMatrixConfig {
        return this.config.matrix;
    }
    
    /**
     * Gets Foundry configuration
     */
    public getFoundryConfig(): IFoundryConfig {
        return this.config.foundry;
    }
    
    /**
     * Gets Bridge configuration
     */
    public getBridgeConfig(): IBridgeConfig {
        return this.config.bridge;
    }
    
    /**
     * Gets a specific configuration value using dot notation
     * 
     * @param key - The configuration key (e.g., 'matrix.homeserver')
     */
    public get<T>(key: string): T | undefined {
        const keys = key.split('.');
        let value: any = this.config;
        
        for (const k of keys) {
            if (value === undefined || value === null) {
                return undefined;
            }
            value = value[k];
        }
        
        return value as T | undefined;
    }
    
    /**
     * Sets a configuration value using dot notation
     * 
     * @param key - The configuration key
     * @param value - The value to set
     */
    public set<T>(key: string, value: T): void {
        const keys = key.split('.');
        let current: any = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (current[k] === undefined) {
                current[k] = {};
            }
            current = current[k];
        }
        
        current[keys[keys.length - 1]] = value;
    }
    
    /**
     * Checks if a feature is enabled
     * 
     * @param feature - The feature name
     */
    public isFeatureEnabled(feature: keyof NonNullable<IBridgeConfig['features']>): boolean {
        return this.config.bridge.features?.[feature] ?? false;
    }
    
    /**
     * Gets the room mapping for a Matrix room
     * 
     * @param matrixRoomId - The Matrix room ID
     */
    public getRoomMapping(matrixRoomId: string): string | undefined {
        return this.config.bridge.room_mappings[matrixRoomId];
    }
    
    /**
     * Sets a room mapping
     * 
     * @param matrixRoomId - The Matrix room ID
     * @param foundryWorldId - The Foundry world ID
     */
    public setRoomMapping(matrixRoomId: string, foundryWorldId: string): void {
        this.config.bridge.room_mappings[matrixRoomId] = foundryWorldId;
    }
    
    /**
     * Removes a room mapping
     * 
     * @param matrixRoomId - The Matrix room ID
     */
    public removeRoomMapping(matrixRoomId: string): void {
        delete this.config.bridge.room_mappings[matrixRoomId];
    }
    
    /**
     * Checks if a user is an admin
     * 
     * @param userId - The Matrix user ID
     */
    public isAdminUser(userId: string): boolean {
        return this.config.bridge.admin_users.includes(userId);
    }
    
    /**
     * Checks if a user is allowed to use the bridge
     * 
     * @param userId - The Matrix user ID
     */
    public isUserAllowed(userId: string): boolean {
        const allowedUsers = this.config.bridge.security?.allowed_users || [];
        const blockedUsers = this.config.bridge.security?.blocked_users || [];
        
        // If no allowed users specified, allow all
        if (allowedUsers.length === 0) {
            return !blockedUsers.includes(userId);
        }
        
        // Check if user is in allowed list
        const isAllowed = allowedUsers.some(
            pattern => pattern === userId || pattern === '*' || pattern.endsWith(':*') && userId.startsWith(pattern.replace(':*', ''))
        );
        
        // Check if user is blocked
        const isBlocked = blockedUsers.includes(userId);
        
        return isAllowed && !isBlocked;
    }
    
    /**
     * Gets the log level
     */
    public getLogLevel(): string {
        return this.config.bridge.log_level || 'info';
    }
    
    /**
     * Gets the log file path
     */
    public getLogFile(): string | undefined {
        return this.config.bridge.log_file;
    }
    
    /**
     * Gets the rate limit for messages per minute
     */
    public getRateLimitMessagesPerMinute(): number {
        return this.config.bridge.limits?.rate_limit_messages_per_minute || 60;
    }
    
    /**
     * Gets the maximum message length
     */
    public getMaxMessageLength(): number {
        return this.config.bridge.limits?.max_message_length || 4096;
    }
    
    /**
     * Gets the maximum file size in bytes
     */
    public getMaxFileSizeBytes(): number {
        const mb = this.config.bridge.limits?.max_file_size_mb || 10;
        return mb * 1024 * 1024;
    }
}
