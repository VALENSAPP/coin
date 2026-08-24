import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../i18n';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';

const CancelOrderModal = ({
  visible,
  onClose,
  order,
  onConfirmCancel,
}) => {
  const { t } = useLanguage();
  const { accent, bgStyle, textStyle, mutedTextStyle } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const REASONS = useMemo(() => [
    { id: 'changedMind', label: t('cancelOrderModal.reasons.changedMind') },
    { id: 'betterPrice', label: t('cancelOrderModal.reasons.betterPrice') },
    { id: 'mistake', label: t('cancelOrderModal.reasons.mistake') },
    { id: 'tooLong', label: t('cancelOrderModal.reasons.tooLong') },
    { id: 'sooner', label: t('cancelOrderModal.reasons.sooner') },
    { id: 'other', label: t('cancelOrderModal.reasons.other') },
  ], [t]);

  const handleCancelAction = async () => {
    setLoading(true);
    try {
      await onConfirmCancel(order, reason, comments);
      setStep(3);
    } catch (error) {
      // Error handled by parent usually
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setReason('');
    setComments('');
    onClose();
  };

  if (!visible || !order) return null;

  const renderStep1 = () => (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }]}>
        <View style={styles.warningIconContainer}>
          <Ionicons name="warning-outline" size={32} color="#dc2626" />
        </View>
        <Text style={[styles.title, textStyle, { textAlign: 'center' }]}>
          {t('cancelOrderModal.confirmTitle')}
        </Text>
        <Text style={[styles.subtitle, mutedTextStyle, { textAlign: 'center', marginBottom: 20 }]}>
          {t('cancelOrderModal.confirmSubtitle')}
        </Text>

        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2c2c2c' : '#f9f5ff' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#e9d5ff' }]}>
            <Ionicons name="document-text-outline" size={20} color="#7c3aed" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, textStyle]}>{t('cancelOrderModal.policyTitle')}</Text>
            <Text style={[styles.infoDesc, mutedTextStyle]}>
              {t('cancelOrderModal.policyDesc')}
            </Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2c2c2c' : '#f0fdf4' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#bbf7d0' }]}>
            <Ionicons name="cash-outline" size={20} color="#16a34a" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, textStyle]}>{t('cancelOrderModal.refundTitle')}</Text>
            <Text style={[styles.infoDesc, mutedTextStyle]}>
              {t('cancelOrderModal.refundDesc')}
            </Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2c2c2c' : '#eff6ff' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#bfdbfe' }]}>
            <Ionicons name="time-outline" size={20} color="#2563eb" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, textStyle]}>{t('cancelOrderModal.timelineTitle')}</Text>
            <Text style={[styles.infoDesc, mutedTextStyle]}>
              {t('cancelOrderModal.timelineDesc')} <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>{t('cancelOrderModal.timelineDescDays')}</Text> {t('cancelOrderModal.timelineDescAfter')}
            </Text>
          </View>
        </View>

        <View style={styles.emailNoteContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
          <Text style={[styles.emailNoteText, mutedTextStyle]}>
            {t('cancelOrderModal.emailNote')}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.outlineButton, { flex: 1, marginRight: 10 }]} onPress={resetAndClose}>
            <Text style={styles.outlineButtonText}>{t('cancelOrderModal.keepOrder')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerButton, { flex: 1 }]} onPress={() => setStep(2)}>
            <Text style={styles.dangerButtonText}>{t('cancelOrderModal.yesCancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: isDarkMode ? '#121212' : '#fcfaff' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={textStyle.color} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>{t('cancelOrderModal.cancelOrderHeader')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.subtitle, mutedTextStyle, { textAlign: 'center', marginBottom: 20 }]}>
          {t('cancelOrderModal.reasonSubtitle')}
        </Text>

        <View style={[styles.orderSummaryCard, { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }]}>
          <View style={styles.summaryTop}>
            <Text style={[styles.orderNumber, mutedTextStyle]}>#{order.orderNumber}</Text>
            {order.isLocalPickup && (
              <View style={styles.pickupBadge}>
                <Text style={styles.pickupBadgeText}>{t('cancelOrderModal.localPickup')}</Text>
              </View>
            )}
          </View>
          <View style={styles.summaryBody}>
            <FastImage source={{ uri: order.image }} style={styles.summaryImage} />
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryTitle, textStyle]} numberOfLines={1}>{order.itemName}</Text>
              <Text style={[styles.summaryPrice, { color: accent }]}>{order.totalAmount}</Text>
              <Text style={[styles.summaryCount, mutedTextStyle]}>{order.itemCount ? t('cancelOrderModal.itemCount', { count: order.itemCount }) : t('cancelOrderModal.itemCount', { count: 1 })}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, textStyle]}>{t('cancelOrderModal.whyCanceling')}</Text>
        <View style={[styles.reasonsContainer, { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }]}>
          {REASONS.map((r, i) => (
            <TouchableOpacity key={i} style={styles.reasonRow} onPress={() => setReason(r.label)}>
              <Ionicons
                name={reason === r.label ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color={reason === r.label ? accent : '#9ca3af'}
              />
              <Text style={[styles.reasonText, textStyle]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, textStyle, { marginTop: 20 }]}>{t('cancelOrderModal.additionalComments')}</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff', color: textStyle.color }]}
          placeholder={t('cancelOrderModal.commentsPlaceholder')}
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          maxLength={250}
          value={comments}
          onChangeText={setComments}
        />
        <Text style={[styles.charCount, mutedTextStyle]}>{comments.length}/250</Text>

        <View style={[styles.nextBox, { backgroundColor: isDarkMode ? '#2c2c2c' : '#f9f5ff' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#e9d5ff' }]}>
            <Ionicons name="mail-outline" size={20} color="#7c3aed" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, textStyle]}>{t('cancelOrderModal.whatNext')}</Text>
            <Text style={[styles.infoDesc, mutedTextStyle]}>
              {t('cancelOrderModal.whatNextDesc')}
            </Text>
          </View>
        </View>

      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: !reason ? '#d1d5db' : accent }]}
          disabled={!reason || loading}
          onPress={handleCancelAction}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>{t('cancelOrderModal.cancelMyOrder')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineButtonFull} onPress={() => setStep(1)}>
          <Text style={styles.outlineButtonText}>{t('cancelOrderModal.goBack')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const renderStep3 = () => (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: isDarkMode ? '#121212' : '#fcfaff', justifyContent: 'center' }]}>
      <View style={styles.successContainer}>
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark" size={40} color="#16a34a" />
        </View>
        <Text style={[styles.successTitle, textStyle]}>{t('cancelOrderModal.successTitle')}</Text>
        <Text style={[styles.successSubtitle, mutedTextStyle]}>
          {t('cancelOrderModal.successSubtitle')}
        </Text>

        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2c2c2c' : '#f0fdf4', marginTop: 30, width: '100%' }]}>
          <View style={[styles.iconBox, { backgroundColor: '#bbf7d0' }]}>
            <Ionicons name="cash-outline" size={20} color="#16a34a" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={[styles.infoTitle, textStyle]}>{t('cancelOrderModal.refundIfApplicable')}</Text>
            <Text style={[styles.infoDesc, mutedTextStyle]}>
              {t('cancelOrderModal.refundIfApplicableDesc')} <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>{t('cancelOrderModal.refundIfApplicableDescDays')}</Text>{t('cancelOrderModal.refundIfApplicableDescAfter')}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: accent, width: '100%', marginTop: 40 }]} onPress={resetAndClose}>
          <Text style={styles.primaryButtonText}>{t('cancelOrderModal.backToPurchases')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <Modal visible={visible} transparent={step === 1} animationType="slide" onRequestClose={resetAndClose}>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  warningIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  emailNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  emailNoteText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  fullScreen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
  },
  orderSummaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickupBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pickupBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: 'bold',
  },
  summaryBody: {
    flexDirection: 'row',
  },
  summaryImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    marginRight: 12,
  },
  summaryInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  reasonsContainer: {
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  reasonText: {
    fontSize: 15,
    marginLeft: 12,
  },
  textInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  nextBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outlineButtonFull: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  successContainer: {
    padding: 30,
    alignItems: 'center',
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
});

export default CancelOrderModal;
