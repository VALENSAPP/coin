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
  return parts.replace(', ', ' • ').replace(', ', ' • ');
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
  if (!value) return t('transactionDetails.valensBalance');
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
    fromName: pickFirst(fromParty.displayName, t('transactionDetails.valensWallet')),
    fromHandle: fromParty.handle,
    toName: pickFirst(toParty.displayName, t('transactionDetails.valensWallet')),
    toHandle: toParty.handle,
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
      icon: 'close',
      title: t('transactionDetails.statusFailed'),
      message: t('transactionDetails.statusMessageFailed', { type: typeLabel }),
    };
  }
  if (status.includes('pend') || status.includes('process')) {
    return {
      color: '#D97706',
      icon: 'time',
      title: t('transactionDetails.statusPending'),
      message: t('transactionDetails.statusMessagePending', { type: typeLabel }),
    };
  }
  return {
    color: '#22C55E',
    icon: 'checkmark',
    title: t('transactionDetails.statusSucceeded'),
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
    details.amountTone === 'positive' ? '#22C55E' : details.amountTone === 'negative' ? '#EF4444' : text;

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

  const row = (label, value, valueColor, valueStyle) => (
    <View style={styles.summaryRow}>
      <Text style={[styles.rowLabel, { color: mutedText }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor || text }, valueStyle]} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={icon || text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>{t('transactionDetails.title')}</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && !details.displayName ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent || text} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileHeader}>
            <HexAvatar
              uri={details.profileImage}
              size={48}
              borderWidth={1.5}
              borderColor={text}
            />
            <View style={styles.profileText}>
              <Text style={[styles.name, { color: accent || text }]} numberOfLines={1}>
                {details.displayName}
              </Text>
              {!!details.handle && (
                <Text style={[styles.handle, { color: mutedText }]} numberOfLines={1}>
                  {details.handle}
                </Text>
              )}
              <Text style={[styles.meta, { color: mutedText }]} numberOfLines={1}>
                {[details.typeLabel, titleCase(details.status)].filter(Boolean).join(' • ')}
              </Text>
            </View>
            <Text style={[styles.headerAmount, { color: amountColor }]}>{details.amount}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusIcon, { backgroundColor: status.color }]}>
                <Ionicons name={status.icon} size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: status.color }]}>{status.title}</Text>
                <Text style={[styles.statusMessage, { color: mutedText }]}>{status.message}</Text>
              </View>
            </View>
            {!!details.date && (
              <>
                <View style={[styles.divider, { backgroundColor: border }]} />
                <Text style={[styles.dateCentered, { color: mutedText }]}>{details.date}</Text>
              </>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: accent || text }]}>
            {t('transactionDetails.summaryTitle')}
          </Text>
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            {row(t('transactionDetails.type'), details.typeLabel, accent || text, styles.boldValue)}
            {row(t('transactionDetails.amount'), details.amount, amountColor, styles.boldValue)}
            {row(t('transactionDetails.fee'), details.fee, mutedText)}
            {!!details.period && row(t('transactionDetails.period'), details.period, mutedText)}
            <View style={[styles.divider, { backgroundColor: border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: text }]}>{t('transactionDetails.total')}</Text>
              <Text style={[styles.totalValue, { color: amountColor }]}>{details.total}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.rowLabel, { color: mutedText }]}>{t('transactionDetails.from')}</Text>
              <View style={styles.toWrap}>
                <Text style={[styles.rowValue, styles.boldValue, { color: accent || text }]} numberOfLines={1}>
                  {details.fromName}
                </Text>
                {!!details.fromHandle && (
                  <Text style={[styles.handle, { color: mutedText, textAlign: 'right' }]} numberOfLines={1}>
                    {details.fromHandle}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.rowLabel, { color: mutedText }]}>{t('transactionDetails.to')}</Text>
              <View style={styles.toWrap}>
                <Text style={[styles.rowValue, styles.boldValue, { color: accent || text }]} numberOfLines={1}>
                  {details.toName}
                </Text>
                {!!details.toHandle && (
                  <Text style={[styles.handle, { color: mutedText, textAlign: 'right' }]} numberOfLines={1}>
                    {details.toHandle}
                  </Text>
                )}
              </View>
            </View>
            {row(t('transactionDetails.paymentMethod'), details.paymentMethod, text, styles.boldValue)}
            <View style={styles.summaryRow}>
              <Text style={[styles.rowLabel, { color: mutedText }]}>{t('transactionDetails.transactionId')}</Text>
              <TouchableOpacity onPress={copyId} style={styles.copyRow} activeOpacity={0.8}>
                <Text style={[styles.txnId, { color: accent || text }]} numberOfLines={1}>
                  {details.transactionId || '—'}
                </Text>
                <Ionicons name="copy-outline" size={16} color={accent || text} />
              </TouchableOpacity>
            </View>
          </View>

          {!!details.note && (
            <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.rowLabel, { color: mutedText, marginBottom: 6 }]}>
                {t('transactionDetails.note')}
              </Text>
              <Text style={[styles.noteText, { color: text }]}>{details.note}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.helpCard, { backgroundColor: `${accent || text}14`, borderColor: `${accent || text}22` }]}
            onPress={openHelp}
            activeOpacity={0.85}
          >
            <View style={[styles.helpIcon, { backgroundColor: accent || text }]}>
              <Ionicons name="help" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.helpTitle, { color: text }]}>{t('transactionDetails.needHelp')}</Text>
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
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 36 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  profileText: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 },
  name: { fontSize: 16, fontWeight: '800' },
  handle: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  meta: { fontSize: 13, marginTop: 2 },
  headerAmount: { fontSize: 18, fontWeight: '800' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 16, fontWeight: '800' },
  statusMessage: { fontSize: 13, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  dateCentered: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  boldValue: { fontWeight: '800' },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: 16, fontWeight: '800' },
  toWrap: { flex: 1, alignItems: 'flex-end' },
  copyRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  txnId: { fontSize: 13, fontWeight: '700', maxWidth: '72%' },
  noteText: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginTop: 4,
    marginBottom: '5%',
  },
  helpIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: { fontSize: 15, fontWeight: '800' },
  helpSubtitle: { fontSize: 12, marginTop: 2 },
});
