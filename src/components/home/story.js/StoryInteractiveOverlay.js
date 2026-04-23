import React, { useCallback, useEffect, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  OVERLAY_MAX_SCALE,
  OVERLAY_MIN_SCALE_STICKER,
  pointInTrash,
} from './storyOverlayConstants';

/** Eased shrink/expand when hand enters/leaves the trash — avoids abrupt pops. */
const TRASH_SIZE_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const TRASH_SIZE_MS = 340;
const TRASH_SIZE_RESET_MS = 280;
/** How much each pinch frame blends toward the gesture target (0–1; higher = snappier, lower = silkier). */
const PINCH_SCALE_BLEND = 0.52;

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
  onInteractionStart,
  onInteractionEnd,
  /** Optional: quick tap (e.g. text) to edit without starting a drag. */
  onSingleTap,
  /** Fired while dragging: true when the finger is over the trash delete zone. */
  onTrashHoverChange,
  /** If true, shrinks the overlay when the finger is over the trash (e.g. text "about to delete"). */
  shrinkOnTrashHover = false,
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
  const deletePreviewScale = useSharedValue(1);
  const trashRectRef = useRef(trashRect);
  const lastTrashHoverRef = useRef(false);

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
    deletePreviewScale.value = 1;
  }, [initialScale, pinchStartScale, scale, deletePreviewScale]);

  const setInteractionActive = useCallback(
    isActive => {
      onInteractionStart?.();
      onDragActive?.(isActive);
    },
    [onDragActive, onInteractionStart],
  );

  const clearTrashHover = useCallback(() => {
    if (!onTrashHoverChange && !shrinkOnTrashHover) return;
    lastTrashHoverRef.current = false;
    onTrashHoverChange?.(false);
    if (shrinkOnTrashHover) {
      deletePreviewScale.value = withTiming(1, {
        duration: TRASH_SIZE_RESET_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [onTrashHoverChange, shrinkOnTrashHover]);

  const updateTrashHover = useCallback(
    (ax, ay) => {
      if (!onTrashHoverChange && !shrinkOnTrashHover) return;
      const over = pointInTrash(ax, ay, trashRectRef.current);
      if (over === lastTrashHoverRef.current) return;
      lastTrashHoverRef.current = over;
      onTrashHoverChange?.(over);
      if (shrinkOnTrashHover) {
        const target = over ? 0.64 : 1;
        deletePreviewScale.value = withTiming(target, {
          duration: TRASH_SIZE_MS,
          easing: TRASH_SIZE_EASING,
        });
      }
    },
    [onTrashHoverChange, shrinkOnTrashHover],
  );

  const endInteraction = useCallback(() => {
    clearTrashHover();
    onInteractionEnd?.();
    onDragActive?.(false);
  }, [clearTrashHover, onDragActive, onInteractionEnd]);

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

  const emitSingleTap = useCallback(() => {
    onSingleTap?.();
  }, [onSingleTap]);

  const tapPanNudge = onSingleTap ? 8 : 0;

  const pan = Gesture.Pan()
    // Match Tap.maxDistance so a quick press does not start a drag when edit-on-tap is on.
    .minDistance(tapPanNudge)
    .averageTouches(true)
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(setInteractionActive)(true);
      runOnJS(clearTrashHover)();
    })
    .onUpdate(e => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
      runOnJS(updateTrashHover)(e.absoluteX, e.absoluteY);
    })
    .onEnd(e => {
      'worklet';
      runOnJS(endInteraction)();
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
      runOnJS(clearTrashHover)();
      runOnJS(setInteractionActive)(true);
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
      'worklet';
      const next = pinchStartScale.value * e.scale;
      const targetScale = Math.min(maxScale, Math.max(minScale, next));
      const a = PINCH_SCALE_BLEND;
      const smoothed = scale.value * (1 - a) + targetScale * a;
      const s = Math.min(maxScale, Math.max(minScale, smoothed));
      scale.value = s;
      const delta = s - pinchStartScale.value;
      translateX.value = pinchStartX.value - pinchLocalOffsetX.value * delta;
      translateY.value = pinchStartY.value - pinchLocalOffsetY.value * delta;
    })
    .onEnd(() => {
      runOnJS(endInteraction)();
      runOnJS(commitPinchOnly)(
        translateX.value,
        translateY.value,
        scale.value,
      );
    });

  const textTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDistance(tapPanNudge)
    .onEnd(() => {
      runOnJS(emitSingleTap)();
    });

  const dragPinch = Gesture.Simultaneous(pinch, pan);
  // Tap is checked first: release without moving more than nudge = edit. Beyond that, drag/pinch.
  const composed = onSingleTap
    ? Gesture.Exclusive(textTap, dragPinch)
    : dragPinch;

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: translateX.value,
    top: translateY.value,
    zIndex,
    transform: [{ scale: scale.value * deletePreviewScale.value }],
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
