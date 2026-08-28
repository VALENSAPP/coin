import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);

function InstagramZoomableImage({
  uri,
  height,
  width = SCREEN_WIDTH,
  resizeMode = FastImage.resizeMode.contain,
  onZoomChange,
  simultaneousHandlers,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalImageLoaded, setModalImageLoaded] = useState(false);

  const imageSource = useMemo(
    () => ({ uri, priority: FastImage.priority.high, cache: FastImage.cacheControl.immutable }),
    [uri],
  );

  const displayHeight = height || width;
  const halfWidth = width / 2;
  const halfHeight = displayHeight / 2;

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale, focalX: translateX, focalY: translateY } }],
    { useNativeDriver: true },
  );

  const resetScale = useCallback(() => {
    setIsModalVisible(false);
    setModalImageLoaded(false);
    onZoomChange?.(false);
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 0 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [onZoomChange, scale, translateX, translateY]);

  const onPinchStateChange = useCallback(({ nativeEvent }) => {
    const { state } = nativeEvent;
    if (state === State.BEGAN) {
      setIsModalVisible(true);
      onZoomChange?.(true);
      return;
    }
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      resetScale();
    }
  }, [onZoomChange, resetScale]);

  const pinchHandlerProps = {
    onGestureEvent: onPinchEvent,
    onHandlerStateChange: onPinchStateChange,
    simultaneousHandlers,
    minPointers: 2,
  };

  useEffect(() => {
    if (!uri) return;
    FastImage.preload([imageSource]);
    setTimeout(() => {
      FastImage.preload([{ ...imageSource, priority: FastImage.priority.highest }]);
    }, 400);
  }, [uri, imageSource]);

  useEffect(() => {
    setIsModalVisible(false);
    setModalImageLoaded(false);
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
  }, [uri, scale, translateX, translateY]);

  return (
    <GestureHandlerRootView style={[styles.mediaContainer, { width, height: displayHeight }]}>
      <PinchGestureHandler {...pinchHandlerProps}>
        <AnimatedFastImage
          source={imageSource}
          resizeMode={resizeMode}
          fadeDuration={0}
          style={[
            { width: '100%', height: displayHeight },
            { opacity: isModalVisible && modalImageLoaded ? 0 : 1 },
          ]}
        />
      </PinchGestureHandler>
      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={resetScale}>
        <GestureHandlerRootView style={styles.gestureModalRoot}>
          <View style={styles.modalBackground}>
            <TouchableWithoutFeedback onPress={resetScale}>
              <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>
            <PinchGestureHandler {...pinchHandlerProps}>
              <AnimatedFastImage
                source={imageSource}
                resizeMode="contain"
                fadeDuration={0}
                onLoadStart={() => setModalImageLoaded(false)}
                onLoadEnd={() => setModalImageLoaded(true)}
                style={[
                  styles.fullScreenImage,
                  {
                    width: SCREEN_WIDTH,
                    height: displayHeight,
                    transform: [
                      { translateX: Animated.subtract(translateX, halfWidth) },
                      { translateY: Animated.subtract(translateY, halfHeight) },
                      { scale },
                      { translateX: Animated.multiply(Animated.subtract(translateX, halfWidth), -1) },
                      { translateY: Animated.multiply(Animated.subtract(translateY, halfHeight), -1) },
                    ],
                  },
                ]}
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
              />
            </PinchGestureHandler>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={resetScale}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close zoomed image">
              <Icon name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  mediaContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gestureModalRoot: {
    flex: 1,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    resizeMode: 'contain',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InstagramZoomableImage;
