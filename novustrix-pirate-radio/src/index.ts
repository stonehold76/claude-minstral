// Novustrix Pirate Radio Widget - Main TypeScript file
// A Matrix widget that transforms a room into a live broadcast studio for Icecast

import { WidgetApi, MatrixCapabilities } from 'matrix-widget-api';

// ============================================================================
// Types
// ============================================================================

interface IcecastConfig {
    url: string;
    username: string;
    password: string;
    mountPoint: string;
    streamName: string;
}

interface QueueMember {
    userId: string;
    displayName: string;
    joinedAt: number;
    status: 'queued' | 'broadcasting';
}

interface StreamStats {
    isConnected: boolean;
    isBroadcasting: boolean;
    listenerCount: number;
    bitrate: number;
    uptime: number;
    currentBroadcaster: string | null;
}

// WebSocket message types
interface WebSocketMessage {
    type: string;
    data?: any;
}

// ============================================================================
// Global State
// ============================================================================

let widgetApi: WidgetApi;
let icecastConfig: IcecastConfig = {
    url: '',
    username: 'source',
    password: '',
    mountPoint: '/stream',
    streamName: 'Novustrix Pirate Radio'
};

let queue: QueueMember[] = [];
let streamStats: StreamStats = {
    isConnected: false,
    isBroadcasting: false,
    listenerCount: 0,
    bitrate: 128,
    uptime: 0,
    currentBroadcaster: null
};

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let socket: WebSocket | null = null;
let uptimeInterval: NodeJS.Timeout | null = null;

// Service configuration - detects localhost vs production
const SERVICE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://localhost:8082/ws' 
    : 'ws://' + window.location.hostname + ':8082/ws';

// ============================================================================
// DOM Elements
// ============================================================================

let startBroadcastBtn: HTMLButtonElement;
let stopBroadcastBtn: HTMLButtonElement;
let connectBtn: HTMLButtonElement;
let volumeSlider: HTMLInputElement;
let volumeValue: HTMLSpanElement;
let icecastUrl: HTMLInputElement;
let icecastUser: HTMLInputElement;
let icecastPass: HTMLInputElement;
let streamName: HTMLInputElement;
let statusIcon: HTMLSpanElement;
let statusText: HTMLSpanElement;
let broadcasterInfo: HTMLDivElement;
let queueList: HTMLDivElement;
let connectionStatus: HTMLDivElement;
let listenerCount: HTMLSpanElement;
let bitrateValue: HTMLSpanElement;
let uptimeValue: HTMLSpanElement;
let errorMessage: HTMLDivElement;

// ============================================================================
// Initialization
// ============================================================================

async function initWidget() {
    try {
        // Initialize Matrix Widget API
        widgetApi = new WidgetApi();
        
        console.log('Pirate Radio Widget - Initializing...');

        // Set up widget API event handlers
        widgetApi.on('ready', () => {
            console.log('Widget API is ready');
            onWidgetReady();
        });

        widgetApi.on('error', (error: Error) => {
            console.error('Widget API error:', error);
            showError(`Matrix Widget Error: ${error.message}`);
        });

        // Request necessary capabilities
        const capabilities: MatrixCapabilities = {
            canSendStateEvent: true,
            canSendMessage: true,
            canSetPowerLevels: false
        };
        
        await widgetApi.start(capabilities);
        
        // Cache DOM elements
        cacheDOMElements();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load saved configuration
        loadConfig();
        
        // Update UI
        updateUI();
        
        // Initialize WebSocket connection to broadcast service
        connectToService();
        
        console.log('Novustrix Pirate Radio Widget initialized successfully');

    } catch (error) {
        console.error('Failed to initialize widget:', error);
        showError(`Failed to initialize widget: ${error}`);
    }
}

function onWidgetReady() {
    console.log('Widget is ready');
    // Enable buttons that require widget API
    startBroadcastBtn.disabled = false;
    connectBtn.disabled = false;
    
    // Get user info
    const user = widgetApi.getUser();
    console.log('Current user:', user);
    
    // Listen for room state changes
    widgetApi.on('room_state', (state) => {
        console.log('Room state changed:', state);
    });
    
    // Listen for room messages
    widgetApi.on('room_message', (event) => {
        console.log('Room message:', event);
        // Could handle queue requests via Matrix messages
    });
}

// ============================================================================
// DOM Element Caching
// ============================================================================

function cacheDOMElements() {
    startBroadcastBtn = document.getElementById('startBroadcastBtn') as HTMLButtonElement;
    stopBroadcastBtn = document.getElementById('stopBroadcastBtn') as HTMLButtonElement;
    connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
    volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
    volumeValue = document.getElementById('volumeValue') as HTMLSpanElement;
    icecastUrl = document.getElementById('icecastUrl') as HTMLInputElement;
    icecastUser = document.getElementById('icecastUser') as HTMLInputElement;
    icecastPass = document.getElementById('icecastPass') as HTMLInputElement;
    streamName = document.getElementById('streamName') as HTMLInputElement;
    statusIcon = document.getElementById('statusIcon') as HTMLSpanElement;
    statusText = document.getElementById('statusText') as HTMLSpanElement;
    broadcasterInfo = document.getElementById('broadcasterInfo') as HTMLDivElement;
    queueList = document.getElementById('queueList') as HTMLDivElement;
    connectionStatus = document.getElementById('connectionStatus') as HTMLDivElement;
    listenerCount = document.getElementById('listenerCount') as HTMLSpanElement;
    bitrateValue = document.getElementById('bitrateValue') as HTMLSpanElement;
    uptimeValue = document.getElementById('uptimeValue') as HTMLSpanElement;
    errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
    // Start broadcast button
    startBroadcastBtn.addEventListener('click', () => {
        startBroadcast();
    });

    // Stop broadcast button
    stopBroadcastBtn.addEventListener('click', () => {
        stopBroadcast();
    });

    // Connect to service button
    connectBtn.addEventListener('click', () => {
        connectToService();
    });

    // Volume slider - update gain and display
    volumeSlider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value);
        volumeValue.textContent = `${value}%`;
        
        // Adjust microphone gain if available
        if (gainNode) {
            gainNode.gain.value = value / 100;
        }
    });

    // Icecast config form inputs
    icecastUrl.addEventListener('change', saveConfig);
    icecastUser.addEventListener('change', saveConfig);
    icecastPass.addEventListener('change', saveConfig);
    streamName.addEventListener('change', saveConfig);
}

// ============================================================================
// Configuration Management
// ============================================================================

function loadConfig() {
    // Load from localStorage
    const saved = localStorage.getItem('pirateRadioConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved) as IcecastConfig;
            icecastConfig = { ...icecastConfig, ...config };
            
            // Update form fields
            icecastUrl.value = config.url || '';
            icecastUser.value = config.username || 'source';
            icecastPass.value = config.password || '';
            streamName.value = config.streamName || 'Novustrix Pirate Radio';
        } catch (e) {
            console.error('Failed to load config:', e);
        }
    }
}

function saveConfig() {
    icecastConfig = {
        url: icecastUrl.value,
        username: icecastUser.value,
        password: icecastPass.value,
        mountPoint: '/stream',
        streamName: streamName.value
    };
    
    localStorage.setItem('pirateRadioConfig', JSON.stringify(icecastConfig));
    console.log('Configuration saved:', icecastConfig);
}

// ============================================================================
// WebSocket Service Connection
// ============================================================================

function connectToService() {
    saveConfig();
    
    // Close existing connection if any
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
    }

    // Update UI
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.classList.remove('connected', 'error');

    try {
        const user = widgetApi.getUser();
        const roomId = widgetApi.getRoomId();
        
        if (!user || !roomId) {
            throw new Error('Not authenticated with Matrix');
        }
        
        // Create WebSocket connection
        console.log('Connecting to:', SERVICE_URL);
        socket = new WebSocket(SERVICE_URL);
        
        socket.onopen = () => {
            console.log('Connected to broadcast service');
            streamStats.isConnected = true;
            connectionStatus.textContent = 'Connected';
            connectionStatus.classList.add('connected');
            
            // Join the room
            sendServiceMessage({
                type: 'join_room',
                data: {
                    roomId: roomId,
                    userId: user.userId,
                    displayName: user.displayName || user.userId
                }
            });
            
            // Send Icecast config
            sendServiceMessage({
                type: 'icecast_config',
                data: icecastConfig
            });
            
            updateUI();
        };
        
        socket.onclose = (event) => {
            console.log('Disconnected from broadcast service:', event.code, event.reason);
            streamStats.isConnected = false;
            streamStats.isBroadcasting = false;
            streamStats.currentBroadcaster = null;
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.classList.remove('connected');
            connectionStatus.classList.add('error');
            updateUI();
            
            // Attempt to reconnect after delay
            setTimeout(connectToService, 5000);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            streamStats.isConnected = false;
            connectionStatus.textContent = 'Connection error';
            connectionStatus.classList.remove('connected');
            connectionStatus.classList.add('error');
            updateUI();
        };
        
        socket.onmessage = (event) => {
            handleServiceMessage(event);
        };
        
    } catch (error) {
        console.error('Failed to connect to service:', error);
        showError(`Connection failed: ${error}`);
        streamStats.isConnected = false;
        connectionStatus.textContent = 'Connection failed';
        connectionStatus.classList.add('error');
        updateUI();
    }
}

function sendServiceMessage(message: WebSocketMessage) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not ready, message queued:', message.type);
        // Could queue messages for when connection is ready
        return;
    }
    
    try {
        socket.send(JSON.stringify(message));
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

function sendAudioChunk(chunk: Blob) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not ready, audio chunk dropped');
        return;
    }
    
    try {
        // Send binary audio chunk
        socket.send(chunk);
    } catch (error) {
        console.error('Failed to send audio chunk:', error);
    }
}

function handleServiceMessage(event: MessageEvent) {
    try {
        // Handle binary data (shouldn't happen, but just in case)
        if (event.data instanceof Blob) {
            console.warn('Received binary message from service');
            return;
        }
        
        const message = JSON.parse(event.data as string) as WebSocketMessage;
        
        console.log('Service message:', message.type, message.data);
        
        switch (message.type) {
            case 'room_state':
                handleRoomState(message.data);
                break;
            
            case 'queue_update':
                handleQueueUpdate(message.data);
                break;
                
            case 'broadcast_start':
                handleBroadcastStart(message.data);
                break;
                
            case 'broadcast_stop':
                handleBroadcastStop(message.data);
                break;
                
            case 'stream_stats':
                handleStreamStats(message.data);
                break;
                
            case 'error':
                showError(message.data?.message || 'Service error');
                break;
                
            case 'pong':
                // Pong response, do nothing
                break;
                
            default:
                console.warn('Unknown message type:', message.type);
        }
        
    } catch (error) {
        console.error('Failed to handle service message:', error);
    }
}

function handleRoomState(data: any) {
    // Update queue from room state
    if (data.queue) {
        queue = data.queue.map((m: any) => ({
            userId: m.userId,
            displayName: m.displayName,
            joinedAt: m.joinedAt ? new Date(m.joinedAt).getTime() : Date.now(),
            status: m.status as 'queued' | 'broadcasting'
        }));
    }
    
    // Update current broadcaster
    streamStats.currentBroadcaster = data.currentBroadcaster || null;
    streamStats.listenerCount = data.listenerCount || 0;
    streamStats.uptime = data.uptime || 0;
    
    // Update bitrate if provided
    if (data.icecast && data.icecast.bitrate) {
        streamStats.bitrate = data.icecast.bitrate;
    }
    
    updateUI();
}

function handleQueueUpdate(data: any) {
    if (data.queue) {
        queue = data.queue.map((m: any) => ({
            userId: m.userId,
            displayName: m.displayName,
            joinedAt: m.joinedAt ? new Date(m.joinedAt).getTime() : Date.now(),
            status: m.status as 'queued' | 'broadcasting'
        }));
    }
    
    streamStats.currentBroadcaster = data.currentBroadcaster || null;
    updateQueueDisplay();
    updateUI();
}

function handleBroadcastStart(data: any) {
    streamStats.isBroadcasting = true;
    streamStats.currentBroadcaster = data.displayName || data.userId;
    updateUI();
}

function handleBroadcastStop(data: any) {
    streamStats.isBroadcasting = false;
    if (streamStats.currentBroadcaster === (data.displayName || data.userId)) {
        streamStats.currentBroadcaster = null;
    }
    updateUI();
}

function handleStreamStats(data: any) {
    if (data.bitrate) {
        streamStats.bitrate = data.bitrate;
        bitrateValue.textContent = `${Math.floor(data.bitrate / 1000)} kbps`;
    }
}

// ============================================================================
// Broadcast Control
// ============================================================================

async function startBroadcast() {
    if (!streamStats.isConnected) {
        showError('Please connect to the broadcast service first');
        return;
    }

    const user = widgetApi.getUser();
    const roomId = widgetApi.getRoomId();
    
    if (!user || !roomId) {
        showError('Not authenticated with Matrix');
        return;
    }

    // Check if someone else is already broadcasting
    if (streamStats.currentBroadcaster && 
        streamStats.currentBroadcaster !== (user.displayName || user.userId)) {
        showError(`Someone else is currently broadcasting: ${streamStats.currentBroadcaster}`);
        return;
    }

    try {
        showLoading(true);
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false 
        });
        
        mediaStream = stream;
        
        // Initialize audio processing and MediaRecorder
        setupAudioRecording(stream);
        
        // Send start broadcast message to service
        sendServiceMessage({
            type: 'start_broadcast',
            data: {}
        });
        
        streamStats.isBroadcasting = true;
        streamStats.currentBroadcaster = user.displayName || user.userId;
        
        // Start uptime counter
        startUptimeCounter();
        
        updateUI();
        showLoading(false);
        
    } catch (error) {
        console.error('Failed to start broadcast:', error);
        showError(`Broadcast failed: ${error}`);
        showLoading(false);
    }
}

function stopBroadcast() {
    if (!streamStats.isBroadcasting) return;
    
    try {
        // Stop MediaRecorder first
        if (mediaRecorder) {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            mediaRecorder = null;
        }
        
        // Stop media stream
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        
        // Stop audio processing
        cleanupAudioProcessing();
        
        // Stop uptime counter
        stopUptimeCounter();
        
        // Send stop broadcast message to service
        sendServiceMessage({
            type: 'stop_broadcast',
            data: {}
        });
        
        streamStats.isBroadcasting = false;
        streamStats.uptime = 0;
        streamStats.currentBroadcaster = null;
        
        updateUI();
        
    } catch (error) {
        console.error('Error stopping broadcast:', error);
    }
}

// ============================================================================
// Audio Recording & Processing
// ============================================================================

function setupAudioRecording(stream: MediaStream) {
    // Create audio context for monitoring
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create media stream source
    const source = audioContext.createMediaStreamSource(stream);
    
    // Create gain node for volume control
    gainNode = audioContext.createGain();
    const volume = parseInt(volumeSlider.value) / 100;
    gainNode.gain.value = volume;
    
    // Connect to destination for local monitoring
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create analyzer for potential visualization (optional)
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    // Set up MediaRecorder for capturing audio chunks
    // Use WebM format for browser compatibility
    const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
    };
    
    mediaRecorder = new MediaRecorder(stream, options);
    
    // Send audio chunks to service as they become available
    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            console.log('Sending audio chunk:', event.data.size, 'bytes');
            sendAudioChunk(event.data);
        }
    };
    
    // Start recording with small chunk interval for low latency
    // 100ms provides good balance between latency and overhead
    mediaRecorder.start(100);
    
    // Monitor the stream locally in the widget
    const monitor = document.getElementById('audioMonitor') as HTMLAudioElement;
    monitor.srcObject = stream;
    monitor.play().catch(e => console.error('Monitor play error:', e));
    
    console.log('Audio recording set up');
}

function cleanupAudioProcessing() {
    if (audioContext) {
        audioContext.close().catch(e => console.error('Audio context close error:', e));
        audioContext = null;
    }
    
    gainNode = null;
    
    const monitor = document.getElementById('audioMonitor') as HTMLAudioElement;
    monitor.srcObject = null;
    
    console.log('Audio processing cleaned up');
}

// ============================================================================
// Uptime Counter
// ============================================================================

function startUptimeCounter() {
    stopUptimeCounter();
    
    streamStats.uptime = 0;
    uptimeInterval = setInterval(() => {
        streamStats.uptime++;
        uptimeValue.textContent = formatTime(streamStats.uptime);
    }, 1000);
}

function stopUptimeCounter() {
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
    }
}

function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [hrs, mins, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

// ============================================================================
// UI Updates
// ============================================================================

function updateUI() {
    // Update status
    if (streamStats.isBroadcasting) {
        statusIcon.textContent = '●';
        statusIcon.classList.add('broadcasting');
        statusIcon.classList.remove('connected');
        statusText.textContent = 'Live on Air';
        
        startBroadcastBtn.disabled = true;
        stopBroadcastBtn.disabled = false;
    } else if (streamStats.isConnected) {
        statusIcon.textContent = '●';
        statusIcon.classList.add('connected');
        statusIcon.classList.remove('broadcasting');
        statusText.textContent = 'Connected';
        
        startBroadcastBtn.disabled = false;
        stopBroadcastBtn.disabled = true;
    } else {
        statusIcon.textContent = '○';
        statusIcon.classList.remove('connected', 'broadcasting');
        statusText.textContent = 'Off Air';
        
        startBroadcastBtn.disabled = true;
        stopBroadcastBtn.disabled = true;
    }
    
    // Update broadcaster info
    if (streamStats.currentBroadcaster) {
        broadcasterInfo.textContent = `🎤 ${streamStats.currentBroadcaster} is live`;
    } else if (queue.length > 0) {
        const next = queue.find(m => m.status === 'queued');
        broadcasterInfo.textContent = next 
            ? `⏳ ${next.displayName} is next in queue`
            : 'No one is currently broadcasting';
    } else {
        broadcasterInfo.textContent = 'No one is currently broadcasting';
    }
    
    // Update queue
    updateQueueDisplay();
    
    // Update stats
    listenerCount.textContent = streamStats.listenerCount.toString();
    bitrateValue.textContent = `${streamStats.bitrate} kbps`;
    uptimeValue.textContent = formatTime(streamStats.uptime);
}

function updateQueueDisplay() {
    if (queue.length === 0) {
        queueList.innerHTML = '<p class="empty-state">No one in queue</p>';
        return;
    }
    
    queueList.innerHTML = '';
    queue.forEach((member, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        
        // Map status to CSS class
        const statusClass = member.status === 'broadcasting' ? 'broadcasting' : 'queued';
        
        item.innerHTML = `
            <span class="position">#${index + 1}</span>
            <span class="user">${escapeHtml(member.displayName)}</span>
            <span class="status ${statusClass}">${member.status}</span>
        `;
        
        queueList.appendChild(item);
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

function showLoading(show: boolean) {
    startBroadcastBtn.disabled = show;
    stopBroadcastBtn.disabled = show;
    connectBtn.disabled = show;
}

function showError(message: string) {
    console.error('Error:', message);
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function escapeHtml(text: string | undefined): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', initWidget);
