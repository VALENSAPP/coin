import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';

import HexAvatar from '../../components/home/story.js/HexAvatar';
import { showToastMessage } from '../../components/displaytoastmessage';
import { getTransactionDetails } from '../../services/wallet';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { resolveTransactionDirection } from '../../utils/transactionAmount';
import { Dragonfly } from '../../assets/icons';
import { navigateToUserProfile } from '../../utils/navigateToUserProfile';

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const toNumber = value => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatMoney = (value, { signed = false, tone } = {}) => {
  const amount = Math.abs(toNumber(value));
  const formatted = `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  if (!signed) return formatted;
  if (tone === 'positive') return `+${formatted}`;
  if (tone === 'negative') return `-${formatted}`;
  return formatted;
};

const formatDetailDate = value => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return parts.replace(', ', ' at ').replace(', ', ' at ');
};

const titleCase = value =>
  String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();

const formatHandle = value => {
  const raw = String(value || '').trim().replace(/^@/, '');
  return raw ? `@${raw}` : '';
};

const formatTypeLabel = (raw, t) => {
  const lowered = String(raw || '').trim().toLowerCase();
  if (!lowered) return t('transactionDetails.defaultType');
  if (lowered === 'following' || lowered === 'payfollowing' || lowered.includes('follow')) {
    return t('transactionDetails.typeFollowing');
  }
  if (lowered === 'tip') return t('transactionDetails.typeTip');
  if (lowered === 'donation' || lowered.includes('mission')) return t('transactionDetails.typeDonation');
  return titleCase(raw);
};

const formatPaymentMethod = (raw, t) => {
  const value = String(raw || '').trim();
  if (!value) return 'Stripe'; // Default to Stripe as per image style if not present or just Valens balance
  if (value.toLowerCase() === 'stripe') return 'Stripe';
  if (value.toLowerCase() === 'valens' || value.toLowerCase().includes('balance')) {
    return t('transactionDetails.valensBalance');
  }
  return titleCase(value);
};

const partyFrom = (obj = {}) => ({
  id: pickFirst(obj.id, obj._id, obj.userId, ''),
  displayName: pickFirst(obj.displayName, obj.name, obj.fullName, ''),
  handle: formatHandle(pickFirst(obj.userName, obj.username, '')),
  image: pickFirst(obj.image, obj.avatar, obj.profilePicture, ''),
});

const unwrapPayload = payload => {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.paymentId || payload.transactionId || payload.from || payload.to) return payload;
  if (payload.data && typeof payload.data === 'object') return unwrapPayload(payload.data);
  return payload;
};

const normalizeDetails = (payload, preview = {}, t) => {
  const data = unwrapPayload(payload);
  const previewSafe = preview && typeof preview === 'object' ? preview : {};
  const fromParty = partyFrom(data.from || {});
  const toParty = partyFrom(data.to || {});
  const directionRaw = String(pickFirst(data.direction, previewSafe.direction, '')).toUpperCase();
  const direction = resolveTransactionDirection({
    ...previewSafe,
    ...data,
    direction: data.direction || previewSafe.direction,
  });
  const isReceived = direction === 'credit' || directionRaw === 'RECEIVED';
  const typeLabel = formatTypeLabel(
    pickFirst(data.type, data.source, previewSafe.typeLabel, previewSafe.type),
    t,
  );
  const statusRaw = String(pickFirst(data.status, previewSafe.status, 'succeeded')).toLowerCase();
  const amountValue = pickFirst(data.amount, data.amountUsd, previewSafe.amountValue, 0);
  const feeValue = pickFirst(data.fee, 0);
  const totalValue = pickFirst(data.total, toNumber(amountValue) + toNumber(feeValue));
  const amountTone = isReceived ? 'positive' : 'negative';
  const counterpart = isReceived ? fromParty : toParty;
  const headerName = pickFirst(
    counterpart.displayName,
    isReceived ? toParty.displayName : fromParty.displayName,
    previewSafe.profileDisplayName,
    previewSafe.title,
    t('transactionDetails.valensWallet'),
  );
  const headerHandle = pickFirst(counterpart.handle, formatHandle(previewSafe.profileUserName), '');
  const period =
    data.periodStart && data.periodEnd
      ? `${formatDetailDate(data.periodStart)} – ${formatDetailDate(data.periodEnd)}`
      : '';

  return {
    displayName: headerName,
    handle: headerHandle,
    typeLabel,
    status: statusRaw,
    isReceived,
    amount: formatMoney(amountValue, { signed: true, tone: amountTone }),
    fee: formatMoney(feeValue, { signed: true, tone: 'negative' }),
    total: formatMoney(totalValue, { signed: true, tone: amountTone }),
    amountTone,
    date: formatDetailDate(pickFirst(data.createdAt, previewSafe.createdAt)) || previewSafe.date || '',
    period,
    fromId: fromParty.id,
    fromName: pickFirst(fromParty.displayName, t('transactionDetails.valensWallet')),
    fromHandle: fromParty.handle,
    fromImage: fromParty.image,
    toId: toParty.id,
    toName: pickFirst(toParty.displayName, t('transactionDetails.valensWallet')),
    toHandle: toParty.handle,
    toImage: toParty.image,
    paymentMethod: formatPaymentMethod(data.paymentMethod, t),
    transactionId: String(pickFirst(data.transactionId, data.paymentId, previewSafe.paymentId, previewSafe.key, '')),
    paymentId: String(pickFirst(data.paymentId, previewSafe.paymentId, '')),
    note: pickFirst(data.note, data.description, data.memo, data.message, previewSafe.note, ''),
    profileImage: pickFirst(
      counterpart.image,
      isReceived ? fromParty.image : toParty.image,
      previewSafe.profileImage,
      '',
    ),
  };
};

const statusMeta = (status, typeLabel, isReceived, t) => {
  if (status.includes('fail') || status.includes('cancel') || status.includes('error')) {
    return {
      color: '#EF4444',
      bg: '#FEE2E2',
      icon: 'close',
      title: t('transactionDetails.statusFailed'),
      label: 'Failed',
      message: t('transactionDetails.statusMessageFailed', { type: typeLabel }),
    };
  }
  if (status.includes('pend') || status.includes('process')) {
    return {
      color: '#D97706',
      bg: '#FEF3C7',
      icon: 'time',
      title: t('transactionDetails.statusPending'),
      label: 'Pending',
      message: t('transactionDetails.statusMessagePending', { type: typeLabel }),
    };
  }
  return {
    color: '#22C55E',
    bg: '#DCFCE7',
    icon: 'checkmark',
    title: t('transactionDetails.statusSucceeded'),
    label: 'Completed',
    message: isReceived
      ? t('transactionDetails.statusMessageReceived', { type: typeLabel })
      : t('transactionDetails.statusMessageSucceeded', { type: typeLabel }),
  };
};

export default function TransactionDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { t } = useLanguage();
  const { bg, bgStyle, text, card, border, mutedText, accent, icon } = useAppTheme();

  const paymentId = pickFirst(route?.params?.paymentId, route?.params?.id, '');
  const preview = route?.params?.preview || {};

  const [details, setDetails] = useState(() => normalizeDetails({}, preview, t));
  const [loading, setLoading] = useState(true);

  const loadDetails = useCallback(async () => {
    if (!paymentId) {
      setLoading(false);
      showToastMessage(toast, 'danger', t('transactionDetails.missingId'));
      return;
    }
    try {
      setLoading(true);
      const response = await getTransactionDetails(paymentId);
      if (response?.error || (response?.statusCode && response.statusCode >= 400 && !response?.success)) {
        throw new Error(response?.message || t('transactionDetails.loadFailed'));
      }
      setDetails(normalizeDetails(response, preview, t));
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('transactionDetails.loadFailed'),
      );
      setDetails(normalizeDetails({}, preview, t));
    } finally {
      setLoading(false);
    }
  }, [paymentId, preview, t, toast]);

  useFocusEffect(
    useCallback(() => {
      loadDetails();
    }, [loadDetails]),
  );

  const status = useMemo(
    () => statusMeta(details.status, details.typeLabel, details.isReceived, t),
    [details.status, details.typeLabel, details.isReceived, t],
  );

  const amountColor =
    details.amountTone === 'positive' ? '#22C55E' : details.amountTone === 'negative' ? text : text;

  const copyId = () => {
    if (!details.transactionId) return;
    Clipboard.setString(details.transactionId);
    showToastMessage(toast, 'success', t('transactionDetails.copied'));
  };

  const openHelp = () => {
    const email = 'Support@valens.app';
    const url = `mailto:${email}?subject=${encodeURIComponent(t('settings.helpEmailSubject'))}&body=${encodeURIComponent(t('settings.helpEmailBody'))}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('settings.error'), t('settings.noMailApp'));
    });
  };

  const handleProfilePress = (userId) => {
    if (!userId) return;
    navigateToUserProfile(navigation, userId, {
      returnTo: 'TransactionDetails',
      returnParams: route.params,
    });
  };

  const StatusBadge = () => (
    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
      <Ionicons name={status.icon} size={14} color={status.color} />
      <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
    </View>
  );

  const row = (iconName, label, value, valueColor, valueStyle, labelStyle) => (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <View style={styles.detailIconContainer}>
          <Ionicons name={iconName} size={18} color={accent || text} style={{ opacity: 0.7 }} />
        </View>
        <Text style={[styles.detailLabel, { color: mutedText }, labelStyle]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: valueColor || text }, valueStyle]} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: 'transparent' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={accent || text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: accent || text }]}>Transaction Receipt</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && !details.displayName ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent || text} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.receiptCard, { backgroundColor: card }]}>
            
            {/* Top Logo and Status */}
            <View style={styles.cardHeader}>
              <View style={styles.logoContainer}>
                {Dragonfly ? (
                  <Dragonfly width={32} height={32} color={accent || '#5B21B6'} />
                ) : (
                  <Ionicons name="color-wand" size={28} color={accent || '#5B21B6'} />
                )}
                <Text style={[styles.logoText, { color: accent || '#5B21B6' }]}>VALENS</Text>
              </View>
              <StatusBadge />
            </View>

            {/* Title and Date Row */}
            <View style={styles.titleRow}>
              <View style={styles.titleLeft}>
                <Text style={[styles.successTitle, { color: accent || text }]}>
                  {details.status === 'succeeded' ? 'Transaction successful' : status.title}
                </Text>
                <Text style={[styles.successSubtitle, { color: mutedText }]}>
                  Thank you for using Valens.
                </Text>
              </View>
              <View style={styles.titleRight}>
                <Text style={[styles.receiptDateLabel, { color: mutedText }]}>Receipt Date</Text>
                <Text style={[styles.receiptDateValue, { color: text }]}>{details.date}</Text>
              </View>
            </View>

            {/* Transaction ID Box */}
            <View style={[styles.txnBox, { backgroundColor: `${accent}10` || '#F3F0FF' }]}>
              <View style={styles.txnIconWrap}>
                <Ionicons name="document-text-outline" size={20} color={accent || '#5B21B6'} />
              </View>
              <View style={styles.txnTextWrap}>
                <Text style={[styles.txnLabel, { color: mutedText }]}>Transaction ID</Text>
                <Text style={[styles.txnValue, { color: accent || '#5B21B6' }]} numberOfLines={1}>
                  {details.transactionId || '—'}
                </Text>
              </View>
              <TouchableOpacity onPress={copyId} style={styles.copyBtn} hitSlop={10}>
                <Ionicons name="copy-outline" size={20} color={accent || '#5B21B6'} />
              </TouchableOpacity>
            </View>

            {/* From / To Section */}
            <View style={styles.partiesRow}>
              <View style={styles.partyCol}>
                <Text style={[styles.partyLabel, { color: mutedText }]}>From</Text>
                <TouchableOpacity 
                  style={styles.partyProfile}
                  onPress={() => handleProfilePress(details.fromId)}
                  activeOpacity={details.fromId ? 0.7 : 1}
                >
                  <HexAvatar uri={details.fromImage} size={44} borderWidth={1} borderColor={border} />
                  <View style={styles.partyInfo}>
                    <Text style={[styles.partyName, { color: accent || text }]} numberOfLines={1}>
                      {details.fromName}
                    </Text>
                    {!!details.fromHandle && (
                      <Text style={[styles.partyHandle, { color: mutedText }]} numberOfLines={1}>
                        {details.fromHandle}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              
              <View style={styles.arrowContainer}>
                <View style={[styles.arrowCircle, { backgroundColor: `${accent}15` || '#F3F0FF' }]}>
                  <Ionicons name="arrow-forward" size={16} color={accent || '#5B21B6'} />
                </View>
              </View>
              
              <View style={styles.partyCol}>
                <Text style={[styles.partyLabel, { color: mutedText, textAlign: 'right' }]}>To</Text>
                <TouchableOpacity 
                  style={styles.partyProfileRight}
                  onPress={() => handleProfilePress(details.toId)}
                  activeOpacity={details.toId ? 0.7 : 1}
                >
                  <HexAvatar uri={details.toImage} size={44} borderWidth={1} borderColor={border} />
                  <View style={styles.partyInfoRight}>
                    <Text style={[styles.partyName, { color: accent || text }]} numberOfLines={1}>
                      {details.toName}
                    </Text>
                    {!!details.toHandle && (
                      <Text style={[styles.partyHandle, { color: mutedText }]} numberOfLines={1}>
                        {details.toHandle}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: border }]} />

            {/* Details List */}
            <View style={styles.detailsList}>
              {row('heart-outline', 'Type', details.typeLabel, accent || text, styles.boldValue)}
              {row('time-outline', 'Amount', details.amount, amountColor, styles.boldValue)}
              {/* {row('pie-chart-outline', 'Valens Fee (5%)', details.fee, text, styles.boldValue)} */}
              {row('calendar-outline', 'Total Received', details.total, amountColor, styles.totalValue, styles.totalLabel)}
              {row('card-outline', 'Payment Method', details.paymentMethod, accent || text, styles.boldValue)}
              {row('calendar-outline', 'Date & Time', details.date, text, styles.boldValue)}
              
              {/* Custom Status Row */}
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <View style={styles.detailIconContainer}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={accent || text} style={{ opacity: 0.7 }} />
                  </View>
                  <Text style={[styles.detailLabel, { color: mutedText }]}>Status</Text>
                </View>
                <StatusBadge />
              </View>
            </View>

            {/* Official Receipt Notice */}
            <View style={[styles.noticeBox, { backgroundColor: `${accent}10` || '#F3F0FF' }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={accent || '#5B21B6'} style={styles.noticeIcon} />
              <View style={styles.noticeTextWrap}>
                <Text style={[styles.noticeTitle, { color: accent || '#5B21B6' }]}>
                  This is an official receipt for your records.
                </Text>
                <Text style={[styles.noticeBody, { color: mutedText }]}>
                  No physical goods or services were provided in exchange for this donation.
                </Text>
              </View>
            </View>

          </View>

          <TouchableOpacity
            style={[styles.helpCard, { backgroundColor: card }]}
            onPress={openHelp}
            activeOpacity={0.85}
          >
            <View style={[styles.helpIcon, { backgroundColor: accent || text }]}>
              <Ionicons name="help" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.helpTitle, { color: accent || text }]}>{t('transactionDetails.needHelp')}</Text>
              <Text style={[styles.helpSubtitle, { color: mutedText }]}>{t('transactionDetails.helpBody')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={mutedText} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9F8FD' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 36 },
  
  receiptCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  titleLeft: {
    flex: 1,
    paddingRight: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 12,
  },
  titleRight: {
    alignItems: 'flex-end',
  },
  receiptDateLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  receiptDateValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  
  txnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  txnIconWrap: {
    marginRight: 12,
  },
  txnTextWrap: {
    flex: 1,
  },
  txnLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  txnValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  copyBtn: {
    padding: 4,
  },
  
  partiesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  partyCol: {
    flex: 1,
  },
  partyLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  partyProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyInfo: {
    marginLeft: 8,
    flex: 1,
  },
  partyProfileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  partyInfoRight: {
    marginLeft: 8,
    flex: 1,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '800',
  },
  partyHandle: {
    fontSize: 11,
    marginTop: 2,
  },
  
  arrowContainer: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: 44, // Match avatar height
    marginTop: 24, // Push down below label
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 20,
    opacity: 0.5,
  },
  
  detailsList: {
    gap: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
  },
  boldValue: {
    fontWeight: '700',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5B21B6',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  
  noticeBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  noticeIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  noticeTextWrap: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  helpIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: { fontSize: 15, fontWeight: '800' },
  helpSubtitle: { fontSize: 12, marginTop: 2 },
});
