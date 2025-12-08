// hooks/useSocket.js
import { useEffect } from "react";
import { getSocket } from "../services/socket";
 
export default function useSocket(eventName, callback, deps = []) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
 
    socket.on(eventName, callback);
 
    return () => {
      socket.off(eventName, callback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...deps]);
}