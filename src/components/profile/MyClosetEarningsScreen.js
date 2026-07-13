import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { getEarning, getEarningHistory } from '../../services/myCloset';

const formatMoney = value => {
  if (value == null || value === '') return '$0.00';
  const text = String(value).trim();
  if (text.startsWith('$')) return text;
  const number = Number(text);
  if (Number.isNaN(number)) return text;
  return `$${number.toFixed(2)}`;
};

const unwrapResponse = source => {
  const data = source?.data ?? source;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data.data ?? data;
  }
  return data;
};

const normalizeHistory = source => {
  const payload = source?.data ?? source;
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.history)
          ? payload.history
          : Array.isArray(payload?.data?.data)
            ? payload.data.data
            : [];
  return Array.isArray(items) ? items : [];
};

const parseHistoryItem = item => {
  const amount = item?.netEarnings ?? item?.totalAmountPaid ?? item?.amount ?? item?.value ?? 0;
  const date = item?.paymentDate || item?.paidAt || item?.createdAt || item?.updatedAt || item?.date;
  const status = item?.paymentStatus || item?.status || item?.state || 'Paid';
  return {
    id: String(item?.id ?? item?._id ?? `${date}-${amount}`),
    date: date ? new Date(date) : null,
    amount: formatMoney(amount),
    status: String(status),
    orderNumber: item?.orderNumber ?? item?.paymentNumber ?? '',
    buyerName: item?.buyerName ?? item?.payerName ?? '',
    raw: item,
  };
};

const MyClosetEarningsScreen = ({ navigation }) => {
  const { t } = useLanguage();
  const { bgStyle, textStyle, cardStyle, text } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [history, setHistory] = useState([]);

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [earnRes, historyRes] = await Promise.all([getEarning(), getEarningHistory()]);
      setEarnings(unwrapResponse(earnRes));
      setHistory(normalizeHistory(historyRes).map(parseHistoryItem));
    } catch (err) {
      console.warn('Failed to load earnings', err);
      setError(err?.response?.data?.message || err?.message || 'Unable to load earnings.');
      setEarnings(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  const totalEarnings = useMemo(() => {
    return formatMoney(
      earnings?.totalRevenue ?? earnings?.netEarnings ?? earnings?.total ?? earnings?.revenue ?? earnings?.amount ?? 0,
    );
  }, [earnings]);

  const shippingEarnings = useMemo(() => {
    return formatMoney(
      earnings?.shippingCollected ?? earnings?.shippingAmount ?? earnings?.shipping ?? 0,
    );
  }, [earnings]);

  const platformFee = useMemo(() => {
    return Number(earnings?.platformFee ?? earnings?.platformFees ?? 0);
  }, [earnings]);

  const itemSales = useMemo(() => {
    const total = Number(earnings?.totalRevenue ?? earnings?.total ?? earnings?.revenue ?? 0);
    const shipping = Number(earnings?.shippingCollected ?? earnings?.shippingAmount ?? earnings?.shipping ?? 0);
    return formatMoney(total - shipping);
  }, [earnings]);

  const fees = useMemo(() => {
    const raw = platformFee;
    return formatMoney(raw);
  }, [platformFee]);

  const payouts = useMemo(() => {
    return formatMoney(
      earnings?.payouts ??
        (Number(earnings?.totalRevenue ?? earnings?.total ?? earnings?.revenue ?? 0) - Number(earnings?.netEarnings ?? 0)),
    );
  }, [earnings]);

  const availableBalance = useMemo(() => {
    return formatMoney(
      earnings?.netEarnings ?? earnings?.availableBalance ?? earnings?.available ?? earnings?.balance ?? 0,
    );
  }, [earnings]);

  const percentChange = useMemo(() => {
    const raw = earnings?.percentChange ?? earnings?.changePercent ?? earnings?.growth ?? earnings?.monthOverMonth;
    if (raw == null || raw === '') return null;
    const value = Number(String(raw).replace(/[^0-9.-]+/g, ''));
    return Number.isNaN(value) ? null : value;
  }, [earnings]);

  const handleBack = () => navigation.goBack();
  const handleWithdraw = () => navigation.navigate('CashOut');

  return (
    <ScrollView style={[styles.container, bgStyle]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { borderBottomColor: '#e5e7eb' }]}> 
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>{t('myClosetEarnings.title') || 'Earnings'}</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={text} />
        </View>
      ) : (
        <>
          <View style={[styles.card, cardStyle, styles.earningsCard]}>
            <Text style={[styles.sectionLabel, styles.mutedText]}>{t('myClosetEarnings.totalEarningsLabel') || 'Total earnings'}</Text>
            <Text style={[styles.totalValue, textStyle]}>{totalEarnings}</Text>
            {percentChange != null ? (
              <Text style={[styles.changeText, percentChange >= 0 ? styles.changePositive : styles.changeNegative]}>
                {percentChange >= 0 ? '↑ ' : '↓ '}
                {Math.abs(percentChange)}% {t('myClosetEarnings.vsLastMonth') || 'vs last month'}
              </Text>
            ) : null}

            <View style={styles.breakdownList}>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, textStyle]}>{t('myClosetEarnings.itemSales') || 'Item sales'}</Text>
                <Text style={[styles.breakdownValue, textStyle]}>{itemSales}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, textStyle]}>{t('myClosetEarnings.shippingEarnings') || 'Shipping earnings'}</Text>
                <Text style={[styles.breakdownValue, textStyle]}>{shippingEarnings}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, textStyle]}>{t('myClosetEarnings.fees') || 'Fees'}</Text>
                <Text style={[styles.breakdownValue, textStyle]}>{fees.startsWith('-') ? fees : `-${fees}`}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, textStyle]}>{t('myClosetEarnings.payouts') || 'Payouts'}</Text>
                <Text style={[styles.breakdownValue, textStyle]}>{payouts.startsWith('-') ? payouts : `-${payouts}`}</Text>
              </View>
            </View>

            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, textStyle]}>{t('myClosetEarnings.availableBalance') || 'Available balance'}</Text>
              <Text style={[styles.balanceValue, textStyle]}>{availableBalance}</Text>
            </View>

            <TouchableOpacity style={[styles.withdrawButton, { backgroundColor: text }]} activeOpacity={0.8}>
              <Text style={styles.withdrawButtonText}>{t('myClosetEarnings.withdrawButton') || 'Withdraw'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionTitle, textStyle]}>{t('myClosetEarnings.payoutHistoryTitle') || 'Payout history'}</Text>
            {history.length > 0 ? (
              history.map(item => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Text style={[styles.historyDate, textStyle]}>
                      {item.orderNumber || item.buyerName}
                    </Text>
                    <Text style={[styles.historyMeta, textStyle]}>
                      {item.buyerName ? `${item.buyerName} · ` : ''}{item.date ? item.date.toLocaleDateString() : '—'}
                    </Text>
                    <Text style={[styles.historyStatus, item.status.toLowerCase().includes('paid') ? styles.paidText : styles.pendingText]}> 
                      {item.status}
                    </Text>
                  </View>
                  <Text style={[styles.historyAmount, textStyle]}>{item.amount}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyText, textStyle]}>{t('myClosetEarnings.noHistory') || 'No payout history available.'}</Text>
            )}
          </View>
        </>
      )}

      {error ? <Text style={[styles.errorText, textStyle]}>{error}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 18 },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 40,
  },
  backButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  loadingWrap: { minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  earningsCard: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, color: '#6b7280' },
  mutedText: { color: '#6b7280' },
  totalValue: { fontSize: 34, fontWeight: '900', marginBottom: 8 },
  changeText: { fontSize: 14, fontWeight: '700', marginBottom: 18 },
  changePositive: { color: '#16a34a' },
  changeNegative: { color: '#dc2626' },
  breakdownList: { marginBottom: 18 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  breakdownLabel: { fontSize: 14, color: '#6b7280' },
  breakdownValue: { fontSize: 14, fontWeight: '700' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  balanceLabel: { fontSize: 14, color: '#6b7280' },
  balanceValue: { fontSize: 18, fontWeight: '700' },
  withdrawButton: {
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  historyStatus: { fontSize: 13, fontWeight: '700' },
  historyAmount: { fontSize: 14, fontWeight: '800' },
  paidText: { color: '#16a34a' },
  pendingText: { color: '#f59e0b' },
  emptyText: { fontSize: 14, color: '#6b7280' },
  errorText: { fontSize: 14, color: '#dc2626', marginTop: 12 },
});

export default MyClosetEarningsScreen;
