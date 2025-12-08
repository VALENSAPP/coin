// service/socket.js
// services/socket.js
import io from 'socket.io-client';

const SOCKET_URL = 'https://www.valenscorp.com/';

let socket = null;
let isConnecting = false;
let listeners = new Map();

export const initializeSocket = async (userId) => {
  if (socket?.connected) {
    console.log('Socket already connected');
    return socket;
  }
  
  if (isConnecting) return null;
  isConnecting = true;

  try {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      if (userId) {
        getUserChatBox(userId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    return socket;
  } catch (err) {
    console.error('initializeSocket error:', err);
    socket = null;
    throw err;
  } finally {
    isConnecting = false;
  }
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.clear();
  }
};

export const getUserChatBox = (userId) => {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }
  socket.emit('getUserChatBox', { userId });
};

export const onUserChatBox = (callback) => {
  if (!socket) return;
  
  socket.on('userChatBox', (data) => {
    console.log('User chat box data:', data);
    callback(data);
  });
  
  listeners.set('userChatBox', callback);
};

export const sendMessage = (messageData) => {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }
  socket.emit('sendMessage', messageData);
};

export const onNewMessage = (callback) => {
  if (!socket) return;
  
  socket.on('newMessage', (message) => {
    console.log('New message received:', message);
    callback(message);
  });
  
  listeners.set('newMessage', callback);
};

// Add other functions as needed...