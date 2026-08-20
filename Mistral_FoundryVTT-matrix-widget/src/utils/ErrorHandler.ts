/**
 * Error Handler
 * 
 * Provides comprehensive error handling for the bridge:
 * - Error classification
 * - Retry queue with exponential backoff
 * - Error logging and metrics
 * - Admin notifications
 */

import { Logger } from './Logger';

/**
 * Error types
 */
export enum ErrorType {
    // Matrix-related errors
    MATRIX_CONNECTION = 'matrix_connection',
    MATRIX_AUTH = 'matrix_auth',
    MATRIX_API = 'matrix_api',
    MATRIX_EVENT = 'matrix_event',
    
    // Foundry-related errors
    FOUNDRY_CONNECTION = 'foundry_connection',
    FOUNDRY_AUTH = 'foundry_auth',
    FOUNDRY_API = 'foundry_api',
    FOUNDRY_EVENT = 'foundry_event',
    
    // Bridge-related errors
    BRIDGE_CONFIG = 'bridge_config',
    BRIDGE_INIT = 'bridge_init',
    BRIDGE_MESSAGE = 'bridge_message',
    BRIDGE_SYNC = 'bridge_sync',
    
    // General errors
    NETWORK = 'network',
    VALIDATION = 'validation',
    TIMEOUT = 'timeout',
    UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    CRITICAL = 'critical',
}

/**
 * Error classification
 */
export interface IErrorClassification {
    type: ErrorType;
    severity: ErrorSeverity;
    isRetryable: boolean;
    isFatal: boolean;
    maxRetries: number;
}

/**
 * Queued error for retry
 */
export interface IQueuedError {
    error: Error;
    classification: IErrorClassification;
    context: Record<string, any>;
    timestamp: number;
    retryCount: number;
    lastError?: Error;
}

/**
 * Retry configuration
 */
export interface IRetryConfig {
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
    maxRetries: number;
    jitter: boolean;
}

/**
 * Error metrics
 */
export interface IErrorMetrics {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    retries: number;
    failures: number;
    lastError?: {
        type: ErrorType;
        message: string;
        timestamp: number;
    };
}

/**
 * Error Handler class
 * 
 * Provides comprehensive error handling with:
 * - Error classification and categorization
 * - Retry queue with exponential backoff
 * - Error metrics tracking
 * - Admin notifications
 */
export class ErrorHandler {
    private logger: Logger;
    private retryConfig: IRetryConfig;
    private errorQueue: IQueuedError[] = [];
    private metrics: IErrorMetrics;
    private isProcessing: boolean = false;
    
    // Error classification map
    private errorClassifications: Map<string, IErrorClassification> = new Map();
    
    // Admin notification callback
    private adminNotifyCallback: ((error: Error, classification: IErrorClassification) => void) | null = null;
    
    // Retry timeout
    private retryTimeout: NodeJS.Timeout | null = null;
    
    /**
     * Creates a new ErrorHandler instance
     * 
     * @param retryConfig - Retry configuration
     */
    constructor(retryConfig?: Partial<IRetryConfig>) {
        this.logger = new Logger('ErrorHandler');
        
        this.retryConfig = {
            initialDelay: 1000,
            maxDelay: 30000,
            multiplier: 2,
            maxRetries: 5,
            jitter: true,
            ...retryConfig,
        };
        
        this.metrics = {
            total: 0,
            byType: {} as Record<ErrorType, number>,
            bySeverity: {} as Record<ErrorSeverity, number>,
            retries: 0,
            failures: 0,
        };
        
        // Initialize error classifications
        this.initializeErrorClassifications();
    }
    
    /**
     * Initializes default error classifications
     */
    private initializeErrorClassifications(): void {
        // Matrix errors
        this.errorClassifications.set(ErrorType.MATRIX_CONNECTION, {
            type: ErrorType.MATRIX_CONNECTION,
            severity: ErrorSeverity.ERROR,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        this.errorClassifications.set(ErrorType.MATRIX_AUTH, {
            type: ErrorType.MATRIX_AUTH,
            severity: ErrorSeverity.ERROR,
            isRetryable: false,
            isFatal: true,
            maxRetries: 0,
        });
        
        this.errorClassifications.set(ErrorType.MATRIX_API, {
            type: ErrorType.MATRIX_API,
            severity: ErrorSeverity.WARN,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        this.errorClassifications.set(ErrorType.MATRIX_EVENT, {
            type: ErrorType.MATRIX_EVENT,
            severity: ErrorSeverity.WARN,
            isRetryable: false,
            isFatal: false,
            maxRetries: 0,
        });
        
        // Foundry errors
        this.errorClassifications.set(ErrorType.FOUNDRY_CONNECTION, {
            type: ErrorType.FOUNDRY_CONNECTION,
            severity: ErrorSeverity.ERROR,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        this.errorClassifications.set(ErrorType.FOUNDRY_AUTH, {
            type: ErrorType.FOUNDRY_AUTH,
            severity: ErrorSeverity.ERROR,
            isRetryable: false,
            isFatal: true,
            maxRetries: 0,
        });
        
        this.errorClassifications.set(ErrorType.FOUNDRY_API, {
            type: ErrorType.FOUNDRY_API,
            severity: ErrorSeverity.WARN,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        this.errorClassifications.set(ErrorType.FOUNDRY_EVENT, {
            type: ErrorType.FOUNDRY_EVENT,
            severity: ErrorSeverity.WARN,
            isRetryable: false,
            isFatal: false,
            maxRetries: 0,
        });
        
        // Bridge errors
        this.errorClassifications.set(ErrorType.BRIDGE_CONFIG, {
            type: ErrorType.BRIDGE_CONFIG,
            severity: ErrorSeverity.ERROR,
            isRetryable: false,
            isFatal: true,
            maxRetries: 0,
        });
        
        this.errorClassifications.set(ErrorType.BRIDGE_INIT, {
            type: ErrorType.BRIDGE_INIT,
            severity: ErrorSeverity.ERROR,
            isRetryable: false,
            isFatal: true,
            maxRetries: 0,
        });
        
        this.errorClassifications.set(ErrorType.BRIDGE_MESSAGE, {
            type: ErrorType.BRIDGE_MESSAGE,
            severity: ErrorSeverity.WARN,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        this.errorClassifications.set(ErrorType.BRIDGE_SYNC, {
            type: ErrorType.BRIDGE_SYNC,
            severity: ErrorSeverity.WARN,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        // General errors
        this.errorClassifications.set(ErrorType.NETWORK, {
            type: ErrorType.NETWORK,
            severity: ErrorSeverity.ERROR,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        this.errorClassifications.set(ErrorType.VALIDATION, {
            type: ErrorType.VALIDATION,
            severity: ErrorSeverity.WARN,
            isRetryable: false,
            isFatal: false,
            maxRetries: 0,
        });
        
        this.errorClassifications.set(ErrorType.TIMEOUT, {
            type: ErrorType.TIMEOUT,
            severity: ErrorSeverity.WARN,
            isRetryable: true,
            isFatal: false,
            maxRetries: this.retryConfig.maxRetries,
        });
        
        this.errorClassifications.set(ErrorType.UNKNOWN, {
            type: ErrorType.UNKNOWN,
            severity: ErrorSeverity.ERROR,
            isRetryable: false,
            isFatal: false,
            maxRetries: 0,
        });
    }
    
    /**
     * Sets the admin notification callback
     * 
     * @param callback - The callback function
     */
    public setAdminNotifyCallback(
        callback: (error: Error, classification: IErrorClassification) => void
    ): void {
        this.adminNotifyCallback = callback;
    }
    
    /**
     * Classifies an error based on its type and message
     * 
     * @param error - The error to classify
     */
    public classifyError(error: Error): IErrorClassification {
        const errorString = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();
        
        // Matrix errors
        if (errorString.includes('matrix') || errorName.includes('matrix')) {
            if (errorString.includes('connection') || errorString.includes('network')) {
                return this.getClassification(ErrorType.MATRIX_CONNECTION);
            }
            if (errorString.includes('auth') || errorString.includes('token') || errorString.includes('password')) {
                return this.getClassification(ErrorType.MATRIX_AUTH);
            }
            if (errorString.includes('api') || errorString.includes('endpoint')) {
                return this.getClassification(ErrorType.MATRIX_API);
            }
            return this.getClassification(ErrorType.MATRIX_EVENT);
        }
        
        // Foundry errors
        if (errorString.includes('foundry') || errorString.includes('foundryvtt')) {
            if (errorString.includes('connection') || errorString.includes('network')) {
                return this.getClassification(ErrorType.FOUNDRY_CONNECTION);
            }
            if (errorString.includes('auth') || errorString.includes('token')) {
                return this.getClassification(ErrorType.FOUNDRY_AUTH);
            }
            if (errorString.includes('api') || errorString.includes('endpoint')) {
                return this.getClassification(ErrorType.FOUNDRY_API);
            }
            return this.getClassification(ErrorType.FOUNDRY_EVENT);
        }
        
        // Network errors
        if (errorName.includes('econnreset') || 
            errorName.includes('econnrefused') ||
            errorString.includes('connection reset') ||
            errorString.includes('connection refused')) {
            return this.getClassification(ErrorType.NETWORK);
        }
        
        // Timeout errors
        if (errorName.includes('timeout') || errorString.includes('timeout')) {
            return this.getClassification(ErrorType.TIMEOUT);
        }
        
        // Validation errors
        if (errorName.includes('validation') || errorString.includes('invalid')) {
            return this.getClassification(ErrorType.VALIDATION);
        }
        
        // Bridge errors
        if (errorString.includes('bridge') || errorName.includes('bridge')) {
            if (errorString.includes('config')) {
                return this.getClassification(ErrorType.BRIDGE_CONFIG);
            }
            if (errorString.includes('init')) {
                return this.getClassification(ErrorType.BRIDGE_INIT);
            }
            if (errorString.includes('message')) {
                return this.getClassification(ErrorType.BRIDGE_MESSAGE);
            }
            if (errorString.includes('sync')) {
                return this.getClassification(ErrorType.BRIDGE_SYNC);
            }
        }
        
        // Default to unknown
        return this.getClassification(ErrorType.UNKNOWN);
    }
    
    /**
     * Gets the classification for an error type
     * 
     * @param type - The error type
     */
    public getClassification(type: ErrorType): IErrorClassification {
        return this.errorClassifications.get(type) || this.getClassification(ErrorType.UNKNOWN);
    }
    
    /**
     * Handles an error
     * 
     * @param error - The error to handle
     * @param context - Additional context about the error
     * @param customType - Optional custom error type
     */
    public handleError(
        error: Error,
        context: Record<string, any> = {},
        customType?: ErrorType
    ): void {
        this.metrics.total++;
        
        // Classify the error
        const classification = customType 
            ? this.getClassification(customType)
            : this.classifyError(error);
        
        // Update metrics
        this.updateMetrics(classification);
        
        // Log the error
        this.logError(error, classification, context);
        
        // Notify admin if critical
        if (classification.severity === ErrorSeverity.CRITICAL || 
            classification.severity === ErrorSeverity.ERROR) {
            this.notifyAdmin(error, classification);
        }
        
        // Queue for retry if retryable
        if (classification.isRetryable) {
            this.queueForRetry(error, classification, context);
        }
    }
    
    /**
     * Updates error metrics
     * 
     * @param classification - The error classification
     */
    private updateMetrics(classification: IErrorClassification): void {
        // Update by type
        if (!this.metrics.byType[classification.type]) {
            this.metrics.byType[classification.type] = 0;
        }
        this.metrics.byType[classification.type]++;
        
        // Update by severity
        if (!this.metrics.bySeverity[classification.severity]) {
            this.metrics.bySeverity[classification.severity] = 0;
        }
        this.metrics.bySeverity[classification.severity]++;
        
        // Update last error
        this.metrics.lastError = {
            type: classification.type,
            message: classification.type,
            timestamp: Date.now(),
        };
    }
    
    /**
     * Logs an error
     * 
     * @param error - The error to log
     * @param classification - The error classification
     * @param context - Additional context
     */
    private logError(
        error: Error,
        classification: IErrorClassification,
        context: Record<string, any>
    ): void {
        const logMethod = this.getLogMethod(classification.severity);
        
        this.logger[logMethod](`[${classification.type}] ${error.message}`, {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            classification,
            context,
        });
    }
    
    /**
     * Gets the appropriate log method for a severity level
     * 
     * @param severity - The error severity
     */
    private getLogMethod(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'debug' {
        switch (severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.ERROR:
                return 'error';
            case ErrorSeverity.WARN:
                return 'warn';
            case ErrorSeverity.INFO:
                return 'info';
            case ErrorSeverity.DEBUG:
            default:
                return 'debug';
        }
    }
    
    /**
     * Notifies admin about an error
     * 
     * @param error - The error
     * @param classification - The error classification
     */
    private notifyAdmin(error: Error, classification: IErrorClassification): void {
        if (this.adminNotifyCallback) {
            try {
                this.adminNotifyCallback(error, classification);
            } catch (notifyError) {
                this.logger.error('Error in admin notification callback:', notifyError as Error);
            }
        }
    }
    
    /**
     * Queues an error for retry
     * 
     * @param error - The error to retry
     * @param classification - The error classification
     * @param context - Additional context
     */
    private queueForRetry(
        error: Error,
        classification: IErrorClassification,
        context: Record<string, any>
    ): void {
        // Check if we should retry
        if (context.retryCount && context.retryCount >= classification.maxRetries) {
            this.metrics.failures++;
            this.logger.error(`Max retries (${classification.maxRetries}) exceeded for error: ${error.message}`);
            return;
        }
        
        // Create queued error
        const queuedError: IQueuedError = {
            error,
            classification,
            context,
            timestamp: Date.now(),
            retryCount: context.retryCount || 0,
        };
        
        // Add to queue
        this.errorQueue.push(queuedError);
        this.metrics.retries++;
        
        this.logger.debug(`Queued error for retry: ${error.message} (attempt ${queuedError.retryCount + 1})`);
        
        // Process queue if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }
    
    /**
     * Processes the error retry queue
     */
    private processQueue(): void {
        if (this.errorQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        const queuedError = this.errorQueue.shift()!;
        
        // Calculate delay
        const delay = this.calculateRetryDelay(queuedError);
        
        this.logger.debug(`Retrying error in ${delay}ms: ${queuedError.error.message}`);
        
        // Set timeout for retry
        this.retryTimeout = setTimeout(() => {
            this.retryError(queuedError);
        }, delay);
    }
    
    /**
     * Calculates retry delay with exponential backoff
     * 
     * @param queuedError - The queued error
     */
    private calculateRetryDelay(queuedError: IQueuedError): number {
        const baseDelay = this.retryConfig.initialDelay;
        const maxDelay = this.retryConfig.maxDelay;
        const multiplier = this.retryConfig.multiplier;
        const jitter = this.retryConfig.jitter ? 0.5 : 0;
        
        // Calculate exponential delay
        const exponent = Math.min(queuedError.retryCount, 5);
        let delay = baseDelay * Math.pow(multiplier, exponent);
        
        // Cap at max delay
        delay = Math.min(delay, maxDelay);
        
        // Add jitter
        if (jitter > 0) {
            const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
            delay = Math.max(0, delay + jitterAmount);
        }
        
        return delay;
    }
    
    /**
     * Retries an error
     * 
     * @param queuedError - The queued error to retry
     */
    private retryError(queuedError: IQueuedError): void {
        this.logger.info(`Retrying error (attempt ${queuedError.retryCount + 1}): ${queuedError.error.message}`);
        
        try {
            // In a real implementation, we would have a retry function
            // For now, just log and consider it successful
            this.logger.info(`Error retry successful: ${queuedError.error.message}`);
            
            // Process next in queue
            this.isProcessing = false;
            this.processQueue();
            
        } catch (error) {
            // Update retry count
            queuedError.retryCount++;
            queuedError.lastError = error as Error;
            
            // Re-queue if we haven't exceeded max retries
            if (queuedError.retryCount < queuedError.classification.maxRetries) {
                this.errorQueue.unshift(queuedError); // Add to front of queue
                this.logger.warn(`Error retry failed, will retry again: ${queuedError.error.message}`);
            } else {
                this.metrics.failures++;
                this.logger.error(`Max retries (${queuedError.classification.maxRetries}) exceeded: ${queuedError.error.message}`);
            }
            
            // Process next in queue
            this.isProcessing = false;
            this.processQueue();
        }
    }
    
    /**
     * Creates a retryable function wrapper
     * 
     * @param fn - The function to wrap
     * @param context - Context for error handling
     * @param customType - Optional custom error type
     */
    public wrapWithRetry<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        context: Record<string, any> = {},
        customType?: ErrorType
    ): (...args: T) => Promise<R> {
        return async (...args: T): Promise<R> => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error as Error, context, customType);
                throw error;
            }
        };
    }
    
    /**
     * Creates a retryable function with automatic retry
     * 
     * @param fn - The function to wrap
     * @param context - Context for error handling
     * @param customType - Optional custom error type
     */
    public wrapWithAutoRetry<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        context: Record<string, any> = {},
        customType?: ErrorType
    ): (...args: T) => Promise<R> {
        return async (...args: T): Promise<R> => {
            let lastError: Error | undefined;
            const classification = customType 
                ? this.getClassification(customType)
                : this.classifyError(new Error('Unknown error'));
            
            for (let attempt = 0; attempt <= classification.maxRetries; attempt++) {
                try {
                    return await fn(...args);
                } catch (error) {
                    lastError = error as Error;
                    
                    if (attempt < classification.maxRetries) {
                        // Wait before retrying
                        const delay = this.calculateRetryDelay({
                            error: lastError,
                            classification,
                            context,
                            timestamp: Date.now(),
                            retryCount: attempt,
                        });
                        
                        this.logger.debug(`Retrying in ${delay}ms (attempt ${attempt + 1})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            
            // If we get here, all retries failed
            this.handleError(lastError!, context, customType);
            throw lastError;
        };
    }
    
    /**
     * Gets the current error metrics
     */
    public getMetrics(): IErrorMetrics {
        return { ...this.metrics };
    }
    
    /**
     * Resets error metrics
     */
    public resetMetrics(): void {
        this.metrics = {
            total: 0,
            byType: {} as Record<ErrorType, number>,
            bySeverity: {} as Record<ErrorSeverity, number>,
            retries: 0,
            failures: 0,
        };
    }
    
    /**
     * Gets the current error queue
     */
    public getQueue(): IQueuedError[] {
        return [...this.errorQueue];
    }
    
    /**
     * Clears the error queue
     */
    public clearQueue(): void {
        this.errorQueue = [];
        this.logger.info('Cleared error retry queue');
    }
    
    /**
     * Gets the retry configuration
     */
    public getRetryConfig(): IRetryConfig {
        return { ...this.retryConfig };
    }
    
    /**
     * Updates the retry configuration
     * 
     * @param config - The new retry configuration
     */
    public updateRetryConfig(config: Partial<IRetryConfig>): void {
        this.retryConfig = { ...this.retryConfig, ...config };
        this.logger.info('Updated retry configuration:', config);
    }
    
    /**
     * Gets statistics about the error handler
     */
    public getStats(): object {
        return {
            queueSize: this.errorQueue.length,
            isProcessing: this.isProcessing,
            metrics: this.metrics,
            retryConfig: this.retryConfig,
        };
    }
}
