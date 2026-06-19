import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

export default function ProfileVerificationReminderModal({
  visible,
  locked = false,
  profileType = 'user',
  onDoNow,
  onLater,
}) {
  const normalizedProfileType = String(profileType || '').toLowerCase();
  const themeProfileType =
    normalizedProfileType === 'company' || normalizedProfileType === 'business'
      ? 'company'
      : 'user';
  const { bg, text, card, mutedText, accent } = useAppTheme(themeProfileType);
  const verificationType = themeProfileType === 'company' ? 'KYB' : 'KYC';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!locked && typeof onLater === 'function') onLater();
      }}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: card }]}>
          <View style={[styles.iconWrap, { backgroundColor: accent }]}>
            <Text style={styles.icon}>!</Text>
          </View>

          <Text style={[styles.title, { color: text }]}>
            {locked ? 'Your account is blocked' : 'Verify your profile'}
          </Text>

          <Text style={[styles.message, { color: mutedText }]}>
            {locked
              ? `Complete your ${verificationType} to unlock your account.`
              : `Finish your ${verificationType}, to be able to be a verified profile. All Valens profiles are verified.`}
          </Text>

          <Text style={[styles.subMessage, { color: mutedText }]}>
            {locked
              ? 'Your account is blocked because profile verification was not completed within 3 days.'
              : 'If you do not complete it within 3 days, your profile will be locked until verification is finished.'}
          </Text>

          <View style={styles.actions}>
            {!locked && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onLater}
                style={[styles.button, styles.laterButton, { backgroundColor: bg }]}
              >
                <Text style={[styles.laterText, { color: text }]}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onDoNow}
              style={[
                styles.button,
                styles.primaryButton,
                { backgroundColor: accent },
                locked && styles.primaryButtonFull,
              ]}
            >
              <Text style={styles.primaryText}>Do it now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5A2D82',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  laterButton: {
    backgroundColor: '#F3F4F6',
  },
  laterText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#5A2D82',
  },
  primaryButtonFull: {
    flex: 0,
    width: '100%',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});
