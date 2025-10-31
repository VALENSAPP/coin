import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Video from 'react-native-video';
import TextGradient from '../../assets/textgradient/TextGradient';

const Splash = () => {
  const fullText = "We are all Valens";
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(fullText.slice(0, index + 1));
      index++;
      if (index === fullText.length) {
        clearInterval(interval);
      }
    }, 200); // typing speed

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Video
        source={require('../../assets/videos/newsplash.mp4')}
        style={styles.video}
        resizeMode="cover"
        muted={true}
        repeat={false}
        onEnd={() => {
          console.log('Video finished');
        }}
      />

      {/* Typing animation text */}
      {/* <View style={styles.overlay}>
        <View style={styles.textWrapper}>
          <TextGradient
            style={{ fontWeight: "bold", fontSize: 42,  textAlign: 'left', }}
            locations={[0, 1]}
            colors={["#513189bd", "#e54ba0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            text={displayedText}
          />
        </View>
      </View> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },
  video: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    // top: '-30%',
  },
  textWrapper: {
    width: '90%',      // fixed width box
    alignItems: 'flex-start', // text starts from left
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#705AF0',
    textAlign: 'left',
  },
});

export default Splash;
