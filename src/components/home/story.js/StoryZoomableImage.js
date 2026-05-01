import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const MIN_SCALE = 0.45;
const MAX_SCALE = 4;

const clamp = (value, min, max) => {
  'worklet';
  return Math.min(max, Math.max(min, value));
};

export default function StoryZoomableImage({
  uri,
  resizeMode,
  style,
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const layoutWidth = useSharedValue(0);
  const layoutHeight = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY, uri]);

  const clampToBounds = () => {
    'worklet';
    const maxX = Math.max(0, ((scale.value - 1) * layoutWidth.value) / 2);
    const maxY = Math.max(0, ((scale.value - 1) * layoutHeight.value) / 2);
    translateX.value = withTiming(clamp(translateX.value, -maxX, maxX), {
      duration: 140,
    });
    translateY.value = withTiming(clamp(translateY.value, -maxY, maxY), {
      duration: 140,
    });
    savedTranslateX.value = clamp(translateX.value, -maxX, maxX);
    savedTranslateY.value = clamp(translateY.value, -maxY, maxY);
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onUpdate(event => {
      scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      clampToBounds();
    });

  const pan = Gesture.Pan()
    .minDistance(2)
    .onBegin(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate(event => {
      if (scale.value <= 1.01) return;
      const maxX = Math.max(0, ((scale.value - 1) * layoutWidth.value) / 2);
      const maxY = Math.max(0, ((scale.value - 1) * layoutHeight.value) / 2);
      translateX.value = clamp(
        savedTranslateX.value + event.translationX,
        -maxX,
        maxX,
      );
      translateY.value = clamp(
        savedTranslateY.value + event.translationY,
        -maxY,
        maxY,
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd(() => {
      const shouldZoomIn = scale.value < 1.5;
      scale.value = withTiming(shouldZoomIn ? 2.4 : 1, { duration: 180 });
      savedScale.value = shouldZoomIn ? 2.4 : 1;
      translateX.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(0, { duration: 180 });
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const gesture = Gesture.Simultaneous(doubleTap, pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={styles.wrap}
        collapsable={false}
        onLayout={event => {
          layoutWidth.value = event.nativeEvent.layout.width;
          layoutHeight.value = event.nativeEvent.layout.height;
        }}
      >
        <AnimatedImage
          pointerEvents="none"
          source={{ uri }}
          style={[style, animatedStyle]}
          resizeMode={resizeMode}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
