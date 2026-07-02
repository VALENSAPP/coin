import React, { useRef, useState, forwardRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { reportPost } from '../../services/post';
import { useLanguage } from '../../i18n';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ReportFlowScreen = forwardRef(({ postId = '', onReported }, ref) => {
  const reasonSheet = useRef(null);
  const confirmSheet = useRef(null);
  const { t } = useLanguage();
  const { card, border, mutedText, accent } = useAppTheme();
  const { isDarkMode } = useThemeContext();

  const sheetTheme = useMemo(() => ({
    backgroundColor: card,
    borderColor: border,
    labelColor: isDarkMode ? '#ffffff' : '#111827',
    mutedColor: mutedText,
    accentColor: accent,
    iconBg: isDarkMode
      ? 'rgba(255,255,255,0.08)'
      : accent === '#C9A15A'
        ? 'rgba(201, 161, 90, 0.12)'
        : 'rgba(90, 45, 130, 0.12)',
    reasonItemBg: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F8F8F8',
    confirmBoxBg: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F8F8F8',
    cancelBorder: isDarkMode ? border : '#E0E0E0',
  }), [card, border, mutedText, accent, isDarkMode]);

  const [selectedReason, setSelectedReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Report reasons built from translation keys so they switch language automatically
  const reportReasons = [
    { id: 1, title: t('reportFlow.reason1'), icon: 'alert-circle' },
    { id: 2, title: t('reportFlow.reason2'), icon: 'alert-circle' },
    { id: 3, title: t('reportFlow.reason3'), icon: 'alert-circle' },
    { id: 4, title: t('reportFlow.reason4'), icon: 'alert-circle' },
    { id: 5, title: t('reportFlow.reason5'), icon: 'alert-circle' },
    { id: 6, title: t('reportFlow.reason6'), icon: 'alert-circle' },
    { id: 7, title: t('reportFlow.reason7'), icon: 'alert-circle' },
  ];

  const handleSelectReason = (reason) => {
    setSelectedReason(reason);
    reasonSheet.current?.close();
    setTimeout(() => confirmSheet.current?.open(), 200);
  };

  const submitReport = async () => {
    if (!postId) {
      Alert.alert(
        t('reportFlow.missingPostIdTitle'),
        t('reportFlow.missingPostIdMessage'),
      );
      return;
    }
    if (!selectedReason) {
      Alert.alert(
        t('reportFlow.noReasonTitle'),
        t('reportFlow.noReasonMessage'),
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await reportPost({
        postId: String(postId),
        reason: selectedReason,
      });

      console.log('Report API Response:', response);
      console.log('Response Data:', response?.data);

      confirmSheet.current?.close();
      setSelectedReason(null);

      onReported?.({ postId: String(postId), reason: selectedReason });

      Alert.alert(
        t('reportFlow.successTitle'),
        t('reportFlow.successMessage'),
      );
    } catch (err) {
      console.log('Report API Error:', err);
      console.log('Error Response:', err?.response);

      Alert.alert(
        t('reportFlow.failedTitle'),
        err?.response?.data?.message || err?.message || 'Something went wrong.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  React.useImperativeHandle(ref, () => ({
    open: () => reasonSheet.current?.open(),
    close: () => reasonSheet.current?.close(),
  }));

  return (
    <>
      {/* Sheet 1 — Select Reason */}
      <RBSheet
        ref={reasonSheet}
        height={480}
        openDuration={200}
        closeOnDragDown={true}
        customStyles={{
          container: {
            ...styles.sheetContainer,
            backgroundColor: sheetTheme.backgroundColor,
          },
          overlay: { backgroundColor: 'rgba(0,0,0,0.4)' },
        }}
      >
        <View style={[styles.dragHandle, { backgroundColor: sheetTheme.borderColor }]} />
        <View style={styles.headerContainer}>
          <View style={[styles.headerIcon, { backgroundColor: sheetTheme.iconBg }]}>
            <Icon name="flag" size={28} color={sheetTheme.accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: sheetTheme.labelColor }]}>
              {t('reportFlow.sheetTitle')}
            </Text>
            <Text style={[styles.sheetSubtitle, { color: sheetTheme.mutedColor }]}>
              {t('reportFlow.sheetSubtitle')}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reasonsContent}
        >
          {reportReasons.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonItem,
                {
                  backgroundColor: sheetTheme.reasonItemBg,
                  borderColor: sheetTheme.borderColor,
                },
              ]}
              onPress={() => handleSelectReason(reason.title)}
            >
              <View style={[styles.reasonIconWrapper, { backgroundColor: sheetTheme.iconBg }]}>
                <Icon name={reason.icon} size={20} color={sheetTheme.accentColor} />
              </View>
              <Text style={[styles.reasonText, { color: sheetTheme.labelColor }]}>
                {reason.title}
              </Text>
              <Icon name="chevron-forward" size={20} color={sheetTheme.mutedColor} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </RBSheet>

      {/* Sheet 2 — Confirm Reason */}
      <RBSheet
        ref={confirmSheet}
        height={400}
        openDuration={200}
        closeOnDragDown={true}
        customStyles={{
          container: {
            ...styles.sheetContainer,
            backgroundColor: sheetTheme.backgroundColor,
          },
          overlay: { backgroundColor: 'rgba(0,0,0,0.4)' },
        }}
      >
        <View style={[styles.dragHandle, { backgroundColor: sheetTheme.borderColor }]} />
        <View style={styles.confirmHeaderContainer}>
          <View style={styles.checkIconWrapper}>
            <Icon name="checkmark-circle" size={50} color={sheetTheme.accentColor} />
          </View>
          <Text style={[styles.confirmTitle, { color: sheetTheme.labelColor }]}>
            {t('reportFlow.confirmTitle')}
          </Text>
          <Text style={[styles.confirmSubtitle, { color: sheetTheme.mutedColor }]}>
            {t('reportFlow.confirmSubtitle')}
          </Text>
        </View>

        <View
          style={[
            styles.confirmContentBox,
            {
              backgroundColor: sheetTheme.confirmBoxBg,
              borderLeftColor: sheetTheme.accentColor,
            },
          ]}
        >
          <Text style={[styles.confirmLabel, { color: sheetTheme.mutedColor }]}>
            {t('reportFlow.reasonLabel')}
          </Text>
          <Text style={[styles.selectedReason, { color: sheetTheme.labelColor }]}>
            {selectedReason}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: sheetTheme.accentColor },
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={submitReport}
          disabled={submitting}
        >
          <Icon name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.submitButtonText}>
            {submitting
              ? t('reportFlow.submittingButton')
              : t('reportFlow.submitButton')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: sheetTheme.cancelBorder }]}
          onPress={() => confirmSheet.current?.close()}
          disabled={submitting}
        >
          <Text style={[styles.cancelButtonText, { color: sheetTheme.mutedColor }]}>
            {t('reportFlow.cancelButton')}
          </Text>
        </TouchableOpacity>
      </RBSheet>
    </>
  );
});

ReportFlowScreen.displayName = "ReportFlowScreen";

export default ReportFlowScreen;

const styles = StyleSheet.create({
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },

  headerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },

  sheetSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  reasonsContent: {
    paddingBottom: 20,
  },

  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },

  reasonIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  reasonText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },

  confirmHeaderContainer: {
    alignItems: "center",
    marginBottom: 24,
  },

  checkIconWrapper: {
    marginBottom: 12,
  },

  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },

  confirmSubtitle: {
    fontSize: 13,
  },

  confirmContentBox: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    borderLeftWidth: 4,
  },

  confirmLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  selectedReason: {
    fontSize: 15,
    fontWeight: "600",
  },

  submitButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 10,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "700",
  },

  cancelButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
