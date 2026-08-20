/**
 * Matrix Event Models
 * 
 * Type definitions for Matrix events and related data structures.
 */

/**
 * Basic Matrix event interface
 */
export interface IMatrixEvent {
    // Event metadata
    event_id: string;
    room_id: string;
    sender: string;
    origin_server_ts: number;
    type: string;
    
    // Event content
    content: any;
    
    // State key (for state events)
    state_key?: string;
    
    // Previous event (for state events)
    prev_content?: any;
    
    // Redacted status
    redacted?: boolean;
    
    // Unsigned data
    unsigned?: {
        age?: number;
        redacted_because?: {
            event_id: string;
            reason?: string;
        };
        transaction_id?: string;
    };
}

/**
 * Room message event interface
 */
export interface IRoomMessageEvent extends IMatrixEvent {
    type: 'm.room.message';
    content: {
        body: string;
        formatted_body?: string;
        msgtype?: 'm.text' | 'm.emote' | 'm.notice' | 'm.image' | 'm.file' | 'm.audio' | 'm.video' | 'm.location';
        format?: 'org.matrix.custom.html';
        [key: string]: any;
    };
}

/**
 * Room member event interface
 */
export interface IRoomMemberEvent extends IMatrixEvent {
    type: 'm.room.member';
    state_key: string; // User ID
    content: {
        membership: 'join' | 'leave' | 'ban' | 'invite' | 'knock';
        displayname?: string;
        avatar_url?: string;
        is_direct?: boolean;
        third_party_invite?: any;
        [key: string]: any;
    };
    prev_content?: {
        membership: 'join' | 'leave' | 'ban' | 'invite' | 'knock';
        [key: string]: any;
    };
}

/**
 * Typing event interface
 */
export interface ITypingEvent extends IMatrixEvent {
    type: 'm.typing';
    content: {
        user_ids: string[];
    };
}

/**
 * Receipt event interface
 */
export interface IReceiptEvent extends IMatrixEvent {
    type: 'm.receipt';
    content: {
        [userId: string]: {
            [eventId: string]: {
                ts: number;
            };
        };
    };
}

/**
 * Reaction event interface
 */
export interface IReactionEvent extends IMatrixEvent {
    type: 'm.reaction';
    content: {
        'm.relates_to': {
            rel_type: 'm.annotation';
            event_id: string;
            key: string; // The reaction emoji
        };
    };
}

/**
 * Room create event interface
 */
export interface IRoomCreateEvent extends IMatrixEvent {
    type: 'm.room.create';
    content: {
        creator: string;
        room_version?: string;
        predecessor?: {
            room_id: string;
            event_id: string;
        };
        [key: string]: any;
    };
}

/**
 * Room topic event interface
 */
export interface IRoomTopicEvent extends IMatrixEvent {
    type: 'm.room.topic';
    state_key: '';
    content: {
        topic: string;
    };
}

/**
 * Room name event interface
 */
export interface IRoomNameEvent extends IMatrixEvent {
    type: 'm.room.name';
    state_key: '';
    content: {
        name: string;
    };
}

/**
 * Room avatar event interface
 */
export interface IRoomAvatarEvent extends IMatrixEvent {
    type: 'm.room.avatar';
    state_key: '';
    content: {
        url: string;
    };
}

/**
 * Presence event interface
 */
export interface IPresenceEvent extends IMatrixEvent {
    type: 'm.presence';
    state_key: string; // User ID
    content: {
        avatar_url?: string;
        displayname?: string;
        last_active_ago?: number;
        presence: 'online' | 'offline' | 'unavailable';
        status_msg?: string;
        currently_active?: boolean;
    };
}

/**
 * Read receipt event interface
 */
export interface IReadReceiptEvent extends IMatrixEvent {
    type: 'm.receipt';
    content: {
        [userId: string]: {
            [eventId: string]: {
                ts: number;
            };
        };
    };
}

/**
 * Simplified Matrix event for internal use
 */
export interface MatrixEvent {
    // Event identifiers
    eventId: string;
    roomId: string;
    sender: string;
    senderDisplayName?: string;
    
    // Timestamps
    timestamp: number;
    
    // Event type
    type: string;
    
    // Content
    content: any;
    formattedContent?: string;
    
    // State key (for state events)
    stateKey?: string;
    
    // Raw event (for access to all fields)
    rawEvent?: IMatrixEvent;
    
    // Metadata
    isEncrypted?: boolean;
    isRedacted?: boolean;
}

/**
 * Matrix user profile
 */
export interface MatrixUser {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    lastActiveAgo?: number;
    presence?: 'online' | 'offline' | 'unavailable';
    statusMsg?: string;
}

/**
 * Matrix room information
 */
export interface MatrixRoom {
    roomId: string;
    name?: string;
    topic?: string;
    avatarUrl?: string;
    canonicalAlias?: string;
    aliases: string[];
    memberCount: number;
    joinedMemberCount: number;
    invitedMemberCount: number;
    version?: string;
    isEncrypted: boolean;
    isPublic: boolean;
}

/**
 * Matrix room member
 */
export interface MatrixRoomMember {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    membership: 'join' | 'leave' | 'ban' | 'invite' | 'knock';
    powerLevel: number;
    normalizedPowerLevel: number;
}

/**
 * Matrix media information
 */
export interface MatrixMedia {
    contentUri: string;
    mediaId: string;
    mediaType: string;
    mediaLength?: number;
    filename?: string;
    lastModified?: number;
}

/**
 * Matrix event type constants
 */
export enum MatrixEventType {
    ROOM_MESSAGE = 'm.room.message',
    ROOM_MEMBER = 'm.room.member',
    ROOM_CREATE = 'm.room.create',
    ROOM_JOIN_RULES = 'm.room.join_rules',
    ROOM_POWER_LEVELS = 'm.room.power_levels',
    ROOM_HISTORY_VISIBILITY = 'm.room.history_visibility',
    ROOM_CANONICAL_ALIAS = 'm.room.canonical_alias',
    ROOM_ALIASES = 'm.room.aliases',
    ROOM_NAME = 'm.room.name',
    ROOM_TOPIC = 'm.room.topic',
    ROOM_AVATAR = 'm.room.avatar',
    ROOM_ENCRYPTION = 'm.room.encryption',
    ROOM_TOMBSTONE = 'm.room.tombstone',
    TYPING = 'm.typing',
    RECEIPT = 'm.receipt',
    REACTION = 'm.reaction',
    PRESENCE = 'm.presence',
    CALL_INVITE = 'm.call.invite',
    CALL_ANSWER = 'm.call.answer',
    CALL_HANGUP = 'm.call.hangup',
    CALL_CANDIDATES = 'm.call.candidates',
    SECRET_SEND = 'm.secret.send',
    SECRET_REQUEST = 'm.secret.request',
    DUMMY = 'm.dummy',
}

/**
 * Matrix message type constants
 */
export enum MatrixMessageType {
    TEXT = 'm.text',
    EMOTE = 'm.emote',
    NOTICE = 'm.notice',
    IMAGE = 'm.image',
    FILE = 'm.file',
    AUDIO = 'm.audio',
    VIDEO = 'm.video',
    LOCATION = 'm.location',
    SERVER_NOTICE = 'm.server_notice',
}

/**
 * Matrix membership constants
 */
export enum MatrixMembership {
    JOIN = 'join',
    LEAVE = 'leave',
    BAN = 'ban',
    INVITE = 'invite',
    KNOCK = 'knock',
}

/**
 * Matrix presence constants
 */
export enum MatrixPresence {
    ONLINE = 'online',
    OFFLINE = 'offline',
    UNAVAILABLE = 'unavailable',
}

/**
 * Helper function to create a MatrixEvent from a raw Matrix event
 * 
 * @param event - The raw Matrix event
 */
export function createMatrixEvent(event: IMatrixEvent): MatrixEvent {
    const matrixEvent: MatrixEvent = {
        eventId: event.event_id,
        roomId: event.room_id,
        sender: event.sender,
        timestamp: event.origin_server_ts,
        type: event.type,
        content: event.content,
        rawEvent: event,
    };
    
    // Add formatted content if available
    if (event.type === MatrixEventType.ROOM_MESSAGE) {
        const roomEvent = event as IRoomMessageEvent;
        matrixEvent.formattedContent = roomEvent.content.formatted_body;
    }
    
    // Add state key if available
    if ('state_key' in event) {
        matrixEvent.stateKey = event.state_key;
    }
    
    return matrixEvent;
}

/**
 * Helper function to check if an event is encrypted
 * 
 * @param event - The Matrix event
 */
export function isEventEncrypted(event: IMatrixEvent): boolean {
    return event.type === 'm.room.encrypted' || 
           (event.content && event.content['algorithm']);
}

/**
 * Helper function to check if an event is redacted
 * 
 * @param event - The Matrix event
 */
export function isEventRedacted(event: IMatrixEvent): boolean {
    return event.redacted === true || 
           (event.unsigned && event.unsigned.redacted_because !== undefined);
}

/**
 * Helper function to get the message body from a room message event
 * 
 * @param event - The room message event
 */
export function getMessageBody(event: IRoomMessageEvent): string {
    if (event.content?.body) {
        return event.content.body;
    }
    if (event.content?.formatted_body) {
        // Strip HTML tags if no plain text body
        return event.content.formatted_body.replace(/<[^>]*>/g, '');
    }
    return '';
}

/**
 * Helper function to get the formatted body from a room message event
 * 
 * @param event - The room message event
 */
export function getFormattedBody(event: IRoomMessageEvent): string | undefined {
    return event.content?.formatted_body;
}

/**
 * Helper function to get the message type from a room message event
 * 
 * @param event - The room message event
 */
export function getMessageType(event: IRoomMessageEvent): MatrixMessageType | undefined {
    if (event.content?.msgtype) {
        return event.content.msgtype as MatrixMessageType;
    }
    return MatrixMessageType.TEXT;
}
