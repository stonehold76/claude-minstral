/**
 * Matrix Widget Container
 * 
 * This is the main container component that wraps the MatrixWidget
 * and handles the connection to the Matrix Application Service.
 * It also manages the license validation and scene sync.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MatrixClient, createClient } from 'matrix-js-sdk';
import { MatrixWidget } from './MatrixWidget';
import { SceneSyncManager } from '../core/SceneSyncManager';
import { IBridgeConfig, ISceneSyncConfig, loadConfig } from '../core/BridgeConfig';
import { Logger } from '../utils/Logger';

/**
 * Matrix Widget Container Props
 */
export interface IMatrixWidgetContainerProps {
    // Matrix homeserver URL
    homeserver: string;
    
    // Matrix room ID
    roomId: string;
    
    // Application Service token (for authentication)
    asToken?: string;
    
    // User token (for user-specific operations)
    userToken?: string;
    
    // Custom configuration
    config?: Partial<IBridgeConfig>;
    
    // Whether to show license warnings
    showLicenseWarnings?: boolean;
    
    // Custom styles
    style?: React.CSSProperties;
    className?: string;
}

/**
 * Matrix Widget Container Component
 * 
 * This component:
 * 1. Creates a Matrix client
 * 2. Manages the SceneSyncManager for background sync
 * 3. Handles license validation
 * 4. Renders the MatrixWidget with all necessary props
 */
export const MatrixWidgetContainer: React.FC<IMatrixWidgetContainerProps> = ({
    homeserver,
    roomId,
    asToken,
    userToken,
    config: configOverrides,
    showLicenseWarnings = true,
    style = {},
    className = '',
}) => {
    const logger = useRef(new Logger('MatrixWidgetContainer')).current;
    
    // State
    const [matrixClient, setMatrixClient] = useState<MatrixClient | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Configuration
    const [bridgeConfig, setBridgeConfig] = useState<IBridgeConfig>(() => {
        const defaultConfig = loadConfig();
        return { ...defaultConfig, ...configOverrides };
    });
    
    // Scene sync configuration
    const [sceneSyncConfig, setSceneSyncConfig] = useState<ISceneSyncConfig>(() => {
        return bridgeConfig.scene_sync || {
            enabled: true,
            check_interval: 5000,
            sync_background: true,
            thumbnail_mode: false,
            max_image_size: 10 * 1024 * 1024,
        };
    });
    
    // Initialize Matrix client
    useEffect(() => {
        logger.info(`Initializing Matrix client for homeserver: ${homeserver}`);
        
        try {
            // Create Matrix client
            const client = createClient({
                baseUrl: homeserver,
                accessToken: userToken || asToken,
                request: (opts) => {
                    // Custom request handler
                    return fetch(opts.uri, {
                        method: opts.method as any,
                        headers: opts.headers as any,
                        body: opts.body as any,
                    });
                },
            });
            
            setMatrixClient(client);
            setIsConnected(true);
            
            logger.info('Matrix client initialized');
            
            // Test the connection
            testMatrixConnection(client);
            
        } catch (err) {
            logger.error('Failed to create Matrix client:', err as Error);
            setError(`Failed to create Matrix client: ${(err as Error).message}`);
        }
        
        return () => {
            // Cleanup
        };
    }, [homeserver, userToken, asToken]);
    
    // Test Matrix connection
    const testMatrixConnection = async (client: MatrixClient) => {
        try {
            // Try to get the room
            const room = client.getRoom(roomId);
            if (room) {
                logger.info(`Connected to Matrix room: ${roomId}`);
            } else {
                // Try to fetch room info
                const roomInfo = await client.getRoomInfo(roomId);
                logger.info(`Matrix room info: ${roomInfo.room_id}`);
            }
        } catch (err) {
            logger.error('Failed to test Matrix connection:', err as Error);
            setError(`Failed to connect to Matrix: ${(err as Error).message}`);
        }
    };
    
    // Update scene sync config when bridge config changes
    useEffect(() => {
        if (bridgeConfig.scene_sync) {
            setSceneSyncConfig(bridgeConfig.scene_sync);
        }
    }, [bridgeConfig]);
    
    // Render
    if (!matrixClient) {
        return (
            <div
                className={`matrix-widget-container loading ${className}`}
                style={{
                    ...style,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    color: 'white',
                    background: '#1a1a1a',
                }}
            >
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5em', marginBottom: '10px' }}>Connecting to Matrix...</div>
                    {error && <div style={{ color: '#ff0000' }}>Error: {error}</div>}
                </div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div
                className={`matrix-widget-container error ${className}`}
                style={{
                    ...style,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    color: 'white',
                    background: '#1a1a1a',
                }}
            >
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5em', marginBottom: '10px', color: '#ff0000' }}>Connection Error</div>
                    <div>{error}</div>
                    <button
                        onClick={() => setError(null)}
                        style={{
                            marginTop: '20px',
                            padding: '10px 20px',
                            background: '#4a90d9',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                        }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }
    
    // Render the widget
    return (
        <MatrixWidget
            matrixClient={matrixClient}
            roomId={roomId}
            bridgeConfig={bridgeConfig}
            sceneSyncConfig={sceneSyncConfig}
            showLicenseWarnings={showLicenseWarnings}
            style={style}
            className={className}
        />
    );
};

/**
 * Default export
 */
export default MatrixWidgetContainer;
