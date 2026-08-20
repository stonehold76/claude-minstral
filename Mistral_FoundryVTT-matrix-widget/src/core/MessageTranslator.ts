/**
 * Message Translator
 * 
 * Handles bidirectional conversion between Matrix and FoundryVTT message formats.
 * Supports text, rich text, dice rolls, whispers, files, and special commands.
 */

import { Logger } from '../utils/Logger';
import { BridgeConfig } from './BridgeConfig';
import { MatrixEvent, MatrixMessageType, MatrixEventType } from '../models/MatrixEvent';
import { FoundryMessage } from '../foundry/FoundryClient';

/**
 * Message translation options
 */
export interface IMessageTranslationOptions {
    // Whether to preserve formatting
    preserveFormatting?: boolean;
    
    // Whether to convert mentions
    convertMentions?: boolean;
    
    // Whether to process dice rolls
    processDiceRolls?: boolean;
    
    // Whether to process whispers
    processWhispers?: boolean;
    
    // Whether to process file attachments
    processAttachments?: boolean;
    
    // Maximum message length
    maxLength?: number;
}

/**
 * Dice roll parsing result
 */
export interface DiceRollParseResult {
    isDiceRoll: boolean;
    expression?: string;
    command?: string;
    args?: string[];
}

/**
 * MessageTranslator class
 * 
 * Converts messages between Matrix and FoundryVTT formats:
 * - Text formatting (HTML, markdown, plain text)
 * - Dice roll parsing and execution
 * - Whisper/private message handling
 * - File/attachment handling
 * - Special command processing
 */
export class MessageTranslator {
    private logger: Logger;
    private config: BridgeConfig;
    private options: IMessageTranslationOptions;
    
    // Common patterns
    private diceRollPattern: RegExp;
    private whisperPattern: RegExp;
    private mentionPattern: RegExp;
    private oobPattern: RegExp;
    
    // Foundry-specific patterns
    private foundryDicePattern: RegExp;
    private foundryWhisperPattern: RegExp;
    
    /**
     * Creates a new MessageTranslator instance
     * 
     * @param config - Bridge configuration
     * @param options - Translation options
     */
    constructor(config: BridgeConfig, options?: IMessageTranslationOptions) {
        this.logger = new Logger('MessageTranslator');
        this.config = config;
        this.options = {
            preserveFormatting: true,
            convertMentions: true,
            processDiceRolls: config.isFeatureEnabled('dice_rolls'),
            processWhispers: config.isFeatureEnabled('whispers'),
            processAttachments: config.isFeatureEnabled('file_upload'),
            maxLength: config.getMaxMessageLength(),
            ...options,
        };
        
        // Initialize patterns
        this.initializePatterns();
    }
    
    /**
     * Initializes regular expression patterns
     */
    private initializePatterns(): void {
        // Dice roll patterns
        this.diceRollPattern = /^\/(roll|r|dice)\s+(.+)$/i;
        this.foundryDicePattern = /^\/(roll|r|dice)\s+(.+)$/i;
        
        // Whisper patterns
        this.whisperPattern = /^\/(w|whisper|pm|msg)\s+([^\s]+)\s+(.+)$/i;
        this.foundryWhisperPattern = /^\/w\s+([^\s]+)\s+(.+)$/i;
        
        // Mention patterns
        this.mentionPattern = /@([a-zA-Z0-9._-]+)/g;
        
        // Out-of-band message patterns
        this.oobPattern = /^\/(oob|outofband|emote)\s+(.+)$/i;
    }
    
    /**
     * Translates a Matrix event to a Foundry message
     * 
     * @param matrixEvent - The Matrix event to translate
     */
    public matrixToFoundry(matrixEvent: MatrixEvent): FoundryMessage | null {
        this.logger.debug('Translating Matrix event to Foundry:', {
            eventId: matrixEvent.eventId,
            type: matrixEvent.type,
        });
        
        try {
            // Handle different event types
            switch (matrixEvent.type) {
                case MatrixEventType.ROOM_MESSAGE:
                    return this.translateMatrixMessage(matrixEvent);
                
                case MatrixEventType.TYPING:
                    // Typing is handled separately
                    return null;
                
                case MatrixEventType.REACTION:
                    return this.translateMatrixReaction(matrixEvent);
                
                default:
                    this.logger.warn(`Unhandled Matrix event type: ${matrixEvent.type}`);
                    return null;
            }
        } catch (error) {
            this.logger.error('Error translating Matrix event:', error as Error);
            return null;
        }
    }
    
    /**
     * Translates a Matrix message event to a Foundry message
     * 
     * @param matrixEvent - The Matrix message event
     */
    private translateMatrixMessage(matrixEvent: MatrixEvent): FoundryMessage | null {
        const content = matrixEvent.content || {};
        const msgtype = content.msgtype || MatrixMessageType.TEXT;
        
        // Get the message body
        let body = content.body || '';
        let formattedBody = content.formatted_body || content.body || '';
        
        // Truncate if too long
        if (this.options.maxLength && body.length > this.options.maxLength) {
            body = body.substring(0, this.options.maxLength);
            formattedBody = formattedBody.substring(0, this.options.maxLength);
            this.logger.warn(`Message truncated from ${content.body?.length || 0} to ${this.options.maxLength} characters`);
        }
        
        // Check for special commands
        const diceResult = this.parseDiceRoll(body);
        const whisperResult = this.parseWhisper(body);
        const oobResult = this.parseOOB(body);
        
        // Determine message type
        let type: 'chat' | 'whisper' | 'dice' | 'oob' = 'chat';
        let targetUser: string | undefined;
        let processedContent = body;
        
        if (diceResult.isDiceRoll && this.options.processDiceRolls) {
            type = 'dice';
            // Keep the original dice command
            processedContent = diceResult.command || body;
        } else if (whisperResult.isWhisper && this.options.processWhispers) {
            type = 'whisper';
            targetUser = whisperResult.targetUser;
            processedContent = whisperResult.message;
        } else if (oobResult.isOOB) {
            type = 'oob';
            processedContent = oobResult.content;
        }
        
        // Convert mentions if enabled
        if (this.options.convertMentions) {
            processedContent = this.convertMatrixMentions(processedContent);
            formattedBody = this.convertMatrixMentions(formattedBody);
        }
        
        // Convert formatting if enabled
        if (this.options.preserveFormatting) {
            formattedBody = this.convertMatrixFormatting(formattedBody);
        } else {
            formattedBody = processedContent;
        }
        
        // Build Foundry message
        const foundryMessage: FoundryMessage = {
            worldId: matrixEvent.roomId, // Will be mapped to Foundry world
            sender: matrixEvent.sender,
            senderDisplayName: matrixEvent.senderDisplayName,
            content: processedContent,
            formattedContent: formattedBody,
            timestamp: matrixEvent.timestamp,
            type,
            targetUser,
            isGM: false, // Will be determined by user mapping
            raw: matrixEvent.rawEvent,
        };
        
        this.logger.info(`Translated Matrix message ${matrixEvent.eventId} to Foundry`);
        return foundryMessage;
    }
    
    /**
     * Translates a Matrix reaction to a Foundry reaction
     * 
     * @param matrixEvent - The Matrix reaction event
     */
    private translateMatrixReaction(matrixEvent: MatrixEvent): FoundryMessage | null {
        const content = matrixEvent.content || {};
        const relatesTo = content['m.relates_to'] || {};
        
        const reaction = relatesTo.key; // The emoji
        const targetEventId = relatesTo.event_id;
        
        if (!reaction || !targetEventId) {
            return null;
        }
        
        return {
            worldId: matrixEvent.roomId,
            sender: matrixEvent.sender,
            senderDisplayName: matrixEvent.senderDisplayName,
            content: reaction,
            type: 'emote',
            timestamp: matrixEvent.timestamp,
            targetEventId,
            raw: matrixEvent.rawEvent,
        };
    }
    
    /**
     * Translates a Foundry message to a Matrix event
     * 
     * @param foundryMessage - The Foundry message to translate
     */
    public foundryToMatrix(foundryMessage: FoundryMessage): MatrixEvent | null {
        this.logger.debug('Translating Foundry message to Matrix:', {
            id: foundryMessage.id,
            worldId: foundryMessage.worldId,
        });
        
        try {
            // Build Matrix event
            const matrixEvent: MatrixEvent = {
                eventId: foundryMessage.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                roomId: foundryMessage.worldId, // Will be mapped to Matrix room
                sender: foundryMessage.sender,
                senderDisplayName: foundryMessage.senderDisplayName || foundryMessage.sender,
                timestamp: foundryMessage.timestamp || Date.now(),
                type: MatrixEventType.ROOM_MESSAGE,
                content: this.buildMatrixContent(foundryMessage),
                formattedContent: foundryMessage.formattedContent || foundryMessage.content,
                rawEvent: foundryMessage.raw,
            };
            
            this.logger.info(`Translated Foundry message ${foundryMessage.id} to Matrix`);
            return matrixEvent;
        } catch (error) {
            this.logger.error('Error translating Foundry message:', error as Error);
            return null;
        }
    }
    
    /**
     * Builds Matrix message content from a Foundry message
     * 
     * @param foundryMessage - The Foundry message
     */
    private buildMatrixContent(foundryMessage: FoundryMessage): object {
        const content: any = {
            body: foundryMessage.content,
            msgtype: this.getMatrixMsgType(foundryMessage),
        };
        
        // Add formatted body if available
        if (foundryMessage.formattedContent) {
            content.formatted_body = foundryMessage.formattedContent;
            content.format = 'org.matrix.custom.html';
        }
        
        // Handle whispers
        if (foundryMessage.type === 'whisper' && foundryMessage.targetUser) {
            content['m.mentions'] = {
                user_ids: [foundryMessage.targetUser],
            };
        }
        
        // Handle dice rolls
        if (foundryMessage.type === 'dice') {
            content['com.foundryvtt.dice'] = {
                expression: foundryMessage.content,
            };
        }
        
        // Handle OOB messages
        if (foundryMessage.type === 'oob') {
            content['com.foundryvtt.oob'] = true;
        }
        
        return content;
    }
    
    /**
     * Gets the Matrix message type for a Foundry message
     * 
     * @param foundryMessage - The Foundry message
     */
    private getMatrixMsgType(foundryMessage: FoundryMessage): MatrixMessageType {
        switch (foundryMessage.type) {
            case 'whisper':
                return MatrixMessageType.TEXT;
            case 'dice':
                return MatrixMessageType.TEXT; // Could be custom type
            case 'oob':
                return MatrixMessageType.EMOTE;
            case 'emote':
                return MatrixMessageType.EMOTE;
            default:
                return MatrixMessageType.TEXT;
        }
    }
    
    /**
     * Parses a dice roll command
     * 
     * @param message - The message to parse
     */
    public parseDiceRoll(message: string): DiceRollParseResult {
        const match = this.diceRollPattern.exec(message);
        
        if (match) {
            return {
                isDiceRoll: true,
                command: match[0],
                expression: match[2],
                args: match[2].split(/\s+/),
            };
        }
        
        return { isDiceRoll: false };
    }
    
    /**
     * Parses a whisper command
     * 
     * @param message - The message to parse
     */
    public parseWhisper(message: string): { isWhisper: boolean; targetUser?: string; message?: string } {
        const match = this.whisperPattern.exec(message);
        
        if (match) {
            return {
                isWhisper: true,
                targetUser: match[2],
                message: match[3],
            };
        }
        
        return { isWhisper: false };
    }
    
    /**
     * Parses an out-of-band message
     * 
     * @param message - The message to parse
     */
    public parseOOB(message: string): { isOOB: boolean; content?: string } {
        const match = this.oobPattern.exec(message);
        
        if (match) {
            return {
                isOOB: true,
                content: match[2],
            };
        }
        
        return { isOOB: false };
    }
    
    /**
     * Converts Matrix mentions to Foundry format
     * 
     * @param message - The message with Matrix mentions
     */
    public convertMatrixMentions(message: string): string {
        if (!this.options.convertMentions) {
            return message;
        }
        
        return message.replace(this.mentionPattern, (match, userId) => {
            // In a real implementation, we would look up the Foundry user name
            // For now, just return the user ID
            return `@${userId}`;
        });
    }
    
    /**
     * Converts Foundry mentions to Matrix format
     * 
     * @param message - The message with Foundry mentions
     */
    public convertFoundryMentions(message: string): string {
        if (!this.options.convertMentions) {
            return message;
        }
        
        // Foundry mentions are typically just @username
        // We would need to look up the Matrix user ID
        return message;
    }
    
    /**
     * Converts Matrix HTML formatting to Foundry HTML
     * 
     * @param html - Matrix HTML
     */
    public convertMatrixFormatting(html: string): string {
        if (!this.options.preserveFormatting) {
            return html;
        }
        
        // Matrix uses org.matrix.custom.html which is a subset of HTML
        // Foundry also uses HTML, so we can mostly pass through
        // But we need to handle Matrix-specific elements
        
        // Remove Matrix-specific attributes
        let result = html
            .replace(/data-mx-msgtype="[^"]*"/g, '')
            .replace(/data-mx-mention="[^"]*"/g, '');
        
        // Convert Matrix mentions to Foundry format
        result = this.convertMatrixMentions(result);
        
        return result;
    }
    
    /**
     * Converts Foundry HTML formatting to Matrix HTML
     * 
     * @param html - Foundry HTML
     */
    public convertFoundryFormatting(html: string): string {
        if (!this.options.preserveFormatting) {
            return html;
        }
        
        // Foundry HTML is mostly standard, but we need to add Matrix-specific attributes
        let result = html;
        
        // Convert Foundry mentions to Matrix format
        result = this.convertFoundryMentions(result);
        
        return result;
    }
    
    /**
     * Processes a dice roll expression
     * 
     * @param expression - The dice roll expression
     */
    public processDiceRoll(expression: string): { result: string; total: number; rolls: number[][] } {
        // In a real implementation, this would parse and execute the dice roll
        // For now, return a mock result
        
        this.logger.debug(`Processing dice roll: ${expression}`);
        
        // Simple dice roll simulation
        const diceMatch = expression.match(/(\d+)d(\d+)/i);
        if (diceMatch) {
            const count = parseInt(diceMatch[1]) || 1;
            const sides = parseInt(diceMatch[2]) || 20;
            
            const rolls: number[] = [];
            let total = 0;
            
            for (let i = 0; i < count; i++) {
                const roll = Math.floor(Math.random() * sides) + 1;
                rolls.push(roll);
                total += roll;
            }
            
            return {
                result: `${expression} = ${rolls.join(' + ')} = **${total}**`,
                total,
                rolls: [rolls],
            };
        }
        
        // Default for unknown expressions
        return {
            result: `${expression} = ?`,
            total: 0,
            rolls: [],
        };
    }
    
    /**
     * Processes a file attachment
     * 
     * @param attachment - The file attachment
     */
    public async processAttachment(attachment: any): Promise<{ url: string; info: any } | null> {
        if (!this.options.processAttachments) {
            return null;
        }
        
        // In a real implementation, this would:
        // 1. Download the file from Matrix
        // 2. Upload to Foundry's media storage
        // 3. Return the Foundry URL
        
        this.logger.debug('Processing attachment:', attachment);
        
        // For now, just return null
        return null;
    }
    
    /**
     * Sanitizes HTML content
     * 
     * @param html - The HTML to sanitize
     */
    public sanitizeHtml(html: string): string {
        // In a real implementation, use a proper HTML sanitizer
        // For now, just remove script tags
        return html.replace(/<script[^>]*>.*?<\/script>/gsi, '');
    }
    
    /**
     * Escapes special characters
     * 
     * @param text - The text to escape
     */
    public escapeText(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    /**
     * Unescapes special characters
     * 
     * @param text - The text to unescape
     */
    public unescapeText(text: string): string {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
    
    /**
     * Gets the current translation options
     */
    public getOptions(): IMessageTranslationOptions {
        return { ...this.options };
    }
    
    /**
     * Updates translation options
     * 
     * @param options - The options to update
     */
    public updateOptions(options: Partial<IMessageTranslationOptions>): void {
        this.options = { ...this.options, ...options };
        this.logger.info('Updated translation options:', options);
    }
    
    /**
     * Gets statistics about the message translator
     */
    public getStats(): object {
        return {
            options: this.options,
        };
    }
}
