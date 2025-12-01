import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function CallbackScreen({ route }) {
  const navigation = useNavigation();
  const isMounted = useRef(true);
  const isProcessing = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (isProcessing.current) return;
    isProcessing.current = true;

    const processCallback = async () => {
      try {
        // Extract params from URL if needed
        const params = route?.params;
        console.log('Callback params:', params);

        // Do any necessary processing here (token exchange, etc.)
        // Make sure to check isMounted before state updates
        
        // Example: await exchangeCodeForToken(params.code);
        
        // Navigate away immediately after processing
        if (isMounted.current) {
          // Use replace to remove CallbackScreen from stack
          navigation.replace('Home');
        }
      } catch (error) {
        console.error('Callback processing error:', error);
        if (isMounted.current) {
          navigation.replace('Home');
        }
      }
    };

    // Small delay to ensure screen is mounted
    const timer = setTimeout(() => {
      processCallback();
    }, 100);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
      isProcessing.current = false;
    };
  }, [navigation, route]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#0000ff" />
    </View>
  );
}