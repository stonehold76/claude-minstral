/**
 * Matrix Widget Component
 * 
 * This is the React component that renders the Matrix chat widget.
 * It integrates with:
 * - Matrix Application Service for messaging
 * - FoundryVTT via ModuleAPI for scene backgrounds
 * - SceneSyncManager for background sync and license validation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MatrixClient, IEvent, EventType } from 'matrix-js-sdk';
import { SceneSyncManager, ISceneBackground, ILicenseCheck } from '../core/SceneSyncManager';
import { IBridgeConfig, ISceneSyncConfig } from '../core/BridgeConfig';
import { Logger } from '../utils/Logger';

/**
 * Matrix Widget Props
 */
export interface IMatrixWidgetProps {
    // Matrix client
    matrixClient: MatrixClient;
    
    // Room ID
    roomId: string;
    
    // Bridge configuration
    bridgeConfig: IBridgeConfig;
    
    // Scene sync configuration
    sceneSyncConfig: ISceneSyncConfig;
    
    // Whether to show license warnings
    showLicenseWarnings?: boolean;
    
    // Custom styles
    style?: React.CSSProperties;
    className?: string;
}

/**
 * Message type for displaying in the widget
 */
export interface IWidgetMessage {
    id: string;
    sender: string;
    senderId: string;
    content: string;
    formattedContent?: string;
    timestamp: number;
    isSystem?: boolean;
    isError?: boolean;
    isDiceRoll?: boolean;
    diceResult?: {
        expression: string;
        total: number;
        rolls: number[][];
    };
}

/**
 * Matrix Widget Component
 */
export const MatrixWidget: React.FC<IMatrixWidgetProps> = ({
    matrixClient,
    roomId,
    bridgeConfig,
    sceneSyncConfig,
    showLicenseWarnings = true,
    style = {},
    className = '',
}) => {
    const logger = useRef(new Logger('MatrixWidget')).current;
    const widgetRef = useRef<HTMLDivElement>(null);
    
    // State
    const [messages, setMessages] = useState<IWidgetMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [background, setBackground] = useState<ISceneBackground | null>(null);
    const [license, setLicense] = useState<ILicenseCheck | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Scene Sync Manager
    const sceneSyncManager = useRef<SceneSyncManager | null>(null);
    
    // Matrix room state
    const [roomName, setRoomName] = useState<string>('');
    const [roomTopic, setRoomTopic] = useState<string>('');
    const [roomMembers, setRoomMembers] = useState<string[]>([]);
    
    // Initialize Scene Sync Manager
    useEffect(() => {
        logger.info(`Initializing SceneSyncManager for room: ${roomId}`);
        
        // Create scene sync manager
        sceneSyncManager.current = new SceneSyncManager(
            sceneSyncConfig,
            bridgeConfig
        );
        
        // Set the current room
        sceneSyncManager.current.setCurrentRoom(roomId);
        
        // Set up callbacks
        sceneSyncManager.current.onBackgroundChange = (newBackground) => {
            logger.info('Background changed:', newBackground);
            setBackground(newBackground);
        };
        
        sceneSyncManager.current.onLicenseChange = (newLicense) => {
            logger.info('License status changed:', newLicense);
            setLicense(newLicense);
        };
        
        // Initialize
        sceneSyncManager.current.initialize().then(() => {
            logger.info('SceneSyncManager initialized');
            
            // Check license
            sceneSyncManager.current?.checkLicense();
            
            // Sync scene
            sceneSyncManager.current?.syncScene();
        }).catch(err => {
            logger.error('Failed to initialize SceneSyncManager:', err);
            setError(`Failed to initialize scene sync: ${err.message}`);
        });
        
        // Get room info
        loadRoomInfo();
        
        return () => {
            // Cleanup
            sceneSyncManager.current?.stop();
            sceneSyncManager.current = null;
        };
    }, [roomId, bridgeConfig, sceneSyncConfig]);
    
    // Load room information
    const loadRoomInfo = useCallback(async () => {
        try {
            const room = matrixClient.getRoom(roomId);
            if (room) {
                setRoomName(room.name || roomId);
                setRoomTopic(room.topic || '');
                
                // Get members
                const members = room.getMembers();
                setRoomMembers(members.map(m => m.userId));
            }
        } catch (err) {
            logger.error('Failed to load room info:', err as Error);
        }
    }, [matrixClient, roomId]);
    
    // Listen for Matrix events
    useEffect(() => {
        logger.info(`Setting up Matrix event listeners for room: ${roomId}`);
        
        // Function to handle room events
        const handleEvent = (event: IEvent) => {
            // Only process events for our room
            if (event.getRoomId() !== roomId) {
                return;
            }
            
            // Handle message events
            if (event.getType() === EventType.RoomMessage) {
                const content = event.getContent();
                const sender = event.getSender();
                
                const message: IWidgetMessage = {
                    id: event.getId() || Date.now().toString(),
                    sender: sender || 'Unknown',
                    senderId: event.getSender() || '',
                    content: content.body || '',
                    formattedContent: content.formatted_body,
                    timestamp: event.getTs() || Date.now(),
                    isSystem: false,
                };
                
                // Check for dice rolls in message
                if (content.body && /\/r\s+[\d\s+\-*/()d]+/i.test(content.body)) {
                    message.isDiceRoll = true;
                    // Try to parse dice roll
                    const match = content.body.match(/\/r\s+([\d\s+\-*/()d]+)/i);
                    if (match) {
                        message.diceResult = {
                            expression: match[1],
                            total: 0, // Would be calculated
                            rolls: [],
                        };
                    }
                }
                
                // Add to messages
                setMessages(prev => [...prev, message]);
            }
            
            // Handle typing events
            if (event.getType() === 'm.typing') {
                const content = event.getContent();
                const userIds = content.user_ids || [];
                setIsTyping(userIds.length > 0);
            }
        };
        
        // Add event listener
        matrixClient.on('event', handleEvent);
        
        // Load recent messages
        loadRecentMessages();
        
        return () => {
            matrixClient.off('event', handleEvent);
        };
    }, [matrixClient, roomId]);
    
    // Load recent messages
    const loadRecentMessages = useCallback(async () => {
        try {
            const room = matrixClient.getRoom(roomId);
            if (!room) return;
            
            // Get timeline
            const timeline = room.getLiveTimeline();
            const events = timeline.getEvents();
            
            // Get recent messages (last 20)
            const recentEvents = events.slice(-20);
            
            const messages: IWidgetMessage[] = recentEvents.map(event => {
                const content = event.getContent();
                return {
                    id: event.getId() || Date.now().toString(),
                    sender: event.getSender() || 'Unknown',
                    senderId: event.getSender() || '',
                    content: content.body || '',
                    formattedContent: content.formatted_body,
                    timestamp: event.getTs() || Date.now(),
                    isSystem: false,
                };
            });
            
            setMessages(messages);
        } catch (err) {
            logger.error('Failed to load recent messages:', err as Error);
        }
    }, [matrixClient, roomId]);
    
    // Send a message
    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !matrixClient) return;
        
        try {
            const room = matrixClient.getRoom(roomId);
            if (!room) {
                setError('Room not found');
                return;
            }
            
            // Send the message
            const eventId = await matrixClient.sendMessage(roomId, {
                msgtype: 'm.room.message',
                body: content,
                formatted_body: `<p>${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
            });
            
            // Clear input
            setInputValue('');
            
            logger.info(`Message sent: ${eventId}`);
        } catch (err) {
            logger.error('Failed to send message:', err as Error);
            setError(`Failed to send message: ${(err as Error).message}`);
        }
    }, [matrixClient, roomId]);
    
    // Handle form submit
    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(inputValue);
    }, [inputValue, sendMessage]);
    
    // Get background style
    const getBackgroundStyle = useCallback(() => {
        if (!background) return {};
        
        const { hasBackground, src, type, color, fullUrl, alpha } = background;
        
        if (!hasBackground) {
            return {};
        }
        
        if (type === 'color' && color) {
            return {
                backgroundColor: color,
            };
        }
        
        if (src && fullUrl) {
            const url = sceneSyncConfig.thumbnail_mode && background.thumbnailUrl 
                ? background.thumbnailUrl 
                : fullUrl;
            
            return {
                backgroundImage: `url('${url}')`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed',
            };
        }
        
        return {};
    }, [background, sceneSyncConfig]);
    
    // Check if license is valid
    const isLicensed = license?.valid !== false;
    
    // Render license warning
    const renderLicenseWarning = () => {
        if (!showLicenseWarnings || isLicensed) return null;
        
        return (
            <div className="license-warning" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                background: 'rgba(255, 0, 0, 0.9)',
                color: 'white',
                padding: '10px',
                textAlign: 'center',
                fontWeight: 'bold',
                zIndex: 1000,
            }}>
                ⚠️ License Error: {license?.error || 'Room not licensed'}
            </div>
        );
    };
    
    // Render widget
    return (
        <div
            ref={widgetRef}
            className={`matrix-widget ${className}`}
            style={{
                ...style,
                ...getBackgroundStyle(),
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* License warning */}
            {renderLicenseWarning()}
            
            {/* Widget header */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '10px',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <strong>{roomName || 'Matrix Chat'}</strong>
                    {roomTopic && <div style={{ fontSize: '0.8em', opacity: 0.7 }}>{roomTopic}</div>}
                </div>
                <div style={{ fontSize: '0.8em' }}>
                    {isConnected ? '✓ Connected' : '✗ Disconnected'}
                </div>
            </div>
            
            {/* Messages area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.5)',
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        color: '#888',
                        padding: '20px',
                    }}>
                        No messages yet
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={`${msg.id}-${index}`}
                            style={{
                                margin: '10px 0',
                                padding: '10px',
                                borderRadius: '5px',
                                background: msg.isSystem 
                                    ? 'rgba(0, 120, 255, 0.2)'
                                    : msg.isError 
                                        ? 'rgba(255, 0, 0, 0.2)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                borderLeft: msg.isDiceRoll 
                                    ? '3px solid #4a90d9'
                                    : 'none',
                            }}
                        >
                            <div style={{ fontWeight: 'bold', color: '#4a90d9' }}>
                                {msg.sender}
                            </div>
                            {msg.isDiceRoll && msg.diceResult && (
                                <div style={{ fontSize: '0.9em', color: '#888' }}>
                                    Rolled: {msg.diceResult.expression} = {msg.diceResult.total}
                                </div>
                            )}
                            <div
                                style={{ marginTop: '5px' }}
                                dangerouslySetInnerHTML={{
                                    __html: msg.formattedContent || msg.content,
                                }}
                            />
                            <div style={{ fontSize: '0.7em', color: '#666', marginTop: '5px' }}>
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    ))
                )}
                
                {isTyping && (
                    <div style={{
                        margin: '10px 0',
                        padding: '10px',
                        fontStyle: 'italic',
                        color: '#888',
                    }}>
                        Someone is typing...
                    </div>
                )}
            </div>
            
            {/* Input area */}
            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    padding: '10px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                }}
            >
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isLicensed ? "Type a message..." : "Message sending disabled (license error)"}
                    disabled={!isLicensed}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '5px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                    }}
                />
                <button
                    type="submit"
                    disabled={!inputValue.trim() || !isLicensed}
                    style={{
                        marginLeft: '10px',
                        padding: '10px 20px',
                        borderRadius: '5px',
                        border: 'none',
                        background: '#4a90d9',
                        color: 'white',
                        cursor: 'pointer',
                    }}
                >
                    Send
                </button>
            </form>
            
            {/* Error display */}
            {error && (
                <div style={{
                    padding: '10px',
                    background: 'rgba(255, 0, 0, 0.3)',
                    color: 'white',
                    borderTop: '1px solid rgba(255, 0, 0, 0.5)',
                }}>
                    Error: {error}
                </div>
            )}
            
            {/* Background info */}
            {background?.hasBackground && (
                <div style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    padding: '5px 10px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '0.8em',
                }}>
                    Background: {background.type} ({background.src})
                </div>
            )}
        </div>
    );
};

/**
 * Default export
 */
export default MatrixWidget;
