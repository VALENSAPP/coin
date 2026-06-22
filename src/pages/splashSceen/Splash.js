import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Video from 'react-native-video';

const Splash = ({ onFinish }) => {
  const finishedRef = useRef(false);

  const handleFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish?.();
  };

  useEffect(() => {
    const fallbackTimer = setTimeout(handleFinish, 8000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <View style={styles.container}>
      <Video
        source={require('../../assets/videos/splashnew_ZwrwqSXp.mp4')}
        style={styles.video}
        resizeMode="contain"
        muted={false}
        volume={1}
        ignoreSilentSwitch="ignore"
        repeat={false}
        // onLoad={() => setTimeout(handleFinish, 1500)}
        onEnd={handleFinish}
        onError={handleFinish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default Splash;
