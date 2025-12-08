// services/socket.js
import io from 'socket.io-client';

const SOCKET_URL = 'https://www.valenscorp.com/';

let socket = null;
let isConnecting = false;
let listeners = new Map();

export const initializeSocket = async (userId) => {
  if (socket?.connected) {
    console.log('✅ Socket already connected');
    return socket;
  }
  
  if (isConnecting) {
    console.log('⏳ Socket connection in progress...');
    return null;
  }
  
  isConnecting = true;
  console.log('🔌 Initializing socket connection...');

  try {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected successfully. Socket ID:', socket.id);
      if (userId) {
        console.log('📤 Auto-requesting chat box for user:', userId);
        getUserChatBox(userId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket disconnected. Reason:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
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