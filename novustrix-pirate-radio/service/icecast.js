/**
 * Novustrix Pirate Radio Service - Icecast Client
 * Handles streaming audio to Icecast server using FFmpeg
 */

const config = require('./config');
const { spawn, exec } = require('child_process');
const { PassThrough, Writable } = require('stream');
const pino = require('pino');

const logger = pino({ level: config.logLevel, name: 'icecast' });

/**
 * Icecast Stream Client
 * Uses FFmpeg to encode audio and stream to Icecast
 */
class IcecastClient {
    constructor() {
        /** @type {import('child_process').ChildProcessWithoutNullStreams|null} */
        this.ffmpegProcess = null;
        
        /** @type {Writable|null} */
        this.audioInput = null;
        
        this.isRunning = false;
        this.isConnected = false;
        this.error = null;
        this.stats = {
            bytesSent: 0,
            startTime: null,
            lastUpdate: null
        };
    }
    
    /**
     * Check if FFmpeg is available
     * @returns {Promise<boolean>}
     */
    async checkFFmpeg() {
        return new Promise((resolve) => {
            exec(`${config.ffmpeg.path} -version`, (error, stdout, stderr) => {
                if (error) {
                    logger.error('FFmpeg not found:', error.message);
                    resolve(false);
                } else {
                    const version = stdout.toString().split('\n')[0] || '';
                    logger.info(`FFmpeg found: ${version.trim()}`);
                    resolve(true);
                }
            });
        });
    }
    
    /**
     * Build FFmpeg command for streaming to Icecast
     * @param {string} inputFormat - Input format (webm, wav, etc.)
     * @returns {string[]}
     */
    buildFFmpegCommand(inputFormat = 'webm') {
        const icecastUrl = `${config.icecast.url}`;
        
        // Base command
        const cmd = [
            '-i', 'pipe:0',           // Read from stdin
            '-f', config.audio.format, // Output format
            '-codec:a', this.getCodecForFormat(config.audio.format),
            '-b:a', `${config.audio.bitrate}`,
            '-ar', `${config.audio.sampleRate}`,
            '-ac', `${config.audio.channels}`,
            '-content_type', `audio/${config.audio.format}`,
            '-metadata', `title="${config.icecast.streamName}"`,
            '-metadata', 'genre="Pirate Radio"',
            '-ice_name', config.icecast.streamName,
            '-ice_description', 'Live broadcast from Matrix',
            '-ice_url', 'https://matrix.org',
            '-ice_genre', 'Various',
            '-ice_public', '1'
        ];
        
        // Add Icecast authentication
        if (config.icecast.username && config.icecast.password) {
            cmd.push(
                '-ice_user', config.icecast.username,
                '-ice_pass', config.icecast.password
            );
        }
        
        // Output to Icecast
        cmd.push(icecastUrl);
        
        return [config.ffmpeg.path, ...cmd];
    }
    
    /**
     * Get FFmpeg codec for audio format
     * @param {string} format
     * @returns {string}
     */
    getCodecForFormat(format) {
        const codecMap = {
            mp3: 'libmp3lame',
            ogg: 'libvorbis',
            aac: 'aac',
            opus: 'libopus',
            flac: 'flac'
        };
        return codecMap[format] || 'libmp3lame';
    }
    
    /**
     * Start Icecast stream
     * @param {string} [inputFormat='webm'] - Input audio format
     * @returns {Promise<void>}
     */
    async start(inputFormat = 'webm') {
        if (this.isRunning) {
            logger.warn('Icecast stream already running');
            return;
        }
        
        // Check FFmpeg
        const ffmpegAvailable = await this.checkFFmpeg();
        if (!ffmpegAvailable) {
            throw new Error('FFmpeg is not installed or not found in PATH');
        }
        
        // Build command
        const cmd = this.buildFFmpegCommand(inputFormat);
        logger.info('Starting FFmpeg:', cmd.join(' '));
        
        // Spawn FFmpeg process
        this.ffmpegProcess = spawn(cmd[0], cmd.slice(1), {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        this.isRunning = true;
        this.isConnected = false;
        this.stats.startTime = Date.now();
        this.stats.bytesSent = 0;
        
        // Capture stderr for debugging
        this.ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString();
            logger.debug('FFmpeg stderr:', message.trim());
            
            // Check for connection success
            if (message.includes('Connection to server established')) {
                this.isConnected = true;
                logger.info('Connected to Icecast server');
            }
        });
        
        // Capture stdout
        this.ffmpegProcess.stdout.on('data', (data) => {
            logger.debug('FFmpeg stdout:', data.toString().trim());
        });
        
        // Handle errors
        this.ffmpegProcess.on('error', (error) => {
            logger.error('FFmpeg error:', error);
            this.error = error;
            this.isRunning = false;
            this.isConnected = false;
        });
        
        // Handle exit
        this.ffmpegProcess.on('exit', (code, signal) => {
            logger.info(`FFmpeg exited with code ${code}, signal ${signal}`);
            this.isRunning = false;
            this.isConnected = false;
            this.ffmpegProcess = null;
            this.audioInput = null;
        });
        
        // Create writable stream for audio input
        this.audioInput = new Writable({
            write: (chunk, encoding, callback) => {
                if (!this.ffmpegProcess || !this.ffmpegProcess.stdin.writable) {
                    callback(new Error('FFmpeg process not available'));
                    return;
                }
                
                this.ffmpegProcess.stdin.write(chunk, callback);
                this.stats.bytesSent += chunk.length;
                this.stats.lastUpdate = Date.now();
            }
        });
        
        // Handle stdin errors
        this.ffmpegProcess.stdin.on('error', (error) => {
            logger.error('FFmpeg stdin error:', error);
            this.error = error;
        });
        
        logger.info('Icecast stream started');
    }
    
    /**
     * Stop Icecast stream
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        logger.info('Stopping Icecast stream...');
        
        // Close audio input
        if (this.audioInput) {
            this.audioInput.end();
            this.audioInput = null;
        }
        
        // Kill FFmpeg process
        if (this.ffmpegProcess) {
            this.ffmpegProcess.stdin.end();
            this.ffmpegProcess.kill('SIGTERM');
            this.ffmpegProcess = null;
        }
        
        this.isRunning = false;
        this.isConnected = false;
        
        logger.info('Icecast stream stopped');
    }
    
    /**
     * Write audio chunk to Icecast stream
     * @param {Buffer} chunk - Audio data chunk
     * @returns {Promise<void>}
     */
    async write(chunk) {
        if (!this.isRunning || !this.audioInput) {
            throw new Error('Icecast stream not running');
        }
        
        return new Promise((resolve, reject) => {
            this.audioInput.write(chunk, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
    
    /**
     * Get stream statistics
     * @returns {Object}
     */
    getStats() {
        const uptime = this.stats.startTime ? (Date.now() - this.stats.startTime) / 1000 : 0;
        const bitrate = this.stats.lastUpdate ? 
            (this.stats.bytesSent * 8) / uptime : 0;
        
        return {
            isRunning: this.isRunning,
            isConnected: this.isConnected,
            bytesSent: this.stats.bytesSent,
            uptime: Math.floor(uptime),
            bitrate: Math.floor(bitrate),
            error: this.error
        };
    }
    
    /**
     * Get Icecast listener stats
     * Requires admin credentials in config
     * @returns {Promise<Object|null>}
     */
    async getListenerStats() {
        if (!config.icecast.adminUrl) {
            return null;
        }
        
        try {
            // Icecast admin stats are available at /admin/stats
            // This is a simplified approach
            const adminUrl = new URL('/admin/stats.xml', config.icecast.adminUrl);
            
            // For a real implementation, you'd need to:
            // 1. Parse the XML response from Icecast
            // 2. Extract listener count, source info, etc.
            
            logger.info('Icecast admin stats not fully implemented - return mock data');
            
            return {
                listeners: 0,
                sources: 0,
                uptime: 0
            };
        } catch (error) {
            logger.error('Failed to get Icecast stats:', error);
            return null;
        }
    }
}

// Singleton instance
const icecastClient = new IcecastClient();

module.exports = icecastClient;
