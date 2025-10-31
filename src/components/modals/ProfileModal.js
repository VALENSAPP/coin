import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  Image
} from 'react-native';
import React, { useRef, useEffect } from 'react';
import Feather from 'react-native-vector-icons/Feather';
import { Reels } from '../../assets/icons';
import { useNavigation } from '@react-navigation/native';
const SCREEN_HEIGHT = Dimensions.get('window').height;

const ProfileModal = ({ modalVisible, setModalVisible }) => {
  const navigation = useNavigation()
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  useEffect(() => {
    if (modalVisible) {
      showModal();
    }
  }, [modalVisible]);

  const showModal = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (modalVisible) {
        setModalVisible(false);
      }
    });
  };

  const handleNavigation = (type) =>{
  switch (type){
    case 'mint': //post//
      //  navigation.navigate('PostUpload');
       navigation.navigate('Add');
       break;
    case 'Flips'://reels//
      navigation.navigate('');
       break;
    case 'ai':
      navigation.navigate('');
      break;
    case 'drops'://Story//
      navigation.navigate('');
      break;
    case 'drops highlights'://storyHightlight//
      navigation.navigate('');
      break;
    case 'live':
      navigation.navigate('');
      break;
     
   default:
   break
  }
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          hideModal();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (modalVisible) {
      showModal();
    }
  }, [modalVisible]);

  return (
    <Modal transparent visible={modalVisible} animationType="none">
      <View style={styles.overlay}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={hideModal}
        />
        <Animated.View
          style={[styles.modalContainer, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.dragHandle} />

          <Text style={styles.title}>Create</Text>

          <View style={styles.list}>
            <TouchableOpacity style={styles.button} onPress={() => handleNavigation('Flips')}>
              <Reels width={20} height={20} />
              <Text style={styles.lText}>Flips</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handleNavigation('mint')}>
              <Feather name="grid" size={20} color="#111100" />
              <Text style={styles.lText}>mint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handleNavigation('drops')}>
              {/* <Feather name="circle" size={20} color="#111100" /> */}
              <Image
                source={require('../../assets/icons/pngicons/user-interface_14983775.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
              <Text style={styles.lText}>drops</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handleNavigation('drops highlights')}>
              <Feather name="circle" size={20} color="#111100" />
              <Text style={styles.lText}>drops highlights</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handleNavigation('live')}>
              <Image
                source={require('../../assets/icons/pngicons/live.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
              <Text style={styles.lText}>Live</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => handleNavigation('ai')}>
              <Feather name="star" size={20} color="#111100" />
              <Text style={styles.lText}>AI</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default ProfileModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: 450,
    backgroundColor: '#f8f2fd',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  list: {
    marginTop: 10,
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderBottomWidth: 0.3,
    borderColor: '#ccc',
    paddingHorizontal: 5,
  },
  lText: {
    fontSize: 16,
    marginLeft: 10,
  },
});
