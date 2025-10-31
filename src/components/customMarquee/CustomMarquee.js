import React, { useRef, useEffect, useState } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';

const CustomMarquee = ({
  children,
  speed = 1,
  loop = true,
  delay = 1000,
  style = {},
  textStyle = {},
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const startAnimation = () => {
    const distance = textWidth + containerWidth;
    translateX.setValue(containerWidth); // Start from right edge

    Animated.timing(translateX, {
      toValue: -textWidth, // Move left
      duration: (distance / speed) * 100, // Speed (lower = faster)
      delay,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && loop) {
        startAnimation(); // Restart
      }
    });
  };

  useEffect(() => {
    if (containerWidth && textWidth) {
      startAnimation();
    }
  }, [containerWidth, textWidth]);

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        style={[
          styles.text,
          textStyle,
          { transform: [{ translateX }] },
        ]}
        numberOfLines={1}
      >
        {children}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  text: {
    whiteSpace: 'nowrap',
  },
});

export default CustomMarquee;
