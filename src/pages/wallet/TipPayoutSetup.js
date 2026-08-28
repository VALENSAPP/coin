import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { saveTipPayoutSetup, maskAccountNumber } from '../../utils/tipPayoutStorage';
import { primaryCtaColors } from '../../utils/ctaContrast';

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
const BANK_OPTIONS = [
  'Itaú Unibanco',
  'Bradesco',
  'Banco do Brasil',
  'Caixa Econômica',
  'Santander',
  'Nubank',
  'Inter',
];
const ACCOUNT_TYPE_OPTIONS = ['Checking', 'Savings'];

const CONFETTI_DOTS = [
  { top: 8, left: 42, color: '#F87171', size: 8 },
  { top: 18, right: 38, color: '#60A5FA', size: 7 },
  { top: 52, left: 18, color: '#34D399', size: 6 },
  { top: 64, right: 22, color: '#FBBF24', size: 8 },
  { bottom: 12, left: 56, color: '#A78BFA', size: 7 },
  { bottom: 20, right: 48, color: '#F472B6', size: 6 },
];

const PagBankMark = ({ size = 48 }) => (
  <View style={[styles.pagBankMark, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.pagBankMarkText, { fontSize: size * 0.45 }]}>P</Text>
  </View>
);

const TipPayoutSetup = ({ navigation, route }) => {
  const { text, card, border, mutedText, accent, bgStyle, cardStyle } = useAppTheme();
  const { t } = useLanguage();
  const cta = primaryCtaColors(accent || text);
  const fieldBorder = border || '#E5E7EB';

  const inputStyle = {
    borderWidth: 1,
    borderColor: fieldBorder,
    borderRadius: 12,
    backgroundColor: card,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    color: text,
  };

  const fieldSurfaceStyle = {
    borderWidth: 1,
    borderColor: fieldBorder,
    borderRadius: 12,
    backgroundColor: card,
    paddingHorizontal: 14,
    paddingVertical: 14,
  };
  const initialStep = route?.params?.initialStep === 'success' ? 'success' : 'intro';

  const [step, setStep] = useState(initialStep);
  const [legalName, setLegalName] = useState(route?.params?.saved?.legalName || '');
  const [cpfCnpj, setCpfCnpj] = useState(route?.params?.saved?.cpfCnpj || '');
  const [payoutMethod, setPayoutMethod] = useState(route?.params?.saved?.payoutMethod || 'bank');
  const [bank, setBank] = useState(route?.params?.saved?.bank || '');
  const [agency, setAgency] = useState(route?.params?.saved?.agency || '');
  const [accountNumber, setAccountNumber] = useState(route?.params?.saved?.accountNumber || '');
  const [accountType, setAccountType] = useState(route?.params?.saved?.accountType || '');
  const [pixKey, setPixKey] = useState(route?.params?.saved?.pixKey || '');
  const [idDocument, setIdDocument] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [proofOfAddress, setProofOfAddress] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);
  const [pickerModal, setPickerModal] = useState({ visible: false, type: null, options: [] });

  const savedSummary = route?.params?.saved || {};

  const openPicker = (type, options) => {
    setPickerModal({ visible: true, type, options });
  };

  const closePicker = () => setPickerModal({ visible: false, type: null, options: [] });

  const handlePickerSelect = (value) => {
    if (pickerModal.type === 'bank') setBank(value);
    if (pickerModal.type === 'accountType') setAccountType(value);
    closePicker();
  };

  const pickDocument = async (setter, title, useCamera = false) => {
    try {
      const picker = useCamera ? launchCamera : launchImageLibrary;
      const result = await picker({
        mediaType: 'photo',
        selectionLimit: 1,
        cameraType: 'front',
      });
      const asset = result?.assets?.[0];
      if (asset?.fileName || asset?.uri) {
        setter(asset.fileName || t('tipPayoutSetup.fileSelected'));
      }
    } catch {
      Alert.alert(title, t('tipPayoutSetup.uploadFailed'));
    }
  };

  const goDashboard = useCallback(() => {
    navigation.navigate('Dashboard');
  }, [navigation]);

  const handleMaybeLater = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    goDashboard();
  };

  const validateInformation = () => {
    if (!legalName.trim()) {
      Alert.alert(t('tipPayoutSetup.validationTitle'), t('tipPayoutSetup.legalNameRequired'));
      return false;
    }
    return true;
  };

  const validatePayout = () => {
    if (payoutMethod === 'pix') {
      if (!pixKey.trim()) {
        Alert.alert(t('tipPayoutSetup.validationTitle'), t('tipPayoutSetup.pixKeyRequired'));
        return false;
      }
      return true;
    }
    if (!bank || !agency.trim() || !accountNumber.trim() || !accountType) {
      Alert.alert(t('tipPayoutSetup.validationTitle'), t('tipPayoutSetup.bankFieldsRequired'));
      return false;
    }
    return true;
  };

  const finishSetup = async () => {
    const payload = {
      legalName: legalName.trim(),
      cpfCnpj: cpfCnpj.trim(),
      payoutMethod,
      bank: payoutMethod === 'bank' ? bank : '',
      agency: payoutMethod === 'bank' ? agency.trim() : '',
      accountNumber: payoutMethod === 'bank' ? accountNumber.trim() : '',
      accountType: payoutMethod === 'bank' ? accountType : '',
      pixKey: payoutMethod === 'pix' ? pixKey.trim() : '',
      maskedAccount: maskAccountNumber(accountNumber),
    };
    await saveTipPayoutSetup(payload);
    setCompletedSummary(payload);
    setStep('success');
  };

  const introBullets = useMemo(() => [
    t('tipPayoutSetup.bullet1'),
    t('tipPayoutSetup.bullet2'),
    t('tipPayoutSetup.bullet3'),
  ], [t]);

  const renderUploadField = (label, placeholder, value, onPress, iconName = 'document-text-outline') => (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.uploadField, fieldSurfaceStyle]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Ionicons name={iconName} size={18} color={text} />
        <Text
          style={[
            styles.uploadPlaceholder,
            { color: mutedText },
            value && { color: text },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="arrow-up-outline" size={20} color={mutedText} />
      </TouchableOpacity>
    </View>
  );

  const renderIntro = () => (
    <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color: text }]}>{t('tipPayoutSetup.connectTitle')}</Text>
      <Text style={[styles.screenSubtitle, { color: mutedText }]}>{t('tipPayoutSetup.connectSubtitle')}</Text>

      <View style={styles.flowGraphic}>
        <View style={[styles.flowIconWrap, { backgroundColor: withAlpha(text, 0.12) }]}>
          <Ionicons name="settings-outline" size={28} color={text} />
        </View>
        <View style={[styles.flowDash, { borderColor: withAlpha(text, 0.35) }]} />
        <PagBankMark size={52} />
        <View style={[styles.flowDash, { borderColor: withAlpha(text, 0.35) }]} />
        <View style={[styles.flowIconWrap, { backgroundColor: withAlpha(text, 0.12) }]}>
          <Ionicons name="business-outline" size={28} color={mutedText} />
        </View>
      </View>

      {introBullets.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Ionicons name="checkmark-circle" size={20} color={text} />
          <Text style={[styles.bulletText, { color: text }]}>{item}</Text>
        </View>
      ))}

      <Text style={[styles.legalNote, { color: mutedText }]}>{t('tipPayoutSetup.legalNote')}</Text>

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: cta.backgroundColor }]} onPress={() => setStep('information')}>
        <Text style={[styles.primaryBtnText, { color: cta.color }]}>{t('tipPayoutSetup.continue')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={handleMaybeLater}>
        <Text style={[styles.secondaryBtnText, { color: text }]}>{t('tipPayoutSetup.maybeLater')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderInformation = () => (
    <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.screenTitle, { color: text }]}>{t('tipPayoutSetup.infoTitle')}</Text>
      <Text style={[styles.screenSubtitle, { color: mutedText }]}>{t('tipPayoutSetup.infoSubtitle')}</Text>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: text }]}>{t('tipPayoutSetup.legalNameLabel')}</Text>
        <TextInput
          style={inputStyle}
          placeholder={t('tipPayoutSetup.legalNamePlaceholder')}
          placeholderTextColor={mutedText}
          value={legalName}
          onChangeText={setLegalName}
        />
      </View>

      <View style={styles.fieldBlock}>
        <Text style={[styles.fieldLabel, { color: text }]}>{t('tipPayoutSetup.cpfLabel')}</Text>
        <TextInput
          style={inputStyle}
          placeholder={t('tipPayoutSetup.cpfPlaceholder')}
          placeholderTextColor={mutedText}
          value={cpfCnpj}
          onChangeText={setCpfCnpj}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: cta.backgroundColor }]}
        onPress={() => validateInformation() && setStep('payout')}
      >
        <Text style={[styles.primaryBtnText, { color: cta.color }]}>{t('tipPayoutSetup.continue')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={handleMaybeLater}>
        <Text style={[styles.secondaryBtnText, { color: text }]}>{t('tipPayoutSetup.maybeLater')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPayout = () => (
    <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[styles.screenTitle, { color: text }]}>{t('tipPayoutSetup.payoutTitle')}</Text>
      <Text style={[styles.screenSubtitle, { color: mutedText }]}>{t('tipPayoutSetup.payoutSubtitle')}</Text>

      <View style={[styles.tabRow, { backgroundColor: withAlpha(text, 0.12) }]}>
        <TouchableOpacity
          style={[styles.tabBtn, payoutMethod === 'bank' && { backgroundColor: cta.backgroundColor }]}
          onPress={() => setPayoutMethod('bank')}
        >
          <Text style={[styles.tabBtnText, { color: text }, payoutMethod === 'bank' && { color: cta.color }]}>
            {t('tipPayoutSetup.bankAccountTab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, payoutMethod === 'pix' && { backgroundColor: cta.backgroundColor }]}
          onPress={() => setPayoutMethod('pix')}
        >
          <Text style={[styles.tabBtnText, { color: text }, payoutMethod === 'pix' && { color: cta.color }]}>
            {t('tipPayoutSetup.pixKeyTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {payoutMethod === 'bank' ? (
        <>
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: text }]}>{t('tipPayoutSetup.bankLabel')}</Text>
            <TouchableOpacity style={[styles.selectField, fieldSurfaceStyle]} onPress={() => openPicker('bank', BANK_OPTIONS)}>
              <Text style={[styles.selectText, { color: bank ? text : mutedText }]}>
                {bank || t('tipPayoutSetup.bankPlaceholder')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={mutedText} />
            </TouchableOpacity>
          </View>
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: text }]}>{t('tipPayoutSetup.agencyLabel')}</Text>
            <TextInput
              style={inputStyle}
              placeholder={t('tipPayoutSetup.agencyPlaceholder')}
              placeholderTextColor={mutedText}
              value={agency}
              onChangeText={setAgency}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: text }]}>{t('tipPayoutSetup.accountNumberLabel')}</Text>
            <TextInput
              style={inputStyle}
              placeholder={t('tipPayoutSetup.accountNumberPlaceholder')}
              placeholderTextColor={mutedText}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: text }]}>{t('tipPayoutSetup.accountTypeLabel')}</Text>
            <TouchableOpacity
              style={[styles.selectField, fieldSurfaceStyle]}
              onPress={() => openPicker('accountType', ACCOUNT_TYPE_OPTIONS)}
            >
              <Text style={[styles.selectText, { color: accountType ? text : mutedText }]}>
                {accountType || t('tipPayoutSetup.accountTypePlaceholder')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={mutedText} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: text }]}>{t('tipPayoutSetup.pixKeyLabel')}</Text>
          <TextInput
            style={inputStyle}
            placeholder={t('tipPayoutSetup.pixKeyPlaceholder')}
            placeholderTextColor={mutedText}
            value={pixKey}
            onChangeText={setPixKey}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: cta.backgroundColor }]}
        onPress={() => validatePayout() && setStep('verify')}
      >
        <Text style={[styles.primaryBtnText, { color: cta.color }]}>{t('tipPayoutSetup.continue')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={handleMaybeLater}>
        <Text style={[styles.secondaryBtnText, { color: text }]}>{t('tipPayoutSetup.maybeLater')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderVerify = () => (
    <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
      <Text style={[styles.screenTitle, { color: text }]}>{t('tipPayoutSetup.verifyTitle')}</Text>
      <Text style={[styles.screenSubtitle, { color: mutedText }]}>{t('tipPayoutSetup.verifySubtitle')}</Text>

      {renderUploadField(
        t('tipPayoutSetup.idDocumentLabel'),
        t('tipPayoutSetup.idDocumentPlaceholder'),
        idDocument,
        () => pickDocument(setIdDocument, t('tipPayoutSetup.idDocumentLabel')),
        'document-text-outline',
      )}
      {renderUploadField(
        t('tipPayoutSetup.selfieLabel'),
        t('tipPayoutSetup.selfiePlaceholder'),
        selfie,
        () => pickDocument(setSelfie, t('tipPayoutSetup.selfieLabel'), true),
        'camera-outline',
      )}
      {renderUploadField(
        t('tipPayoutSetup.proofOfAddressLabel'),
        t('tipPayoutSetup.proofOfAddressPlaceholder'),
        proofOfAddress,
        () => pickDocument(setProofOfAddress, t('tipPayoutSetup.proofOfAddressLabel')),
        'document-text-outline',
      )}

      <View style={styles.secureRow}>
        <Ionicons name="lock-closed" size={14} color={mutedText} />
        <Text style={[styles.secureText, { color: mutedText }]}>{t('tipPayoutSetup.secureNote')}</Text>
      </View>

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: cta.backgroundColor }]} onPress={finishSetup}>
        <Text style={[styles.primaryBtnText, { color: cta.color }]}>{t('tipPayoutSetup.continue')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={handleMaybeLater}>
        <Text style={[styles.secondaryBtnText, { color: text }]}>{t('tipPayoutSetup.maybeLater')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSuccess = () => {
    const summary = completedSummary || (savedSummary?.connected ? savedSummary : null) || {
      payoutMethod,
      bank,
      accountNumber,
      pixKey,
      maskedAccount: maskAccountNumber(accountNumber),
    };

    const payoutMethodLabel = summary.payoutMethod === 'pix'
      ? t('tipPayoutSetup.pixKeyTab')
      : t('tipPayoutSetup.bankAccountTab');

    return (
      <ScrollView contentContainerStyle={[styles.scrollBody, styles.successBody]} showsVerticalScrollIndicator={false}>
        <View style={styles.successIconWrap}>
          {CONFETTI_DOTS.map((dot, index) => (
            <View
              key={`confetti-${index}`}
              style={[
                styles.confettiDot,
                {
                  backgroundColor: dot.color,
                  width: dot.size,
                  height: dot.size,
                  borderRadius: dot.size / 2,
                  top: dot.top,
                  left: dot.left,
                  right: dot.right,
                  bottom: dot.bottom,
                },
              ]}
            />
          ))}
          <View style={[styles.successIconCircle, { backgroundColor: withAlpha(text, 0.12) }]}>
            <Ionicons name="checkmark" size={44} color={text} />
          </View>
        </View>

        <Text style={[styles.screenTitle, styles.successTitle, { color: text }]}>{t('tipPayoutSetup.successTitle')}</Text>
        <Text style={[styles.screenSubtitle, styles.successSubtitle, { color: mutedText }]}>{t('tipPayoutSetup.successSubtitle')}</Text>

        <View style={[styles.summaryCard, { backgroundColor: withAlpha(text, 0.08) }]}>
          <SummaryRow label={t('tipPayoutSetup.summaryPayoutMethod')} value={payoutMethodLabel} text={text} mutedText={mutedText} border={fieldBorder} />
          <SummaryRow
            label={t('tipPayoutSetup.summaryBank')}
            value={summary.payoutMethod === 'pix' ? '—' : (summary.bank || '—')}
            text={text}
            mutedText={mutedText}
            border={fieldBorder}
          />
          <SummaryRow
            label={t('tipPayoutSetup.summaryAccount')}
            value={summary.payoutMethod === 'pix' ? '—' : (summary.maskedAccount || maskAccountNumber(summary.accountNumber))}
            text={text}
            mutedText={mutedText}
            border={fieldBorder}
          />
          <SummaryRow
            label={t('tipPayoutSetup.summaryPixKey')}
            value={summary.payoutMethod === 'pix' ? (summary.pixKey || '—') : '—'}
            text={text}
            mutedText={mutedText}
            border={fieldBorder}
            isLast
          />
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: cta.backgroundColor }]} onPress={goDashboard}>
          <Text style={[styles.primaryBtnText, { color: cta.color }]}>{t('tipPayoutSetup.goToDashboard')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, bgStyle]}>
      {step === 'intro' && renderIntro()}
      {step === 'information' && renderInformation()}
      {step === 'payout' && renderPayout()}
      {step === 'verify' && renderVerify()}
      {step === 'success' && renderSuccess()}

      <Modal visible={pickerModal.visible} transparent animationType="fade" onRequestClose={closePicker}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closePicker}>
          <View style={[styles.modalSheet, cardStyle]}>
            <FlatList
              data={pickerModal.options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, { borderBottomColor: withAlpha(text, 0.08) }]}
                  onPress={() => handlePickerSelect(item)}
                >
                  <Text style={[styles.modalOptionText, { color: text }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const SummaryRow = ({ label, value, isLast = false, text, mutedText, border }) => (
  <View style={[styles.summaryRow, isLast && styles.summaryRowLast, border && { borderBottomColor: border }]}>
    <Text style={[styles.summaryLabel, { color: mutedText }]}>{label}</Text>
    <Text style={[styles.summaryValue, { color: text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  screenSubtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  flowGraphic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    paddingVertical: 12,
  },
  flowIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowDash: {
    width: 28,
    height: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginHorizontal: 6,
  },
  pagBankMark: {
    backgroundColor: '#1FAF5A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagBankMarkText: {
    color: '#111827',
    fontWeight: '900',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  legalNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 24,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 15,
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  uploadField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadPlaceholder: {
    flex: 1,
    fontSize: 14,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    marginTop: 4,
  },
  secureText: {
    fontSize: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  successIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 12,
    width: 120,
    height: 120,
    alignSelf: 'center',
    position: 'relative',
  },
  confettiDot: {
    position: 'absolute',
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBody: {
    alignItems: 'stretch',
  },
  successTitle: {
    textAlign: 'center',
  },
  successSubtitle: {
    textAlign: 'center',
    marginBottom: 28,
  },
  summaryCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '50%',
    paddingBottom: 20,
  },
  modalOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
  },
});

export default TipPayoutSetup;
