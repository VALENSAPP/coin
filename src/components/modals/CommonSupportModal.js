import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const CommonSupportModal = ({
  visible,
  onClose,
  title,
  description,
  bullets = [],
  note,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  canSupport,
  variant,
  creatorName,
}) => {
  const { text, card } = useAppTheme();
  const { t } = useLanguage();

  const resolvedPrimaryLabel = primaryLabel || t('commonSupportModal.defaultPrimaryLabel');
  const resolvedSecondaryLabel = secondaryLabel || t('commonSupportModal.defaultSecondaryLabel');

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: card }]}>
          {!!title && (
            <Text style={[styles.title, { color: text }]}>{title}</Text>
          )}

          {!!description && (
            <View>
              {description.includes('\n') ? (
                description.split('\n').map((line, idx) => (
                  <Text
                    key={`desc-${idx}`}
                    style={[
                      styles.description,
                      { textAlign: idx === 0 ? 'center' : 'left' },
                    ]}
                  >
                    {line}
                  </Text>
                ))
              ) : (
                <Text style={styles.description}>{description}</Text>
              )}
            </View>
          )}

          {bullets.length > 0 && (
            <View style={styles.bulletsContainer}>
              {bullets.map((line, idx) => (
                <Text key={`${line}-${idx}`} style={styles.bulletText}>
                  {'\u2022'} {line}
                </Text>
              ))}
            </View>
          )}

          {!!note && <Text style={styles.note}>{note}</Text>}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor:
                    variant === 'disclaimer' && !canSupport ? '#9d9b9b' : text,
                },
              ]}
              onPress={onPrimary}
              disabled={variant === 'disclaimer' && !canSupport}
            >
              <Text style={styles.primaryButtonText}>{resolvedPrimaryLabel}</Text>
            </TouchableOpacity>

            {variant === 'disclaimer' && !canSupport && (
              <Text style={styles.texterror}>
                {t('commonSupportModal.walletNotConnected')}{' '}
                <Text style={{ fontWeight: 'bold' }}>{creatorName}</Text>
                {t('commonSupportModal.onceConnected')}
              </Text>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSecondary || onClose}
            >
              <Text style={styles.secondaryButtonText}>{resolvedSecondaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CommonSupportModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 8, 20, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#5E5E6A',
    textAlign: 'left',
    lineHeight: 21,
  },
  bulletsContainer: {
    marginTop: 12,
    marginBottom: 6,
    gap: 4,
  },
  bulletText: {
    fontSize: 14,
    color: '#4E4E5C',
    lineHeight: 20,
  },
  note: {
    marginTop: 10,
    fontSize: 14,
    color: '#3D3D48',
    lineHeight: 20,
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 18,
  },
  primaryButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5DEEF',
    backgroundColor: '#FAF8FC',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#5A5A67',
    fontWeight: '600',
  },
  texterror: {
    fontSize: 14,
    color: 'red',
    fontWeight: '600',
  }
});
