/**
 * Retry Queue
 * 
 * Manages a queue of messages/operations to retry with exponential backoff.
 * Handles both Matrix and Foundry message retries.
 */

import { Logger } from './Logger';
import { ErrorHandler, ErrorType } from './ErrorHandler';

/**
 * Queued item for retry
 */
export interface IQueuedItem<T = any> {
    id: string;
    type: 'matrix' | 'foundry' | 'generic';
    action: string;
    data: T;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
    lastError?: Error;
    context?: Record<string, any>;
}

/**
 * Queue statistics
 */
export interface IQueueStats {
    size: number;
    byType: Record<string, number>;
    byAction: Record<string, number>;
    oldestItemAge?: number;
    newestItemAge?: number;
}

/**
 * Retry queue configuration
 */
export interface IRetryQueueConfig {
    maxSize: number;
    defaultMaxRetries: number;
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
    jitter: number;
    retryOnFailure: boolean;
}

/**
 * Retry result
 */
export interface IRetryResult {
    success: boolean;
    item: IQueuedItem;
    error?: Error;
    retryCount: number;
}

/**
 * Action handler type
 */
export type ActionHandler<T = any> = (item: IQueuedItem<T>) => Promise<boolean>;

/**
 * RetryQueue class
 * 
 * Manages a queue of items to retry with:
 * - Exponential backoff
 * - Maximum retry limits
 * - Priority handling
 * - Statistics tracking
 */
export class RetryQueue {
    private logger: Logger;
    private config: IRetryQueueConfig;
    private errorHandler: ErrorHandler | null = null;
    
    // Queue storage
    private queue: IQueuedItem[] = [];
    
    // Action handlers
    private actionHandlers: Map<string, ActionHandler> = new Map();
    
    // Processing state
    private isProcessing: boolean = false;
    private processingItem: IQueuedItem | null = null;
    private processingTimeout: NodeJS.Timeout | null = null;
    
    // Statistics
    private stats: {
        totalAdded: number;
        totalProcessed: number;
        totalSuccess: number;
        totalFailed: number;
        totalRetries: number;
    };
    
    // Callbacks
    private onItemAdded: ((item: IQueuedItem) => void) | null = null;
    private onItemProcessed: ((result: IRetryResult) => void) | null = null;
    private onQueueEmpty: (() => void) | null = null;
    
    /**
     * Creates a new RetryQueue instance
     * 
     * @param config - Retry queue configuration
     * @param errorHandler - Optional error handler for error tracking
     */
    constructor(config?: Partial<IRetryQueueConfig>, errorHandler?: ErrorHandler) {
        this.logger = new Logger('RetryQueue');
        
        this.config = {
            maxSize: 1000,
            defaultMaxRetries: 5,
            initialDelay: 1000,
            maxDelay: 30000,
            multiplier: 2,
            jitter: 0.5,
            retryOnFailure: true,
            ...config,
        };
        
        this.errorHandler = errorHandler || null;
        
        this.stats = {
            totalAdded: 0,
            totalProcessed: 0,
            totalSuccess: 0,
            totalFailed: 0,
            totalRetries: 0,
        };
    }
    
    /**
     * Registers an action handler
     * 
     * @param action - The action name
     * @param handler - The handler function
     */
    public registerActionHandler(action: string, handler: ActionHandler): void {
        this.actionHandlers.set(action, handler);
        this.logger.info(`Registered action handler for: ${action}`);
    }
    
    /**
     * Unregisters an action handler
     * 
     * @param action - The action name
     */
    public unregisterActionHandler(action: string): void {
        this.actionHandlers.delete(action);
        this.logger.info(`Unregistered action handler for: ${action}`);
    }
    
    /**
     * Adds an item to the queue
     * 
     * @param item - The item to add
     */
    public addItem(item: IQueuedItem): boolean {
        // Check if queue is full
        if (this.queue.length >= this.config.maxSize) {
            this.logger.error('Queue is full, cannot add item:', item);
            return false;
        }
        
        // Add to queue
        this.queue.push(item);
        this.stats.totalAdded++;
        
        this.logger.debug(`Added item to queue: ${item.id} (type: ${item.type}, action: ${item.action})`);
        
        // Trigger callback
        if (this.onItemAdded) {
            this.onItemAdded(item);
        }
        
        // Start processing if not already
        if (!this.isProcessing) {
            this.processQueue();
        }
        
        return true;
    }
    
    /**
     * Adds a Matrix message to the queue
     * 
     * @param roomId - The Matrix room ID
     * @param content - The message content
     * @param context - Additional context
     */
    public addMatrixMessage(
        roomId: string,
        content: any,
        context: Record<string, any> = {}
    ): boolean {
        const item: IQueuedItem = {
            id: `matrix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'matrix',
            action: 'sendMessage',
            data: { roomId, content },
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: this.config.defaultMaxRetries,
            context,
        };
        
        return this.addItem(item);
    }
    
    /**
     * Adds a Foundry message to the queue
     * 
     * @param worldId - The Foundry world ID
     * @param content - The message content
     * @param context - Additional context
     */
    public addFoundryMessage(
        worldId: string,
        content: any,
        context: Record<string, any> = {}
    ): boolean {
        const item: IQueuedItem = {
            id: `foundry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'foundry',
            action: 'sendMessage',
            data: { worldId, content },
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: this.config.defaultMaxRetries,
            context,
        };
        
        return this.addItem(item);
    }
    
    /**
     * Adds a generic action to the queue
     * 
     * @param action - The action name
     * @param data - The action data
     * @param context - Additional context
     * @param maxRetries - Maximum retry attempts
     */
    public addAction(
        action: string,
        data: any,
        context: Record<string, any> = {},
        maxRetries: number = this.config.defaultMaxRetries
    ): boolean {
        const item: IQueuedItem = {
            id: `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'generic',
            action,
            data,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries,
            context,
        };
        
        return this.addItem(item);
    }
    
    /**
     * Processes the queue
     */
    private processQueue(): void {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            this.processingItem = null;
            
            // Trigger callback
            if (this.onQueueEmpty) {
                this.onQueueEmpty();
            }
            
            return;
        }
        
        if (this.isProcessing) {
            return;
        }
        
        this.isProcessing = true;
        this.processingItem = this.queue.shift()!;
        
        this.processItem(this.processingItem);
    }
    
    /**
     * Processes a single item
     * 
     * @param item - The item to process
     */
    private async processItem(item: IQueuedItem): Promise<void> {
        try {
            // Get the handler for this action
            const handler = this.actionHandlers.get(item.action);
            
            if (!handler) {
                throw new Error(`No handler registered for action: ${item.action}`);
            }
            
            // Process the item
            const success = await handler(item);
            
            if (success) {
                // Success
                this.stats.totalProcessed++;
                this.stats.totalSuccess++;
                
                this.logger.info(`Processed item successfully: ${item.id}`);
                
                // Trigger callback
                if (this.onItemProcessed) {
                    this.onItemProcessed({
                        success: true,
                        item,
                        retryCount: item.retryCount,
                    });
                }
                
                // Process next item
                this.isProcessing = false;
                this.processingItem = null;
                this.processQueue();
                
            } else {
                // Failure - retry if configured
                await this.handleFailure(item, new Error('Action handler returned false'));
            }
            
        } catch (error) {
            // Error - retry if configured
            await this.handleFailure(item, error as Error);
        }
    }
    
    /**
     * Handles a processing failure
     * 
     * @param item - The item that failed
     * @param error - The error that occurred
     */
    private async handleFailure(item: IQueuedItem, error: Error): Promise<void> {
        item.lastError = error;
        item.retryCount++;
        this.stats.totalRetries++;
        
        // Check if we should retry
        if (item.retryCount >= item.maxRetries) {
            // Max retries exceeded
            this.stats.totalProcessed++;
            this.stats.totalFailed++;
            
            this.logger.error(`Max retries (${item.maxRetries}) exceeded for item: ${item.id}`, {
                error,
                item,
            });
            
            // Report to error handler
            if (this.errorHandler) {
                const errorType = item.type === 'matrix' 
                    ? ErrorType.BRIDGE_MESSAGE 
                    : item.type === 'foundry' 
                        ? ErrorType.BRIDGE_MESSAGE 
                        : ErrorType.UNKNOWN;
                
                this.errorHandler.handleError(error, item.context || {}, errorType);
            }
            
            // Trigger callback
            if (this.onItemProcessed) {
                this.onItemProcessed({
                    success: false,
                    item,
                    error,
                    retryCount: item.retryCount,
                });
            }
            
            // Process next item
            this.isProcessing = false;
            this.processingItem = null;
            this.processQueue();
            
            return;
        }
        
        // Calculate retry delay
        const delay = this.calculateRetryDelay(item);
        
        this.logger.warn(`Retrying item in ${delay}ms (attempt ${item.retryCount + 1}): ${item.id}`);
        
        // Set timeout for retry
        this.processingTimeout = setTimeout(() => {
            // Re-queue the item at the front
            this.queue.unshift(item);
            this.isProcessing = false;
            this.processingItem = null;
            this.processQueue();
        }, delay);
    }
    
    /**
     * Calculates retry delay with exponential backoff
     * 
     * @param item - The item to calculate delay for
     */
    private calculateRetryDelay(item: IQueuedItem): number {
        const baseDelay = this.config.initialDelay;
        const maxDelay = this.config.maxDelay;
        const multiplier = this.config.multiplier;
        const jitter = this.config.jitter;
        
        // Calculate exponential delay
        const exponent = Math.min(item.retryCount, 5);
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
     * Sets the callback for when an item is added
     * 
     * @param callback - The callback function
     */
    public onAdd(callback: (item: IQueuedItem) => void): void {
        this.onItemAdded = callback;
    }
    
    /**
     * Sets the callback for when an item is processed
     * 
     * @param callback - The callback function
     */
    public onProcess(callback: (result: IRetryResult) => void): void {
        this.onItemProcessed = callback;
    }
    
    /**
     * Sets the callback for when the queue is empty
     * 
     * @param callback - The callback function
     */
    public onEmpty(callback: () => void): void {
        this.onQueueEmpty = callback;
    }
    
    /**
     * Removes an item from the queue
     * 
     * @param id - The item ID to remove
     */
    public removeItem(id: string): boolean {
        const index = this.queue.findIndex(item => item.id === id);
        
        if (index > -1) {
            this.queue.splice(index, 1);
            this.logger.info(`Removed item from queue: ${id}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Removes all items of a specific type
     * 
     * @param type - The type to remove
     */
    public removeItemsByType(type: string): number {
        const initialLength = this.queue.length;
        this.queue = this.queue.filter(item => item.type !== type);
        const removed = initialLength - this.queue.length;
        
        this.logger.info(`Removed ${removed} items of type: ${type}`);
        return removed;
    }
    
    /**
     * Removes all items of a specific action
     * 
     * @param action - The action to remove
     */
    public removeItemsByAction(action: string): number {
        const initialLength = this.queue.length;
        this.queue = this.queue.filter(item => item.action !== action);
        const removed = initialLength - this.queue.length;
        
        this.logger.info(`Removed ${removed} items of action: ${action}`);
        return removed;
    }
    
    /**
     * Clears all items from the queue
     */
    public clearQueue(): void {
        this.queue = [];
        this.logger.info('Cleared retry queue');
    }
    
    /**
     * Gets the current queue
     */
    public getQueue(): IQueuedItem[] {
        return [...this.queue];
    }
    
    /**
     * Gets the current queue size
     */
    public getSize(): number {
        return this.queue.length;
    }
    
    /**
     * Checks if the queue is empty
     */
    public isEmpty(): boolean {
        return this.queue.length === 0;
    }
    
    /**
     * Checks if the queue is full
     */
    public isFull(): boolean {
        return this.queue.length >= this.config.maxSize;
    }
    
    /**
     * Gets the current processing item
     */
    public getProcessingItem(): IQueuedItem | null {
        return this.processingItem;
    }
    
    /**
     * Gets queue statistics
     */
    public getStats(): IQueueStats {
        const byType: Record<string, number> = {};
        const byAction: Record<string, number> = {};
        
        const now = Date.now();
        let oldestAge: number | undefined;
        let newestAge: number | undefined;
        
        for (const item of this.queue) {
            // Count by type
            byType[item.type] = (byType[item.type] || 0) + 1;
            
            // Count by action
            byAction[item.action] = (byAction[item.action] || 0) + 1;
            
            // Track ages
            const age = now - item.timestamp;
            if (oldestAge === undefined || age > oldestAge) {
                oldestAge = age;
            }
            if (newestAge === undefined || age < newestAge) {
                newestAge = age;
            }
        }
        
        return {
            size: this.queue.length,
            byType,
            byAction,
            oldestItemAge: oldestAge,
            newestItemAge: newestAge,
        };
    }
    
    /**
     * Gets full statistics including processing stats
     */
    public getFullStats(): object {
        return {
            queue: this.getStats(),
            processing: {
                isProcessing: this.isProcessing,
                currentItem: this.processingItem?.id || null,
            },
            totals: this.stats,
            config: this.config,
        };
    }
    
    /**
     * Resets queue statistics
     */
    public resetStats(): void {
        this.stats = {
            totalAdded: 0,
            totalProcessed: 0,
            totalSuccess: 0,
            totalFailed: 0,
            totalRetries: 0,
        };
    }
    
    /**
     * Gets the retry queue configuration
     */
    public getConfig(): IRetryQueueConfig {
        return { ...this.config };
    }
    
    /**
     * Updates the retry queue configuration
     * 
     * @param config - The new configuration
     */
    public updateConfig(config: Partial<IRetryQueueConfig>): void {
        this.config = { ...this.config, ...config };
        this.logger.info('Updated retry queue configuration:', config);
    }
    
    /**
     * Pauses queue processing
     */
    public pause(): void {
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
        }
        
        this.isProcessing = true;
        this.logger.info('Paused retry queue processing');
    }
    
    /**
     * Resumes queue processing
     */
    public resume(): void {
        if (!this.isProcessing) {
            return;
        }
        
        this.isProcessing = false;
        this.logger.info('Resumed retry queue processing');
        
        // Process queue if there are items
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }
    
    /**
     * Cleans up resources
     */
    public destroy(): void {
        // Clear processing timeout
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
            this.processingTimeout = null;
        }
        
        // Clear queue
        this.clearQueue();
        
        // Reset state
        this.isProcessing = false;
        this.processingItem = null;
        
        this.logger.info('Destroyed retry queue');
    }
}
