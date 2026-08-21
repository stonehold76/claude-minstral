/**
 * Novustrix Pirate Radio Service - Queue Management
 * Manages broadcast queues per Matrix room
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Queue Member object
 * @typedef {Object} QueueMember
 * @property {string} id - Unique member ID
 * @property {string} roomId - Matrix room ID
 * @property {string} userId - Matrix user ID
 * @property {string} displayName - User display name
 * @property {Date} joinedAt - When they joined the queue
 * @property {'waiting'|'broadcasting'} status - Current status
 */

/**
 * Room Queue object
 * @typedef {Object} RoomQueue
 * @property {string} roomId - Matrix room ID
 * @property {QueueMember[]} members - Queue members in order
 * @property {string|null} currentBroadcaster - Currently broadcasting user ID
 * @property {Date|null} broadcastStartedAt - When current broadcast started
 * @property {number} listenerCount - Current listener count
 */

class QueueManager {
    constructor() {
        /** @type {Map<string, RoomQueue>} */
        this.rooms = new Map();
        
        /** @type {Map<string, string>} - Maps userId to roomId for quick lookup */
        this.userToRoom = new Map();
    }
    
    /**
     * Add a user to a room's queue
     * @param {string} roomId - Matrix room ID
     * @param {string} userId - Matrix user ID
     * @param {string} displayName - User display name
     * @returns {QueueMember} The created queue member
     */
    addToQueue(roomId, userId, displayName) {
        let roomQueue = this.rooms.get(roomId);
        
        if (!roomQueue) {
            roomQueue = this.createRoomQueue(roomId);
            this.rooms.set(roomId, roomQueue);
        }
        
        // Remove user from queue if already present
        roomQueue.members = roomQueue.members.filter(m => m.userId !== userId);
        this.userToRoom.delete(userId);
        
        const member = {
            id: uuidv4(),
            roomId,
            userId,
            displayName,
            joinedAt: new Date(),
            status: 'waiting'
        };
        
        roomQueue.members.push(member);
        this.userToRoom.set(userId, roomId);
        
        return member;
    }
    
    /**
     * Remove a user from a room's queue
     * @param {string} roomId - Matrix room ID
     * @param {string} userId - Matrix user ID
     * @returns {QueueMember|null} The removed member or null
     */
    removeFromQueue(roomId, userId) {
        const roomQueue = this.rooms.get(roomId);
        if (!roomQueue) return null;
        
        const index = roomQueue.members.findIndex(m => m.userId === userId);
        if (index === -1) return null;
        
        const [member] = roomQueue.members.splice(index, 1);
        this.userToRoom.delete(userId);
        
        // If this was the current broadcaster, clear it
        if (roomQueue.currentBroadcaster === userId) {
            roomQueue.currentBroadcaster = null;
            roomQueue.broadcastStartedAt = null;
        }
        
        // Clean up empty room queues
        if (roomQueue.members.length === 0 && roomQueue.currentBroadcaster === null) {
            this.rooms.delete(roomId);
        }
        
        return member;
    }
    
    /**
     * Start broadcasting for a user (moves them to front of queue)
     * @param {string} roomId - Matrix room ID
     * @param {string} userId - Matrix user ID
     * @returns {QueueMember|null} The member now broadcasting or null
     */
    startBroadcast(roomId, userId) {
        const roomQueue = this.rooms.get(roomId);
        if (!roomQueue) return null;
        
        // Find the user in queue
        const memberIndex = roomQueue.members.findIndex(m => m.userId === userId);
        if (memberIndex === -1) return null;
        
        // Move to front
        const member = roomQueue.members.splice(memberIndex, 1)[0];
        member.status = 'broadcasting';
        roomQueue.members.unshift(member);
        
        // Set as current broadcaster
        roomQueue.currentBroadcaster = userId;
        roomQueue.broadcastStartedAt = new Date();
        
        return member;
    }
    
    /**
     * Stop broadcasting for current user
     * @param {string} roomId - Matrix room ID
     * @returns {QueueMember|null} The member who was broadcasting
     */
    stopBroadcast(roomId) {
        const roomQueue = this.rooms.get(roomId);
        if (!roomQueue || !roomQueue.currentBroadcaster) return null;
        
        const userId = roomQueue.currentBroadcaster;
        const member = roomQueue.members.find(m => m.userId === userId);
        
        if (member) {
            member.status = 'waiting';
        }
        
        roomQueue.currentBroadcaster = null;
        roomQueue.broadcastStartedAt = null;
        
        // Move to back of queue
        if (member) {
            const index = roomQueue.members.findIndex(m => m.userId === userId);
            if (index !== -1) {
                roomQueue.members.splice(index, 1);
                roomQueue.members.push(member);
            }
        }
        
        return member;
    }
    
    /**
     * Get current broadcaster for a room
     * @param {string} roomId - Matrix room ID
     * @returns {QueueMember|null} Current broadcaster or null
     */
    getCurrentBroadcaster(roomId) {
        const roomQueue = this.rooms.get(roomId);
        if (!roomQueue || !roomQueue.currentBroadcaster) return null;
        
        return roomQueue.members.find(m => m.userId === roomQueue.currentBroadcaster) || null;
    }
    
    /**
     * Get queue for a room
     * @param {string} roomId - Matrix room ID
     * @returns {QueueMember[]} Array of queue members
     */
    getQueue(roomId) {
        const roomQueue = this.rooms.get(roomId);
        return roomQueue ? [...roomQueue.members] : [];
    }
    
    /**
     * Get all rooms
     * @returns {string[]} Array of room IDs
     */
    getRooms() {
        return Array.from(this.rooms.keys());
    }
    
    /**
     * Check if a user is in any queue
     * @param {string} userId - Matrix user ID
     * @returns {boolean}
     */
    isUserInQueue(userId) {
        return this.userToRoom.has(userId);
    }
    
    /**
     * Get room ID for a user
     * @param {string} userId - Matrix user ID
     * @returns {string|null} Room ID or null
     */
    getRoomForUser(userId) {
        return this.userToRoom.get(userId) || null;
    }
    
    /**
     * Update listener count for a room
     * @param {string} roomId - Matrix room ID
     * @param {number} count - Listener count
     */
    updateListenerCount(roomId, count) {
        const roomQueue = this.rooms.get(roomId);
        if (roomQueue) {
            roomQueue.listenerCount = count;
        }
    }
    
    /**
     * Get listener count for a room
     * @param {string} roomId - Matrix room ID
     * @returns {number}
     */
    getListenerCount(roomId) {
        const roomQueue = this.rooms.get(roomId);
        return roomQueue ? roomQueue.listenerCount : 0;
    }
    
    /**
     * Get broadcast uptime for a room
     * @param {string} roomId - Matrix room ID
     * @returns {number} Seconds of uptime
     */
    getUptime(roomId) {
        const roomQueue = this.rooms.get(roomId);
        if (!roomQueue || !roomQueue.broadcastStartedAt) return 0;
        
        const now = new Date();
        const started = roomQueue.broadcastStartedAt;
        return Math.floor((now - started) / 1000);
    }
    
    /**
     * Create a new room queue
     * @param {string} roomId - Matrix room ID
     * @returns {RoomQueue}
     */
    createRoomQueue(roomId) {
        return {
            roomId,
            members: [],
            currentBroadcaster: null,
            broadcastStartedAt: null,
            listenerCount: 0
        };
    }
    
    /**
     * Get full state for a room (for broadcasting to clients)
     * @param {string} roomId - Matrix room ID
     * @returns {Object} Room state
     */
    getRoomState(roomId) {
        const roomQueue = this.rooms.get(roomId);
        if (!roomQueue) {
            return {
                roomId,
                queue: [],
                currentBroadcaster: null,
                isBroadcasting: false,
                listenerCount: 0,
                uptime: 0
            };
        }
        
        return {
            roomId,
            queue: roomQueue.members.map(m => ({
                userId: m.userId,
                displayName: m.displayName,
                status: m.status,
                joinedAt: m.joinedAt.toISOString()
            })),
            currentBroadcaster: roomQueue.currentBroadcaster,
            isBroadcasting: roomQueue.currentBroadcaster !== null,
            listenerCount: roomQueue.listenerCount,
            uptime: this.getUptime(roomId)
        };
    }
    
    /**
     * Clean up a room (remove all users)
     * @param {string} roomId - Matrix room ID
     */
    cleanupRoom(roomId) {
        const roomQueue = this.rooms.get(roomId);
        if (!roomQueue) return;
        
        // Remove all users from userToRoom map
        roomQueue.members.forEach(m => {
            this.userToRoom.delete(m.userId);
        });
        
        this.rooms.delete(roomId);
    }
}

module.exports = new QueueManager();
