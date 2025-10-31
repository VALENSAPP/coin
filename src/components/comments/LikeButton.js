import React, { useRef } from 'react';
import { Animated, TouchableOpacity, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function LikeButton({ liked, count, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={animate} style={{ alignItems: 'center', minWidth: 32 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#ff3040' : '#888'} />
      </Animated.View>
      {count > 0 && (
        <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{count}</Text>
      )}
    </TouchableOpacity>
  );
} 