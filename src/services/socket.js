// services/socket.js
import io from 'socket.io-client';
import { API_URL } from '../config/urls';

const SOCKET_URL = API_URL;


let socket = null;
let isConnecting = false;
let connectedUserId = null;
let listeners = new Map();

export const initializeSocket = async (userId) => {
  // Attempt to resolve userId if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      resolvedUserId = await AsyncStorage.getItem('userId');
    } catch (e) {
      console.warn('Unable to read userId from AsyncStorage during socket init');
    }
  }

  if (socket?.connected && connectedUserId === resolvedUserId) {
    console.log('✅ Socket already connected with matching userId:', resolvedUserId);
    return socket;
  }

  if (socket) {
    console.log('🔌 Disconnecting existing socket to update userId to:', resolvedUserId);
    socket.disconnect();
    socket = null;
  }

  if (isConnecting) {
    console.log('⏳ Socket connection in progress...');
    return null;
  }

  isConnecting = true;
  console.log('🔌 Initializing socket connection for userId:', resolvedUserId);

  try {
    socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      query: resolvedUserId ? { userId: resolvedUserId } : {},
    });
    connectedUserId = resolvedUserId;

    socket.on('connect', () => {
      console.log('✅ Socket connected successfully. Socket ID:', socket.id);
      if (resolvedUserId) {
        console.log('📤 Auto-requesting chat box for user:', resolvedUserId);
        getUserChatBox(resolvedUserId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket disconnected. Reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        type: error.type,
        description: error.description
      });
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      // Re-request chat box on reconnect
      if (resolvedUserId) {
        try {
          getUserChatBox(resolvedUserId);
        } catch (_) {}
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after max attempts');
    });

    return socket;
  } catch (err) {
    console.error('❌ initializeSocket error:', err);
    socket = null;
    throw err;
  } finally {
    isConnecting = false;
  }
};

export const getSocket = () => {
  if (!socket) {
    console.warn('⚠️ Socket is not initialized');
  }
  return socket;
};

export const disconnectSocket = () => {
  console.log('🔌 Disconnecting socket...');
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
    console.log('✅ Socket disconnected and cleaned up');
  }
};

// ========================================
// CHAT BOX FUNCTIONS (Conversation List)
// ========================================

/**
 * Get user's chat box (list of all conversations)
 * @param {string} userId - Current user's ID
 */
export const getUserChatBox = (userId) => {
  if (!socket?.connected) {
    console.error('❌ Cannot get chat box: Socket not connected');
    return;
  }
  
  console.log('📤 Emitting getUserChatBox for user:', userId);
  socket.emit('getUserChatBox', { userId });
};

/**
 * Listen for chat box updates
 * @param {function} callback - Callback function to handle chat box data
 */
export const onUserChatBox = (callback) => {
  if (!socket) {
    console.error('❌ Cannot listen to userChatBox: Socket not initialized');
    return;
  }
  
  console.log('👂 Setting up listener for userChatBox');
  
  socket.on('userChatBox', (data) => {
    console.log('📥 Received userChatBox data:', data);
    callback(data);
  });
  
  listeners.set('userChatBox', callback);
};

// ========================================
// CONVERSATION FUNCTIONS (Individual Chat)
// ========================================

/**
 * Get conversation with specific user
 * @param {string} userId - Current user's ID  
 * @param {string} otherUserId - Other user's ID
 */
export const getConversation = (userId, otherUserId) => {
  if (!socket?.connected) {
    console.error('❌ Cannot get conversation: Socket not connected');
    return;
  }
  
  // ✅ FIXED: Use userId and otherUserId as backend expects
  console.log('📤 Emitting getConversation:', { userId, otherUserId });
  socket.emit('getConversation', { userId, otherUserId });
};

/**
 * Listen for conversation updates
 * @param {function} callback - Callback function to handle conversation data
 */
export const onUserConversation = (callback) => {
  if (!socket) {
    console.error('❌ Cannot listen to userConversation: Socket not initialized');
    return;
  }
  
  console.log('👂 Setting up listener for userConversation');
  
  socket.on('userConversation', (data) => {
    console.log('📥 Received userConversation data:', data);
    callback(data);
  });
  
  listeners.set('userConversation', callback);
};

// ========================================
// MESSAGE FUNCTIONS
// ========================================

/**
 * Send a message
 * @param {object} messageData - Message data
 */
export const sendMessage = (messageData) => {
  if (!socket?.connected) {
    console.error('❌ Cannot send message: Socket not connected');
    return;
  }
  
  console.log('📤 Emitting sendMessage:', messageData);
  socket.emit('sendMessage', messageData);
};

/**
 * Listen for new messages
 * @param {function} callback - Callback function to handle new messages
 */
export const onNewMessage = (callback) => {
  if (!socket) {
    console.error('❌ Cannot listen to newMessage: Socket not initialized');
    return;
  }
  
  console.log('👂 Setting up listener for newMessage');
  
  socket.on('newMessage', (message) => {
    console.log('📥 Received new message:', message);
    callback(message);
  });
  
  listeners.set('newMessage', callback);
};

/**
 * Listen for message sent confirmation
 * @param {function} callback - Callback function to handle sent message confirmation
 */
export const onMessageSent = (callback) => {
  if (!socket) {
    console.error('❌ Cannot listen to messageSent: Socket not initialized');
    return;
  }
  
  console.log('👂 Setting up listener for messageSent');
  
  socket.on('messageSent', (data) => {
    console.log('📥 Message sent confirmation:', data);
    callback(data);
  });
  
  listeners.set('messageSent', callback);
};

// ========================================
// TYPING INDICATOR FUNCTIONS
// ========================================

/**
 * Emit typing indicator
 * @param {string} receiverId - User ID who should see typing indicator
 */
export const emitTyping = (receiverId) => {
  if (!socket?.connected) {
    console.error('❌ Cannot emit typing: Socket not connected');
    return;
  }
  
  console.log('📤 Emitting typing to:', receiverId);
  socket.emit('typing', { receiverId });
};

/**
 * Emit stop typing indicator
 * @param {string} receiverId - User ID who should see stop typing
 */
export const emitStopTyping = (receiverId) => {
  if (!socket?.connected) {
    console.error('❌ Cannot emit stopTyping: Socket not connected');
    return;
  }
  
  console.log('📤 Emitting stopTyping to:', receiverId);
  socket.emit('stopTyping', { receiverId });
};

/**
 * Listen for typing indicator
 * @param {function} callback - Callback function to handle typing event
 */
export const onTyping = (callback) => {
  if (!socket) {
    console.error('❌ Cannot listen to typing: Socket not initialized');
    return;
  }
  
  console.log('👂 Setting up listener for typing');
  
  socket.on('typing', (data) => {
    console.log('📥 User is typing:', data);
    callback(data);
  });
  
  listeners.set('typing', callback);
};

/**
 * Listen for stop typing indicator
 * @param {function} callback - Callback function to handle stop typing event
 */
export const onStopTyping = (callback) => {
  if (!socket) {
    console.error('❌ Cannot listen to stopTyping: Socket not initialized');
    return;
  }
  
  console.log('👂 Setting up listener for stopTyping');
  
  socket.on('stopTyping', (data) => {
    console.log('📥 User stopped typing:', data);
    callback(data);
  });
  
  listeners.set('stopTyping', callback);
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Remove specific event listener
 * @param {string} eventName - Name of the event
 */
export const removeListener = (eventName) => {
  if (socket && listeners.has(eventName)) {
    const callback = listeners.get(eventName);
    socket.off(eventName, callback);
    listeners.delete(eventName);
    console.log('🗑️ Removed listener for:', eventName);
  }
};

/**
 * Remove all listeners
 */
export const removeAllListeners = () => {
  if (socket) {
    listeners.forEach((callback, eventName) => {
      socket.off(eventName, callback);
    });
    listeners.clear();
    console.log('🗑️ Removed all socket listeners');
  }
};

/**
 * Check if socket is connected
 * @returns {boolean} - Connection status
 */
export const isSocketConnected = () => {
  const connected = socket?.connected || false;
  console.log('🔍 Socket connection status:', connected);
  return connected;
};

// ========================================
// MY CLOSET CHAT FUNCTIONS
// ========================================

/**
 * Get user's closet chat threads
 * @param {string} userId - Current user's ID
 */
export const getClosetChatThreads = (userId) => {
  if (!socket?.connected) {
    console.error('❌ Cannot get closet chat threads: Socket not connected');
    return;
  }
  console.log('📤 Emitting getClosetChatThreads for user:', userId);
  socket.emit('getClosetChatThreads', { userId });
};

/**
 * Get closet chat messages in a thread
 * @param {string} userId - Current user's ID
 * @param {string} threadId - Closet chat thread ID
 * @param {number} page - Page number
 * @param {number} limit - Number of messages per page
 */
export const getClosetChatMessages = (userId, threadId, page = 1, limit = 20) => {
  if (!socket?.connected) {
    console.error('❌ Cannot get closet chat messages: Socket not connected');
    return;
  }
  console.log('📤 Emitting getClosetChatMessages:', { userId, threadId, page, limit });
  socket.emit('getClosetChatMessages', { userId, threadId, page, limit });
};

/**
 * Send closet chat message
 * @param {string} userId - Current user's ID
 * @param {string} threadId - Closet chat thread ID
 * @param {string} message - Message content
 */
export const sendClosetChatMessage = (userId, threadId, message) => {
  if (!socket?.connected) {
    console.error('❌ Cannot send closet chat message: Socket not connected');
    return;
  }
  console.log('📤 Emitting sendClosetChatMessage:', { userId, threadId, message });
  socket.emit('sendClosetChatMessage', { userId, threadId, message });
};

/**
 * Mark closet chat message as seen
 * @param {string} userId - Current user's ID
 * @param {string} messageId - Message ID
 */
export const markClosetChatMessageSeen = (userId, messageId) => {
  if (!socket?.connected) {
    console.error('❌ Cannot mark closet chat message seen: Socket not connected');
    return;
  }
  console.log('📤 Emitting markClosetChatMessageSeen:', { userId, messageId });
  socket.emit('markClosetChatMessageSeen', { userId, messageId });
};