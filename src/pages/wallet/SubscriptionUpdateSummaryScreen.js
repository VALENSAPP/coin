import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../../i18n';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { getPriceUpdateSummary } from '../../services/wallet';

const RESPONSE_CARDS = [
  { key: 'accepted', icon: 'checkmark-circle-outline', color: '#218A4D', background: '#F0FAF3', border: '#CBEAD5' },
  { key: 'canceled', icon: 'close-circle-outline', color: '#C53F3F', background: '#FEF4F4', border: '#F4D6D6' },
  { key: 'pending', icon: 'time-outline', color: '#B8771F', background: '#FFF9F0', border: '#F3E4C7' },
];

const formatPrice = price => `$${Number(price || 0).toFixed(2)} / month`;

const SubscriptionUpdateSummaryScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useBusinessProfileTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState(null);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await getPriceUpdateSummary();
      console.log('getPriceUpdateSummary response:', res);
      const data = res?.data?.data || res?.data || res;
      if (data && typeof data === 'object') {
        setApiData(data);
      }
    } catch (error) {
      console.log('fetchSummary error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSummary();
    }, [fetchSummary]),
  );

  const cardTitle =
    apiData?.title ||
    t('manageSubscribers.updateSummary.priceUpdate', 'Price update to all subscribers');

  const rawStatus = apiData?.status || route.params?.status || 'Completed';
  const isCompleted = String(rawStatus).toLowerCase() === 'completed';
  const statusColor = isCompleted ? '#218A4D' : '#B8771F';

  const fromValue =
    apiData?.from ??
    (apiData?.fromPrice != null ? formatPrice(apiData.fromPrice) : null) ??
    (apiData?.oldPrice != null ? formatPrice(apiData.oldPrice) : null) ??
    formatPrice(route.params?.currentPrice ?? 20);

  const toValue =
    apiData?.to ??
    (apiData?.toPrice != null ? formatPrice(apiData.toPrice) : null) ??
    (apiData?.newPrice != null ? formatPrice(apiData.newPrice) : null) ??
    formatPrice(route.params?.newPrice ?? 20);

  const effectiveValue =
    apiData?.effective ??
    apiData?.effectiveType ??
    route.params?.effective;

  const dateValue = String(
    apiData?.date ??
    apiData?.effectiveDate ??
    route.params?.date ??
    'Sep 8, 2026',
  ).replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,
    (month) => t(`date.monthNamesAbbr.${month.toLowerCase()}`),
  );

  const responses = {
    accepted:
      apiData?.responses?.accepted ??
      apiData?.acceptedCount ??
      route.params?.responses?.accepted ??
      0,
    canceled:
      apiData?.responses?.canceled ??
      apiData?.responses?.cancelled ??
      apiData?.cancelledCount ??
      route.params?.responses?.canceled ??
      0,
    pending:
      apiData?.responses?.pending ??
      apiData?.pendingCount ??
      route.params?.responses?.pending ??
      0,
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('manageSubscribers.updateSummary.back')}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t('manageSubscribers.updateSummary.title', 'Creator – Update Summary')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSummary(true)}
            tintColor={theme.accent}
          />
        }
      >
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          {t('manageSubscribers.updateSummary.subtitle', 'Track your price update.')}
        </Text>

        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {['overview', 'responses'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? theme.accent : theme.mutedText },
                ]}
              >
                {t(`manageSubscribers.updateSummary.${tab}`)}
              </Text>
              {activeTab === tab && (
                <View style={[styles.tabIndicator, { backgroundColor: theme.accent }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : activeTab === 'overview' ? (
          <>
            <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeading}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {cardTitle}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {t(`manageSubscribers.updateSummary.${rawStatus.toLowerCase()}`, rawStatus)}
                  </Text>
                </View>
              </View>
              <SummaryRow label={t('manageSubscribers.updateSummary.from', 'From')} value={fromValue} theme={theme} />
              <SummaryRow label={t('manageSubscribers.updateSummary.to', 'To')} value={toValue} theme={theme} />
              <SummaryRow label={t('manageSubscribers.updateSummary.effective', 'Effective')} value={
                effectiveValue === 'On next renewal'
                  ? t('manageSubscribers.updateSummary.nextRenewal', 'On next renewal')
                  : effectiveValue
              } theme={theme} />
              <SummaryRow label={t('manageSubscribers.updateSummary.date', 'Date')} value={dateValue} theme={theme} last />
            </View>

            <Text style={[styles.sectionTitle, { color: theme.accent }]}>
              {t('manageSubscribers.updateSummary.responses', 'Responses')}
            </Text>

            <View style={styles.responseGrid}>
              {RESPONSE_CARDS.map(card => (
                <View
                  key={card.key}
                  style={[styles.responseCard, { backgroundColor: card.background, borderColor: card.border }]}
                >
                  <Ionicons name={card.icon} size={19} color={card.color} />
                  <Text style={[styles.responseLabel, { color: card.color }]}>
                    {t(`manageSubscribers.updateSummary.${card.key}`, card.key)}
                  </Text>
                  <Text style={[styles.responseValue, { color: card.color }]}>
                    {responses[card.key]}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.detailsButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => navigation.navigate('ManageSubscribers')}
              accessibilityRole="button"
            >
              <Text style={[styles.detailsText, { color: theme.accent }]}>
                {t('manageSubscribers.updateSummary.viewDetails', 'View Details')}
              </Text>
              <Ionicons name="chevron-forward" size={23} color={theme.accent} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {t('manageSubscribers.updateSummary.responseBreakdown', 'Subscriber responses')}
            </Text>
            {RESPONSE_CARDS.map((card, index) => (
              <View key={card.key}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={styles.detailRow}>
                  <View style={[styles.responseIcon, { backgroundColor: card.background }]}>
                    <Ionicons name={card.icon} size={20} color={card.color} />
                  </View>
                  <Text style={[styles.detailLabel, { color: theme.text }]}>
                    {t(`manageSubscribers.updateSummary.${card.key}`, card.key)}
                  </Text>
                  <Text style={[styles.detailValue, { color: card.color }]}>
                    {responses[card.key]}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const SummaryRow = ({ label, value, theme, last }) => (
  <View style={[styles.summaryRow, !last && styles.summaryRowSpaced]}>
    <Text style={[styles.rowLabel, { color: theme.mutedText }]}>{label}</Text>
    <Text style={[styles.rowValue, { color: theme.text }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  backButton: { width: 34, paddingVertical: 5 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 34 },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 20 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 18 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 14, fontWeight: '700' },
  tabIndicator: { height: 3, borderRadius: 3, position: 'absolute', bottom: -1, width: '100%' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1, marginRight: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRowSpaced: { marginBottom: 17 },
  rowLabel: { fontSize: 14, fontWeight: '500' },
  rowValue: { fontSize: 14, fontWeight: '700', textAlign: 'right', flexShrink: 1, marginLeft: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 28, marginBottom: 14 },
  responseGrid: { flexDirection: 'row', gap: 9 },
  responseCard: { flex: 1, minHeight: 104, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  responseLabel: { fontSize: 12, fontWeight: '700', marginTop: 5 },
  responseValue: { fontSize: 27, fontWeight: '700', marginTop: 3 },
  detailsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, marginTop: 18, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  detailsText: { fontSize: 15, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  responseIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  detailValue: { fontSize: 20, fontWeight: '700' },
});

export default SubscriptionUpdateSummaryScreen;
