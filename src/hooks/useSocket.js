// hooks/useSocket.js
import { useEffect } from "react";
import { getSocket } from "../services/socket";
 
export default function useSocket(eventName, callback, deps = []) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.warn(`⚠️ [useSocket] Cannot register listener for event "${eventName}": Socket not initialized.`);
      return;
    }

    const loggedCallback = (...args) => {
      console.log(`📥 [useSocket] Event "${eventName}" received with payload:`, JSON.stringify(args, null, 2));
      callback(...args);
    };

    console.log(`🔌 [useSocket] Registering listener for event: "${eventName}"`);
    socket.on(eventName, loggedCallback);

    return () => {
      console.log(`🔌 [useSocket] Cleaning up listener for event: "${eventName}"`);
      socket.off(eventName, loggedCallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...deps]);
}