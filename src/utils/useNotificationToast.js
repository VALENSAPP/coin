// hooks/useNotificationToast.js
import { useState, useCallback } from 'react';

export const useNotificationToast = () => {
  const [activeNotification, setActiveNotification] = useState(null);

  const showNotificationToast = useCallback((remoteMessage) => {
    setActiveNotification(remoteMessage);
  }, []);

  const dismissNotificationToast = useCallback(() => {
    setActiveNotification(null);
  }, []);

  return { activeNotification, showNotificationToast, dismissNotificationToast };
};