/**
 * Novustrix Pirate Radio Service - Configuration
 * Loads environment variables and provides default values
 */

require('dotenv').config();

const config = {
    // Server Configuration
    port: parseInt(process.env.PORT || '8082'),
    host: process.env.HOST || '0.0.0.0',
    
    // Icecast Configuration
    icecast: {
        host: process.env.ICECAST_HOST || 'localhost',
        port: parseInt(process.env.ICECAST_PORT || '8000'),
        mount: process.env.ICECAST_MOUNT || '/stream',
        username: process.env.ICECAST_USERNAME || 'source',
        password: process.env.ICECAST_PASSWORD || 'hackme',
        streamName: process.env.ICECAST_STREAM_NAME || 'Novustrix Pirate Radio',
        // Optional: Icecast admin URL for stats
        adminUrl: process.env.ICECAST_ADMIN_URL || null,
        adminUser: process.env.ICECAST_ADMIN_USER || null,
        adminPass: process.env.ICECAST_ADMIN_PASS || null
    },
    
    // Audio Configuration
    audio: {
        format: process.env.AUDIO_FORMAT || 'mp3',
        bitrate: parseInt(process.env.AUDIO_BITRATE || '128000'),
        sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '44100'),
        channels: parseInt(process.env.AUDIO_CHANNELS || '2'),
        // Buffer sizes
        chunkSize: parseInt(process.env.AUDIO_CHUNK_SIZE || '4096'),
        bufferTimeout: parseInt(process.env.AUDIO_BUFFER_TIMEOUT || '100') // ms
    },
    
    // FFmpeg Configuration
    ffmpeg: {
        path: process.env.FFMPEG_PATH || 'ffmpeg',
        // FFmpeg command template for encoding
        // {input} will be replaced with stdin pipe
        // {output} will be replaced with Icecast URL
        encodeCommand: process.env.FFMPEG_ENCODE_CMD || null
    },
    
    // Security
    sharedSecret: process.env.SHARE_SECRET || null,
    
    // CORS
    cors: {
        origins: process.env.CORS_ORIGINS ? 
            process.env.CORS_ORIGINS.split(',').map(s => s.trim()) :
            ['http://localhost:8080', 'http://localhost:8081']
    },
    
    // Logging
    logLevel: process.env.LOG_LEVEL || 'info'
};

// Generate default FFmpeg command based on audio format
if (!config.ffmpeg.encodeCommand) {
    const formatMap = {
        mp3: '-f mp3 -codec:a libmp3lame -b:a {bitrate} -ar {sampleRate} -ac {channels}',
        ogg: '-f ogg -codec:a libvorbis -b:a {bitrate} -ar {sampleRate} -ac {channels}',
        aac: '-f adts -codec:a aac -b:a {bitrate} -ar {sampleRate} -ac {channels}',
        opus: '-f ogg -codec:a libopus -b:a {bitrate} -ar {sampleRate} -ac {channels}'
    };
    
    const format = formatMap[config.audio.format] || formatMap.mp3;
    config.ffmpeg.encodeCommand = format
        .replace('{bitrate}', config.audio.bitrate.toString())
        .replace('{sampleRate}', config.audio.sampleRate.toString())
        .replace('{channels}', config.audio.channels.toString());
}

// Build Icecast URL
config.icecast.url = `http://${config.icecast.host}:${config.icecast.port}${config.icecast.mount}`;

// Build Icecast auth string
config.icecast.authHeader = Buffer.from(
    `${config.icecast.username}:${config.icecast.password}`
).toString('base64');

// Validate required Icecast settings
if (!config.icecast.host || !config.icecast.username || !config.icecast.password) {
    console.warn('WARNING: Icecast connection parameters not fully configured');
    console.warn('Set ICECAST_HOST, ICECAST_USERNAME, ICECAST_PASSWORD in .env');
}

module.exports = config;
