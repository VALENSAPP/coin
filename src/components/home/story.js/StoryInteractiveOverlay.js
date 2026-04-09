import React, { useCallback, useEffect, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  OVERLAY_MAX_SCALE,
  OVERLAY_MIN_SCALE_STICKER,
  pointInTrash,
  shouldShowTrashHint,
} from './storyOverlayConstants';

/**
 * Pan + pinch overlays (stickers, text, music badge) with drag-to-delete when released over trash.
 */
export default function StoryInteractiveOverlay({
  initialX,
  initialY,
  initialScale = 1,
  minScale = OVERLAY_MIN_SCALE_STICKER,
  maxScale = OVERLAY_MAX_SCALE,
  zIndex = 12,
  trashRect,
  onCommit,
  onDelete,
  onDragActive,
  children,
}) {
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const scale = useSharedValue(initialScale);
  const startX = useSharedValue(initialX);
  const startY = useSharedValue(initialY);
  const pinchStartScale = useSharedValue(initialScale);
  const pinchStartX = useSharedValue(initialX);
  const pinchStartY = useSharedValue(initialY);
  const pinchLocalOffsetX = useSharedValue(0);
  const pinchLocalOffsetY = useSharedValue(0);
  const layoutWidth = useSharedValue(0);
  const layoutHeight = useSharedValue(0);
  const trashRectRef = useRef(trashRect);

  useEffect(() => {
    trashRectRef.current = trashRect;
  }, [trashRect]);

  useEffect(() => {
    translateX.value = initialX;
    startX.value = initialX;
  }, [initialX, startX, translateX]);

  useEffect(() => {
    translateY.value = initialY;
    startY.value = initialY;
  }, [initialY, startY, translateY]);

  useEffect(() => {
    scale.value = initialScale;
    pinchStartScale.value = initialScale;
  }, [initialScale, pinchStartScale, scale]);

  const trashHintVisibleRef = useRef(false);

  const hideTrashHint = useCallback(() => {
    trashHintVisibleRef.current = false;
    onDragActive?.(false);
  }, [onDragActive]);

  const updateTrashHint = useCallback(
    (translationY, absoluteY) => {
      const next = shouldShowTrashHint(translationY, absoluteY);
      if (next !== trashHintVisibleRef.current) {
        trashHintVisibleRef.current = next;
        onDragActive?.(next);
      }
    },
    [onDragActive],
  );

  const handlePanEnd = useCallback(
    (ax, ay, x, y, s) => {
      const rect = trashRectRef.current;
      if (pointInTrash(ax, ay, rect)) {
        onDelete?.();
        return;
      }
      onCommit?.(x, y, s);
    },
    [onCommit, onDelete],
  );

  const commitPinchOnly = useCallback(
    (x, y, s) => {
      onCommit?.(x, y, s);
    },
    [onCommit],
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(hideTrashHint)();
    })
    .onUpdate(e => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
      runOnJS(updateTrashHint)(e.translationY, e.absoluteY);
    })
    .onEnd(e => {
      runOnJS(hideTrashHint)();
      runOnJS(handlePanEnd)(
        e.absoluteX,
        e.absoluteY,
        translateX.value,
        translateY.value,
        scale.value,
      );
    });

  const pinch = Gesture.Pinch()
    .onBegin(e => {
      pinchStartScale.value = scale.value;
      pinchStartX.value = translateX.value;
      pinchStartY.value = translateY.value;
      const baseScale = Math.max(pinchStartScale.value, 0.001);
      pinchLocalOffsetX.value =
        (e.focalX - layoutWidth.value / 2) / baseScale;
      pinchLocalOffsetY.value =
        (e.focalY - layoutHeight.value / 2) / baseScale;
    })
    .onUpdate(e => {
      const next = pinchStartScale.value * e.scale;
      const nextScale = Math.min(maxScale, Math.max(minScale, next));
      scale.value = nextScale;
      translateX.value =
        pinchStartX.value -
        pinchLocalOffsetX.value * (nextScale - pinchStartScale.value);
      translateY.value =
        pinchStartY.value -
        pinchLocalOffsetY.value * (nextScale - pinchStartScale.value);
    })
    .onEnd(() => {
      runOnJS(commitPinchOnly)(
        translateX.value,
        translateY.value,
        scale.value,
      );
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: translateX.value,
    top: translateY.value,
    zIndex,
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={animatedStyle}
        collapsable={false}
        onLayout={event => {
          layoutWidth.value = event.nativeEvent.layout.width;
          layoutHeight.value = event.nativeEvent.layout.height;
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
