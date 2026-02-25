import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, bgStyle]}>
            <View style={styles.modalHeader}>
                          <Icon name="wallet-outline" size={50} color={text} />
                        </View>
            
                        <Text style={[styles.modalTitle, textStyle]}>No Credits Available</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.body,]}>Activate a Business Mission Post 5 posts monthly</Text>
            {/* <Text style={styles.subtitle}>5 posts monthly</Text> */}

            <Text style={styles.body}>
              You're about to launch a Business Mission Post.
            </Text>

            <Text style={styles.body}>
              Mission Posts allow brands and organizations to create a focused campaign, inviting followers and non-followers to engage, support, crowdfunding, or participate around a specific initiative.
            </Text>

            <Text style={styles.body}>
              This credit enables one campaign post designed for:
            </Text>

            <Text style={styles.bullet}>• Product launches</Text>
            <Text style={styles.bullet}>• Brand awareness campaigns</Text>
            <Text style={styles.bullet}>• Social impact initiatives</Text>
            <Text style={styles.bullet}>• Community activations</Text>
            <Text style={styles.bullet}>• Limited-time marketing actions</Text>

            <Text style={styles.body}>
              Your audience can voluntarily participate or support the mission directly through the post.
            </Text>

            <Text style={[styles.highlight, textStyle]}>Built for engagement. Designed for purpose.</Text>

            <Text style={styles.note}>
              Note: This is a campaign tool, not a financial product or investment feature.
            </Text>

            <Text style={styles.body}>Ready to activate your mission?</Text>
          </ScrollView>

          <TouchableOpacity style={[styles.launchButton, { backgroundColor: text }]} onPress={onLaunch}>
            <Text style={styles.launchButtonText}>Launch Business Mission</Text>
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
