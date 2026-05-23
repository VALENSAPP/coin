import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

export const BusinessPlanModal = ({ visible, onActivate, onContinue, onClose }) => {
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleActivate = async () => {
    setIsLoading(true);
    try {
      await onActivate();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, bgStyle]}>
          <Text style={[styles.title, textStyle]}>
            {t('businessPlanModal.planTitle')}
          </Text>

          <Text style={[styles.message, textStyle, styles.messageMuted]}>
            {t('businessPlanModal.planMessage')}
          </Text>

          <Text style={[styles.price, { color: text }]}>
            {t('businessPlanModal.price')}
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: text }, isLoading && { opacity: 0.75 }]}
            onPress={handleActivate}
            disabled={isLoading}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {isLoading && (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.primaryText}>
                {isLoading
                  ? t('businessPlanModal.activating')
                  : t('businessPlanModal.activateButton')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onContinue} disabled={isLoading}>
            <Text style={[styles.secondaryText, { color: text, opacity: isLoading ? 0.4 : 1 }]}>
              {t('businessPlanModal.continueBasic')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const BusinessReminderModal = ({ visible, onUpgrade, onContinue, onClose }) => {
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      await onUpgrade();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, bgStyle]}>
          <Text style={[styles.title, textStyle]}>
            {t('businessPlanModal.reminderTitle')}
          </Text>

          <Text style={[styles.message, textStyle, styles.messageMuted]}>
            {t('businessPlanModal.reminderMessage')}
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: text }, isLoading && { opacity: 0.75 }]}
            onPress={handleUpgrade}
            disabled={isLoading}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {isLoading && (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.primaryText}>
                {isLoading
                  ? t('businessPlanModal.processing')
                  : t('businessPlanModal.unlockButton')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onContinue}>
            <Text style={[styles.secondaryText, { color: text }]}>
              {t('businessPlanModal.continueBasicLimited')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const BusinessSuccessModal = ({ visible }) => {
  const { bgStyle, textStyle } = useAppTheme();
  const { t } = useLanguage();

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, bgStyle]}>
          <Text style={[styles.title, textStyle]}>
            {t('businessPlanModal.successTitle')}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
    color: '#111827',
  },
  message: {
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
  },
  messageMuted: {
    opacity: 0.85,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#111827',
  },
  primaryBtn: {
    backgroundColor: '#4d2a88',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  secondaryBtn: {
    padding: 10,
  },
  secondaryText: {
    textAlign: 'center',
    fontWeight: '500',
  },
  btnDisabled: {
  opacity: 0.75,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
});
