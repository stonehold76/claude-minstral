/**
 * Logger Utility
 * 
 * Provides structured logging for the bridge application.
 * Supports multiple output targets (console, file) and log levels.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

/**
 * Log level types
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug',
    TRACE = 'trace',
}

/**
 * Log entry interface
 */
export interface ILogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: string;
    metadata?: Record<string, any>;
    error?: Error;
}

/**
 * Log formatter function type
 */
export type LogFormatter = (entry: ILogEntry) => string;

/**
 * Logger configuration
 */
export interface ILoggerConfig {
    level: LogLevel;
    console?: boolean;
    file?: string;
    format?: 'json' | 'text' | 'simple';
    customFormatter?: LogFormatter;
    maxFileSize?: number; // in bytes
    maxFiles?: number; // number of rotated files to keep
}

/**
 * Logger class
 * 
 * Provides structured logging with support for:
 * - Multiple log levels (error, warn, info, debug, trace)
 * - Multiple output targets (console, file)
 * - Custom formatting
 * - Context-based logging
 * - Error stack traces
 */
export class Logger {
    private config: ILoggerConfig;
    private context: string;
    private fileStream: fs.WriteStream | null = null;
    private static instances: Map<string, Logger> = new Map();
    
    /**
     * Creates a new Logger instance
     * 
     * @param context - The logging context (usually the class name)
     * @param config - Logger configuration
     */
    constructor(context: string, config?: Partial<ILoggerConfig>) {
        this.context = context;
        
        // Default configuration
        this.config = {
            level: LogLevel.INFO,
            console: true,
            file: undefined,
            format: 'text',
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            ...config,
        };
        
        // Parse log level from environment
        const envLevel = process.env.LOG_LEVEL?.toLowerCase();
        if (envLevel && Object.values(LogLevel).includes(envLevel as LogLevel)) {
            this.config.level = envLevel as LogLevel;
        }
        
        // Initialize file logging if configured
        if (this.config.file) {
            this.initializeFileLogging();
        }
    }
    
    /**
     * Gets or creates a logger instance for a context
     * 
     * @param context - The logging context
     * @param config - Optional configuration
     */
    public static getLogger(context: string, config?: Partial<ILoggerConfig>): Logger {
        const key = config ? `${context}:${JSON.stringify(config)}` : context;
        
        if (!Logger.instances.has(key)) {
            Logger.instances.set(key, new Logger(context, config));
        }
        
        return Logger.instances.get(key)!;
    }
    
    /**
     * Initializes file logging
     */
    private initializeFileLogging(): void {
        if (!this.config.file) return;
        
        try {
            // Ensure directory exists
            const dir = path.dirname(this.config.file);
            if (dir && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Open file stream in append mode
            this.fileStream = fs.createWriteStream(this.config.file, {
                flags: 'a',
                encoding: 'utf8',
            });
            
            this.fileStream.on('error', (error) => {
                console.error(`Logger file stream error: ${error.message}`);
            });
        } catch (error) {
            console.error(`Failed to initialize file logging: ${error}`);
        }
    }
    
    /**
     * Checks if a log level is enabled
     * 
     * @param level - The log level to check
     */
    private isLevelEnabled(level: LogLevel): boolean {
        const levels: LogLevel[] = [
            LogLevel.ERROR,
            LogLevel.WARN,
            LogLevel.INFO,
            LogLevel.DEBUG,
            LogLevel.TRACE,
        ];
        
        const currentLevelIndex = levels.indexOf(this.config.level);
        const targetLevelIndex = levels.indexOf(level);
        
        return targetLevelIndex <= currentLevelIndex;
    }
    
    /**
     * Logs a message at the specified level
     * 
     * @param level - The log level
     * @param message - The message to log
     * @param metadata - Optional metadata to include
     */
    private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
        if (!this.isLevelEnabled(level)) {
            return;
        }
        
        const entry: ILogEntry = {
            level,
            message,
            timestamp: new Date(),
            context: this.context,
            metadata,
        };
        
        const formattedMessage = this.formatMessage(entry);
        
        // Log to console
        if (this.config.console) {
            this.writeToConsole(level, formattedMessage);
        }
        
        // Log to file
        if (this.fileStream) {
            this.writeToFile(formattedMessage);
        }
    }
    
    /**
     * Formats a log entry
     * 
     * @param entry - The log entry to format
     */
    private formatMessage(entry: ILogEntry): string {
        if (this.config.customFormatter) {
            return this.config.customFormatter(entry);
        }
        
        switch (this.config.format) {
            case 'json':
                return this.formatAsJson(entry);
            case 'simple':
                return this.formatAsSimple(entry);
            default:
                return this.formatAsText(entry);
        }
    }
    
    /**
     * Formats a log entry as JSON
     * 
     * @param entry - The log entry
     */
    private formatAsJson(entry: ILogEntry): string {
        const jsonEntry = {
            timestamp: entry.timestamp.toISOString(),
            level: entry.level,
            context: entry.context,
            message: entry.message,
            ...entry.metadata,
        };
        
        if (entry.error) {
            (jsonEntry as any).error = {
                name: entry.error.name,
                message: entry.error.message,
                stack: entry.error.stack,
            };
        }
        
        return JSON.stringify(jsonEntry);
    }
    
    /**
     * Formats a log entry as simple text
     * 
     * @param entry - The log entry
     */
    private formatAsSimple(entry: ILogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);
        const context = entry.context ? `[${entry.context}]` : '';
        const message = entry.message;
        
        let result = `${timestamp} ${level} ${context} ${message}`;
        
        if (entry.error) {
            result += `\n${entry.error.stack}`;
        }
        
        return result;
    }
    
    /**
     * Formats a log entry as text with colors (for console)
     * 
     * @param entry - The log entry
     */
    private formatAsText(entry: ILogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const level = this.getLevelColor(entry.level);
        const context = entry.context ? `[${entry.context}]` : '';
        const message = entry.message;
        
        let result = `${timestamp} ${level} ${context} ${message}`;
        
        if (entry.error) {
            result += `\n${entry.error.stack}`;
        }
        
        return result;
    }
    
    /**
     * Gets the ANSI color code for a log level
     * 
     * @param level - The log level
     */
    private getLevelColor(level: LogLevel): string {
        const colors = {
            [LogLevel.ERROR]: '\x1b[31mERROR\x1b[0m',   // Red
            [LogLevel.WARN]: '\x1b[33mWARN \x1b[0m',   // Yellow
            [LogLevel.INFO]: '\x1b[36mINFO \x1b[0m',   // Cyan
            [LogLevel.DEBUG]: '\x1b[35mDEBUG\x1b[0m',  // Magenta
            [LogLevel.TRACE]: '\x1b[90mTRACE\x1b[0m',   // Gray
        };
        
        return colors[level] || level.toUpperCase().padEnd(5);
    }
    
    /**
     * Writes a message to the console
     * 
     * @param level - The log level
     * @param message - The formatted message
     */
    private writeToConsole(level: LogLevel, message: string): void {
        const stream = level === LogLevel.ERROR ? process.stderr : process.stdout;
        stream.write(`${message}\n`);
    }
    
    /**
     * Writes a message to the file
     * 
     * @param message - The formatted message
     */
    private writeToFile(message: string): void {
        if (this.fileStream) {
            this.fileStream.write(`${message}\n`);
        }
    }
    
    /**
     * Logs an error message
     * 
     * @param message - The error message
     * @param error - Optional Error object
     * @param metadata - Optional metadata
     */
    public error(message: string, error?: Error, metadata?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, {
            ...metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
            } : undefined,
        });
    }
    
    /**
     * Logs a warning message
     * 
     * @param message - The warning message
     * @param metadata - Optional metadata
     */
    public warn(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, metadata);
    }
    
    /**
     * Logs an info message
     * 
     * @param message - The info message
     * @param metadata - Optional metadata
     */
    public info(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, metadata);
    }
    
    /**
     * Logs a debug message
     * 
     * @param message - The debug message
     * @param metadata - Optional metadata
     */
    public debug(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, metadata);
    }
    
    /**
     * Logs a trace message
     * 
     * @param message - The trace message
     * @param metadata - Optional metadata
     */
    public trace(message: string, metadata?: Record<string, any>): void {
        this.log(LogLevel.TRACE, message, metadata);
    }
    
    /**
     * Logs a message with a specific context
     * 
     * @param context - The context to use for this log
     * @param level - The log level
     * @param message - The message to log
     * @param metadata - Optional metadata
     */
    public withContext(context: string, level: LogLevel, message: string, metadata?: Record<string, any>): void {
        const originalContext = this.context;
        this.context = context;
        this.log(level, message, metadata);
        this.context = originalContext;
    }
    
    /**
     * Creates a child logger with a sub-context
     * 
     * @param subContext - The sub-context to append
     */
    public child(subContext: string): Logger {
        return new Logger(`${this.context}:${subContext}`, this.config);
    }
    
    /**
     * Closes the logger and cleans up resources
     */
    public close(): void {
        if (this.fileStream) {
            this.fileStream.close();
            this.fileStream = null;
        }
    }
    
    /**
     * Rotates log files if they exceed the maximum size
     */
    public rotateLogs(): void {
        if (!this.config.file || !this.fileStream) return;
        
        try {
            const stats = fs.statSync(this.config.file);
            if (stats.size >= (this.config.maxFileSize || 10 * 1024 * 1024)) {
                this.rotateLogFile();
            }
        } catch (error) {
            // File doesn't exist yet or other error
        }
    }
    
    /**
     * Rotates a single log file
     */
    private rotateLogFile(): void {
        if (!this.config.file) return;
        
        try {
            // Close current stream
            if (this.fileStream) {
                this.fileStream.close();
                this.fileStream = null;
            }
            
            // Generate rotated filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseName = path.basename(this.config.file, '.log');
            const ext = path.extname(this.config.file) || '.log';
            const dir = path.dirname(this.config.file);
            
            // Find the next available rotation number
            let rotationNumber = 0;
            let rotatedPath: string;
            
            do {
                rotationNumber++;
                rotatedPath = path.join(dir, `${baseName}.${timestamp}.${rotationNumber}${ext}`);
            } while (fs.existsSync(rotatedPath) && rotationNumber < 100);
            
            // Rename current file
            fs.renameSync(this.config.file, rotatedPath);
            
            // Clean up old rotated files
            this.cleanupOldLogs(dir, baseName, ext);
            
            // Reopen the file stream
            this.initializeFileLogging();
        } catch (error) {
            console.error(`Failed to rotate log file: ${error}`);
        }
    }
    
    /**
     * Cleans up old rotated log files
     * 
     * @param dir - The directory containing log files
     * @param baseName - The base filename without extension
     * @param ext - The file extension
     */
    private cleanupOldLogs(dir: string, baseName: string, ext: string): void {
        if (!this.config.maxFiles) return;
        
        try {
            const files = fs.readdirSync(dir);
            const logFiles = files
                .filter(file => file.startsWith(baseName) && file.endsWith(ext))
                .sort()
                .reverse();
            
            // Keep only the most recent maxFiles
            while (logFiles.length > this.config.maxFiles) {
                const oldFile = logFiles.pop();
                if (oldFile) {
                    fs.unlinkSync(path.join(dir, oldFile));
                }
            }
        } catch (error) {
            console.error(`Failed to cleanup old log files: ${error}`);
        }
    }
}

/**
 * Creates a logger with default configuration
 * 
 * @param context - The logging context
 */
export function createLogger(context: string): Logger {
    return Logger.getLogger(context);
}

/**
 * Creates a logger with custom configuration
 * 
 * @param context - The logging context
 * @param config - Logger configuration
 */
export function createLoggerWithConfig(context: string, config: Partial<ILoggerConfig>): Logger {
    return Logger.getLogger(context, config);
}
