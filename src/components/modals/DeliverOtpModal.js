import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n';
import { sendDeliveryOtp } from '../../services/myCloset';

const DeliverOtpModal = ({ visible, orderId, onCancel, onSubmit, accent, toast }) => {
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [timer, setTimer] = useState(0);

  const { cardStyle, textStyle, mutedTextStyle, accent: themeAccent } = useAppTheme();
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();

  const buttonAccent = accent || themeAccent;
  const canSubmit = otp.trim().length > 0;

  const handleSendOtp = useCallback(async () => {
    if (!orderId || sendingOtp) return;
    setSendingOtp(true);
    try {
      await sendDeliveryOtp(orderId, 10);
      setTimer(60);
      if (toast?.show) {
        toast.show(t('myClosetOrderDetail.otpSentSuccess') || 'OTP sent to buyer email.', {
          type: 'success',
        });
      }
    } catch (error) {
      if (toast?.show) {
        toast.show(
          error?.response?.data?.message || error?.message || 'Failed to send OTP to buyer.',
          { type: 'danger' }
        );
      }
    } finally {
      setSendingOtp(false);
    }
  }, [orderId, sendingOtp, toast, t]);

  useEffect(() => {
    if (visible && orderId) {
      setOtp('');
      setSubmitting(false);
      handleSendOtp();
    } else {
      setTimer(0);
    }
  }, [visible, orderId]);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  const handleClose = () => {
    setOtp('');
    setSubmitting(false);
    setTimer(0);
    onCancel();
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(otp.trim());
      setOtp('');
    } catch (e) {
      // Error handling managed by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={modalStyles.backdrop}>
        <View
          style={[
            modalStyles.card,
            cardStyle,
            { backgroundColor: isDarkMode ? '#1e1e2d' : '#ffffff' },
          ]}
        >
          <View style={modalStyles.headerRow}>
            <Text style={[modalStyles.title, textStyle]}>
              {t('myClosetOrderDetail.enterDeliveryOtp') || 'Verify Delivery OTP'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={modalStyles.closeButton}>
              <Ionicons name="close" size={20} color={mutedTextStyle?.color || '#9ca3af'} />
            </TouchableOpacity>
          </View>

          <Text style={[modalStyles.subtitle, mutedTextStyle]}>
            {t('myClosetOrderDetail.enterOtpSubtitle') ||
              'An OTP has been sent to the buyer email. Enter the code shared by the buyer to complete delivery.'}
          </Text>

          <Text style={[modalStyles.label, mutedTextStyle]}>
            {t('myClosetOrderDetail.otpLabel') || 'OTP Code'}
          </Text>
          <TextInput
            style={[
              modalStyles.input,
              textStyle,
              {
                borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#e5e7eb',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f9fafb',
              },
            ]}
            placeholder={t('myClosetOrderDetail.otpPlaceholder') || 'e.g. 123456'}
            placeholderTextColor={isDarkMode ? '#6b7280' : '#9ca3af'}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={10}
            autoFocus
          />

          <View style={modalStyles.resendRow}>
            {sendingOtp ? (
              <View style={modalStyles.resendLoading}>
                <ActivityIndicator size="small" color={buttonAccent} />
                <Text style={[modalStyles.resendText, mutedTextStyle]}>Sending OTP...</Text>
              </View>
            ) : timer > 0 ? (
              <Text style={[modalStyles.resendText, mutedTextStyle]}>
                Resend OTP in <Text style={{ color: buttonAccent, fontWeight: '800' }}>{timer}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleSendOtp} activeOpacity={0.8}>
                <Text style={[modalStyles.resendBtnText, { color: buttonAccent }]}>
                  Resend OTP
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={modalStyles.actionsRow}>
            <TouchableOpacity onPress={handleClose} style={modalStyles.cancelBtn}>
              <Text style={[modalStyles.cancelText, mutedTextStyle]}>
                {t('myClosetOrders.keepOrder') || 'Cancel'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              style={[
                modalStyles.submitBtn,
                { backgroundColor: buttonAccent, opacity: canSubmit && !submitting ? 1 : 0.5 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={modalStyles.submitText}>
                  {t('myClosetOrderDetail.verifyAndDeliver') || 'Verify & Deliver'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  resendRow: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  resendLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default DeliverOtpModal;
