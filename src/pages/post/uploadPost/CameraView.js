import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/Ionicons';

const CameraScreen = ({ mode = 'photo', onCapture, onCancel }) => {
  const camera = useRef(null);
  const [devicePosition, setDevicePosition] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isRecording, setIsRecording] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [allowAudio, setAllowAudio] = useState(false); // track mic permission

  const device = useCameraDevice(devicePosition);

  const requestAndroidPermissions = async () => {
    if (Platform.OS !== 'android') return true;
  
    try {
      const cameraGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
  
      const micGranted = mode === 'video'
        ? await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          )
        : 'granted';
  
      return (
        cameraGranted === PermissionsAndroid.RESULTS.GRANTED &&
        micGranted === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (error) {
      console.warn('Permission error:', error);
      return false;
    }
  };
  

  useEffect(() => {
    (async () => {
      const systemGranted = await requestAndroidPermissions();

      const cam = await Camera.requestCameraPermission();
      const mic =
        mode === 'video'
          ? await Camera.requestMicrophonePermission()
          : 'authorized';

      const camOK = cam === 'authorized' || cam === 'granted';
      const micOK = mic === 'granted';
      console.log(mic)
      
      if (systemGranted && camOK) {
        setPermissionsGranted(true);
        setAllowAudio(micOK);
      } else {
        setPermissionsGranted(false);
        setAllowAudio(false);
        Alert.alert(
          'Permissions Required',
          'Camera and Microphone access are required to record videos with sound.'
        );
      }
    })();
  }, [mode]);

  const handleFlip = () => {
    setDevicePosition((pos) => (pos === 'back' ? 'front' : 'back'));
  };

  const handleCapture = async () => {
    if (!camera.current) return;

    if (mode === 'photo') {
      const photo = await camera.current.takePhoto({ flash });
      console.log('Photo captured:', photo);
      onCapture?.(photo);
    } else {
      if (!isRecording) {
        setIsRecording(true);
        await camera.current.startRecording({
          flash,
          onRecordingFinished: (video) => {
            console.log('Video:', video);
            onCapture?.(video);
            setIsRecording(false);
          },
          onRecordingError: (error) => {
            console.error(error);
            Alert.alert('Recording Error', error.message);
            setIsRecording(false);
          },
        });
      } else {
        await camera.current.stopRecording();
      }
    }
  };

  if (!device || !permissionsGranted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white' }}>Loading camera or permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Icon name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerText}>{mode === 'photo' ? 'Photo' : 'Video'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Camera View */}
      <Camera
        ref={camera}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={mode === 'photo'}
        video={mode === 'video'}
        audio={false}
      />

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={handleFlip}>
          <Icon name="camera-reverse" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCapture} style={styles.captureOuter}>
          <View style={styles.captureInner} />
        </TouchableOpacity>

        {mode === 'video' ? (
          <Icon name={allowAudio ? 'mic' : 'mic-off'} size={28} color="#000" />
        ) : (
          <TouchableOpacity onPress={() => setFlash((prev) => (prev === 'on' ? 'off' : 'on'))}>
            <Icon name={flash === 'on' ? 'flash' : 'flash-off'} size={28} color="#000" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  headerText: { fontSize: 18, fontWeight: 'bold' },
  camera: { flex: 1 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});

export default CameraScreen;
