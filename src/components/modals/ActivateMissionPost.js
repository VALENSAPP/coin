import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';
import Icon from 'react-native-vector-icons/Ionicons';


export default function ActivateMissionPost({
  visible,
  onClose,
  onLaunch,
}) {
  const { bgStyle, textStyle, text, card } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, bgStyle]}>
            <View style={styles.modalHeader}>
                          <Icon name="wallet-outline" size={50} color={text} />
                        </View>
            
                        <Text style={[styles.modalTitle, textStyle]}>No Credits Available</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.body,]}>You’re about to create a Mission Post.</Text>
            {/* <Text style={styles.subtitle}>5 posts monthly</Text> */}

            <Text style={styles.body}>
              Mission Posts let you share  something important with your community — whether it’s a goal, idea, or moment that matters — and invite others to support or participate.
            </Text>

            <Text style={styles.body}>
              This credit unlocks one Mission Post, which you can use to:
            </Text>

            <Text style={styles.bullet}>• Launch a personal project</Text>
            <Text style={styles.bullet}>• Share a meaningful cause</Text>
            <Text style={styles.bullet}>• Ask for support from your network</Text>
            <Text style={styles.bullet}>• Create a moment around something you care about</Text>

            <Text style={styles.body}>
              Your followers can engage and support your mission directly in a simple and transparent way.
            </Text>

            <Text style={styles.body}>Unlock Mission Post to continue</Text>
          </ScrollView>

          <TouchableOpacity style={[styles.launchButton, { backgroundColor: text }]} onPress={onLaunch}>
            <Text style={styles.launchButtonText}>Launch Mission</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.notNowButton, { borderColor: text, backgroundColor: card }]} onPress={onClose}>
            <Text style={[styles.notNowButtonText, textStyle]}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
   modalHeader: {
    marginBottom: 16,
    alignItems:'center'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '88%',
    borderRadius: 16,
    padding: 18,
  },
  title: {
    fontSize: 20,
    // fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#333',
    lineHeight: 21,
    marginBottom: 10,
  },
  bullet: {
    fontSize: 14,
    color: '#333',
    lineHeight: 21,
    marginBottom: 4,
  },
  highlight: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 10,
  },
  note: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  launchButton: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  launchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  notNowButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  notNowButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
