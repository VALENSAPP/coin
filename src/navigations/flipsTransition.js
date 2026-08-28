import { TransitionSpecs } from '@react-navigation/stack';

/**
 * Instagram-style zoom + subtle flip when opening FlipsScreen.
 */
export const flipZoomCardStyleInterpolator = ({ current, next, layouts }) => {
  const { progress } = current;
  const width = layouts?.screen?.width || 1;

  return {
    cardStyle: {
      opacity: progress.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, 0.85, 1],
      }),
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.78, 1],
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [Math.round(width * 0.08), 0],
          }),
        },
        {
          rotateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['14deg', '0deg'],
          }),
        },
      ],
    },
    overlayStyle: {
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.45],
      }),
    },
  };
};

export const FLIPS_SCREEN_OPTIONS = {
  headerShown: false,
  gestureEnabled: true,
  gestureDirection: 'vertical',
  cardOverlayEnabled: true,
  transitionSpec: {
    open: {
      animation: 'spring',
      config: {
        stiffness: 900,
        damping: 70,
        mass: 1,
        overshootClamping: true,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      },
    },
    close: TransitionSpecs.TransitionIOSSpec,
  },
  cardStyleInterpolator: flipZoomCardStyleInterpolator,
};
