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
import { useLanguage } from '../../i18n';

export default function ActivateMissionPost({
  visible,
  onClose,
  onLaunch,
}) {
  const { bgStyle, textStyle, text, card } = useAppTheme();
  const { t } = useLanguage();

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

          <Text style={[styles.modalTitle, textStyle]}>
            {t('activateMissionPost.noCreditsTitle')}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.body]}>
              {t('activateMissionPost.bodyIntro')}
            </Text>

            <Text style={styles.body}>
              {t('activateMissionPost.bodyDescription')}
            </Text>

            <Text style={styles.body}>
              {t('activateMissionPost.creditUnlocks')}
            </Text>

            <Text style={styles.bullet}>• {t('activateMissionPost.bullet1')}</Text>
            <Text style={styles.bullet}>• {t('activateMissionPost.bullet2')}</Text>
            <Text style={styles.bullet}>• {t('activateMissionPost.bullet3')}</Text>
            <Text style={styles.bullet}>• {t('activateMissionPost.bullet4')}</Text>

            <Text style={styles.body}>
              {t('activateMissionPost.bodyFollowers')}
            </Text>

            <Text style={styles.body}>
              {t('activateMissionPost.unlockCta')}
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.launchButton, { backgroundColor: text }]}
            onPress={onLaunch}
          >
            <Text style={styles.launchButtonText}>
              {t('activateMissionPost.launchButton')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.notNowButton, { borderColor: text, backgroundColor: card }]}
            onPress={onClose}
          >
            <Text style={[styles.notNowButtonText, textStyle]}>
              {t('activateMissionPost.notNowButton')}
            </Text>
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
