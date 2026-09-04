import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../i18n';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { getSubscribersList, getMySubscriptionsList } from '../../services/wallet';
import { useEffect } from 'react';

const STATUS = {
  active: 'active',
  pending: 'pending',
  canceled: 'canceled',
  expired: 'expired',
};

const STATUS_COLORS = {
  active: { fg: '#1F8A4C', bg: '#E8F7EE', border: '#8FD6A8' },
  pending: { fg: '#C56A12', bg: '#FFF3E4', border: '#F5C48A' },
  canceled: { fg: '#C0392B', bg: '#FDECEC', border: '#F0A8A2' },
  expired: { fg: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
};

// Helper function to map API subscriber response to display format
const transformSubscriber = (item) => {
  const startDate = new Date(item.startDate);
  const endDate = new Date(item.endDate);
  const now = new Date();
  
  // Determine status
  let status = STATUS.active;
  if (item.status === 'EXPIRED' || endDate < now) {
    status = STATUS.expired;
  } else if (
    item.status === 'CANCELED' ||
    item.status === 'canceled' ||
    item.status === 'cancelled' ||
    item.cancelAtPeriodEnd === true ||
    item.isCancelled === true ||
    item.autoPay === false ||
    item.autoRenew === false
  ) {
    status = STATUS.canceled;
  } else if (item.status === 'ACTIVE' && item.isActive) {
    status = STATUS.active;
  }

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

const calculateDaysUntil = (date) => {
  if (!date) return null;
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : null;
};

  return {
    id: item.subscriber?.id || item.id,
    handle: `@${item.subscriber?.userName || 'user'}`,
    name: item.subscriber?.displayName || item.subscriber?.userName || 'Unknown User',
    avatar: item.subscriber?.image || '',
    status,
    price: item.priceAtSubscription || 0,
    nextPrice: null,
    nextBilling: formatDate(item.endDate),
    nextBillingHint: (() => {
      const hint = calculateDaysUntil(item.endDate);
      return hint;
    })(),
    joined: formatDate(item.startDate),
    totalEarned: item.totalEarnedFromSubscriber || 0,
    totalPaid: item.totalPaidBySubscriber || 0,
    paymentsCount: item.paymentsCount || 0,
  };
};

// Helper function to map API subscription response to display format
const transformSubscription = (item) => {
  const startDate = new Date(item.startDate);
  const endDate = new Date(item.endDate);
  const now = new Date();
  
  let status = STATUS.active;
  if (item.status === 'EXPIRED' || endDate < now) {
    status = STATUS.expired;
  } else if (
    item.status === 'CANCELED' ||
    item.status === 'canceled' ||
    item.status === 'cancelled' ||
    item.cancelAtPeriodEnd === true ||
    item.isCancelled === true ||
    item.autoPay === false ||
    item.autoRenew === false
  ) {
    status = STATUS.canceled;
  } else if (item.status === 'ACTIVE' && item.isActive) {
    status = STATUS.active;
  }

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateDaysUntil = (date) => {
    if (!date) return null;
    const targetDate = new Date(date);
    const today = new Date();
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  };

  return {
    id: item.creator?.id || item.id,
    handle: `@${item.creator?.userName || 'creator'}`,
    name: item.creator?.displayName || item.creator?.userName || 'Unknown Creator',
    avatar: item.creator?.image || '',
    status,
    price: item.priceAtSubscription || 0,
    nextPrice: null,
    nextBilling: formatDate(item.endDate),
    nextBillingHint: (() => {
      const hint = calculateDaysUntil(item.endDate);
      return hint;
    })(),
    joined: formatDate(item.startDate),
    totalEarned: item.totalEarnedFromSubscriber || 0,
    totalPaid: item.totalPaidBySubscriber || 0,
    paymentsCount: item.paymentsCount || 0,
  };
};

const SORT_OPTIONS = ['newest', 'oldest', 'priceHigh', 'priceLow'];

const ManageSubscribersScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const theme = useBusinessProfileTheme();
  const { width } = useWindowDimensions();
  const statGap = 10;
  const statCardWidth = Math.floor((width - 32 - statGap) / 2);

  const [mode, setMode] = useState('subscribers');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // New state for API data
  const [subscribersList, setSubscribersList] = useState([]);
  const [mySubscriptionsList, setMySubscriptionsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch data based on mode
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (mode === 'subscribers') {
          const response = await getSubscribersList();
          if (response?.statusCode === 200 && response?.data?.subscribers) {
            const transformedData = response.data.subscribers.map(transformSubscriber);
            setSubscribersList(transformedData);
          } else if (response?.status === 200 && response?.data?.subscribers) {
            const transformedData = response.data.subscribers.map(transformSubscriber);
            setSubscribersList(transformedData);
          } else {
            setSubscribersList([]);
          }
        } else {
          const response = await getMySubscriptionsList();
          if (response?.statusCode === 200 && response?.data?.subscriptions) {
            const transformedData = response.data.subscriptions.map(transformSubscription);
            setMySubscriptionsList(transformedData);
          } else if (response?.status === 200 && response?.data?.subscriptions) {
            const transformedData = response.data.subscriptions.map(transformSubscription);
            setMySubscriptionsList(transformedData);
          } else {
            setMySubscriptionsList([]);
          }
        }
      } catch (err) {
        console.error('Error fetching subscriptions:', err);
        setError(err?.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [mode]);

  const isSubscriberView = mode === 'subscriptions';
  const sourceList = isSubscriberView ? mySubscriptionsList : subscribersList;

  const handleCancelSuccess = (canceledId) => {
    setMySubscriptionsList(prev => prev.map(item => item.id === canceledId ? { ...item, status: STATUS.canceled } : item));
  };

  // Calculate stats from actual data
  const stats = useMemo(() => {
    const list = isSubscriberView ? mySubscriptionsList : subscribersList;
    const statsCounts = {
      active: 0,
      pending: 0,
      canceled: 0,
      expired: 0,
    };
    
    list.forEach(item => {
      if (item.status === STATUS.active) statsCounts.active++;
      else if (item.status === STATUS.pending) statsCounts.pending++;
      else if (item.status === STATUS.canceled) statsCounts.canceled++;
      else if (item.status === STATUS.expired) statsCounts.expired++;
    });

    const total = list.length || 1;
    return {
      active: { count: statsCounts.active, pct: total ? ((statsCounts.active / total) * 100).toFixed(1) : 0 },
      pending: { count: statsCounts.pending, pct: total ? ((statsCounts.pending / total) * 100).toFixed(1) : 0 },
      canceled: { count: statsCounts.canceled, pct: total ? ((statsCounts.canceled / total) * 100).toFixed(1) : 0 },
      expired: { count: statsCounts.expired, pct: total ? ((statsCounts.expired / total) * 100).toFixed(1) : 0 },
    };
  }, [subscribersList, mySubscriptionsList, isSubscriberView]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = sourceList.filter(row => {
      const matchesQuery =
        !q ||
        row.handle.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    next = [...next].sort((a, b) => {
      if (sortBy === 'oldest') return String(a.joined).localeCompare(String(b.joined));
      if (sortBy === 'priceHigh') return b.price - a.price;
      if (sortBy === 'priceLow') return a.price - b.price;
      return String(b.joined).localeCompare(String(a.joined));
    });
    return next;
  }, [query, sourceList, statusFilter, sortBy]);

  const statusLabel = status => {
    if (status === STATUS.pending) return t('manageSubscribers.statusPending');
    if (status === STATUS.canceled) return t('manageSubscribers.statusCanceled');
    if (status === STATUS.expired) return t('manageSubscribers.statusExpired');
    return t('manageSubscribers.statusActive');
  };

  const renderStatCard = (key, icon, color) => (
    <View
      key={key}
      style={[
        styles.statCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderBottomColor: color,
          width: statCardWidth,
        },
      ]}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text
        style={[styles.statLabel, { color: theme.mutedText }]}
        numberOfLines={1}
        ellipsizeMode="tail">
        {statusLabel(key)}
      </Text>
      <Text style={[styles.statCount, { color: theme.text }]}>{stats[key].count}</Text>
      <Text style={[styles.statPct, { color: theme.mutedText }]} numberOfLines={1}>
        {t('manageSubscribers.pctOfTotal', { pct: stats[key].pct })}
      </Text>
    </View>
  );

  const renderRow = row => {
    const colors = STATUS_COLORS[row.status] || STATUS_COLORS.active;
    return (
      <View
        key={row.id}
        style={[styles.personCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.personTop}>
          <HexAvatar uri={row.avatar} size={44} borderWidth={0} />
          <View style={styles.personMeta}>
            <Text style={[styles.handle, { color: theme.text }]} numberOfLines={1}>
              {row.handle}
            </Text>
            <Text style={[styles.fullName, { color: theme.mutedText }]} numberOfLines={1}>
              {row.name}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.badgeText, { color: colors.fg }]}>{statusLabel(row.status)}</Text>
          </View>
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.detailCell}>
            <Text style={[styles.detailLabel, { color: theme.mutedText }]}>
              {t('manageSubscribers.currentPrice')}
            </Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>
              {t('manageSubscribers.priceMonth', { price: row.price.toFixed(2) })}
            </Text>
            {row.nextPrice ? (
              <Text style={[styles.detailHint, { color: theme.accent }]}>
                {t('manageSubscribers.willChangeTo', { price: row.nextPrice.toFixed(2) })}
              </Text>
            ) : null}
          </View>
          <View style={styles.detailCell}>
            <Text style={[styles.detailLabel, { color: theme.mutedText }]}>
              {t('manageSubscribers.nextBilling')}
            </Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{row.nextBilling}</Text>
            {row.nextBillingHint ? (
              <Text style={[styles.detailHint, { color: theme.mutedText }]}>
                {t('manageSubscribers.inDays', { days: row.nextBillingHint })}
              </Text>
            ) : null}
          </View>
          <View style={styles.detailCell}>
            <Text style={[styles.detailLabel, { color: theme.mutedText }]}>
              {t('manageSubscribers.joined')}
            </Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{row.joined}</Text>
          </View>
        </View>

        {isSubscriberView && row.status !== STATUS.canceled && (
          <View style={{ marginTop: 16 }}>
            <TouchableOpacity 
              style={[styles.outlineBtn, { borderColor: theme.border }]} 
              onPress={() => navigation.navigate('CancelSubscriptionFlow', { subscription: row, onCancelSuccess: () => handleCancelSuccess(row.id) })}>
              <Text style={[styles.outlineBtnText, { color: theme.text }]}>Cancel Subscription</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {isSubscriberView
            ? t('manageSubscribers.mySubscriptionsTitle')
            : t('manageSubscribers.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          {isSubscriberView
            ? t('manageSubscribers.mySubscriptionsSubtitle')
            : t('manageSubscribers.subtitle')}
        </Text>

        <View style={styles.modeRow}>
          <TouchableOpacity
            onPress={() => setMode('subscribers')}
            style={[styles.outlineBtn, { 
              borderColor: theme.accent, 
              backgroundColor: !isSubscriberView ? theme.accent : 'transparent' 
            }]}>
            <Text style={[styles.outlineBtnText, { 
              color: !isSubscriberView ? '#fff' : theme.accent 
            }]} numberOfLines={1}>
              {t('manageSubscribers.viewMySubscribers')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('subscriptions')}
            style={[styles.outlineBtn, { 
              borderColor: theme.accent, 
              backgroundColor: isSubscriberView ? theme.accent : 'transparent' 
            }]}>
            <Text style={[styles.outlineBtnText, { 
              color: isSubscriberView ? '#fff' : theme.accent 
            }]} numberOfLines={1}>
              {t('manageSubscribers.viewMySubscriptions')}
            </Text>
          </TouchableOpacity>
        </View>

        {!isSubscriberView ? (
          <View style={styles.statsWrap}>
            {renderStatCard('active', 'person-outline', STATUS_COLORS.active.fg)}
            {renderStatCard('expired', 'calendar-outline', STATUS_COLORS.expired.fg)}
          </View>
        ) : null}

        {!isSubscriberView ? (
          <View style={[styles.banner, { backgroundColor: `${theme.accent}18`, borderColor: `${theme.accent}44` }]}>
            <Ionicons name="information-circle" size={22} color={theme.accent} />
            <View style={styles.bannerCopy}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>
                {t('manageSubscribers.priceUpdateTitle')}
              </Text>
              <Text style={[styles.bannerBody, { color: theme.mutedText }]}>
                {t('manageSubscribers.priceUpdateBody', { from: '9.90', to: '14.90' })}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.bannerBtn, { backgroundColor: theme.card, borderColor: theme.accent }]}
              onPress={() => navigation.navigate('UpdateSubscriptionPrice', { currentPrice: 9.9 })}>
              <Text style={[styles.bannerBtnText, { color: theme.accent }]}>
                {t('manageSubscribers.viewUpdateDetails')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.searchRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Ionicons name="search-outline" size={18} color={theme.mutedText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={
              isSubscriberView
                ? t('manageSubscribers.searchSubscriptions')
                : t('manageSubscribers.searchPlaceholder')
            }
            placeholderTextColor={theme.mutedText}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={() => {
              setShowSortMenu(false);
              setShowStatusMenu(v => !v);
            }}>
            <Text style={[styles.filterChipText, { color: theme.text }]} numberOfLines={1}>
              {statusFilter === 'all'
                ? t('manageSubscribers.allStatus')
                : statusLabel(statusFilter)}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.mutedText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={() => {
              setShowStatusMenu(false);
              setShowSortMenu(v => !v);
            }}>
            <Text style={[styles.filterChipText, { color: theme.text }]} numberOfLines={1}>
              {t(`manageSubscribers.sort.${sortBy}`)}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.mutedText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={() => setShowFilters(v => !v)}>
            <Ionicons name="options-outline" size={16} color={theme.text} />
            <Text style={[styles.filterChipText, { color: theme.text }]}>
              {t('manageSubscribers.filters')}
            </Text>
          </TouchableOpacity>
        </View>

        {showStatusMenu ? (
          <View style={[styles.menu, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {['all', STATUS.active, STATUS.expired].map(key => (
              <TouchableOpacity
                key={key}
                style={styles.menuItem}
                onPress={() => {
                  setStatusFilter(key);
                  setShowStatusMenu(false);
                }}>
                <Text style={{ color: statusFilter === key ? theme.accent : theme.text, fontWeight: '600' }}>
                  {key === 'all' ? t('manageSubscribers.allStatus') : statusLabel(key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {showSortMenu ? (
          <View style={[styles.menu, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {SORT_OPTIONS.map(key => (
              <TouchableOpacity
                key={key}
                style={styles.menuItem}
                onPress={() => {
                  setSortBy(key);
                  setShowSortMenu(false);
                }}>
                <Text style={{ color: sortBy === key ? theme.accent : theme.text, fontWeight: '600' }}>
                  {t(`manageSubscribers.sort.${key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {showFilters ? (
          <Text style={[styles.filterHint, { color: theme.mutedText }]}>
            {t('manageSubscribers.filterHint')}
          </Text>
        ) : null}

        {isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="hourglass-outline" size={32} color={theme.mutedText} />
            <Text style={[styles.empty, { color: theme.mutedText, marginTop: 8 }]}>
              Loading...
            </Text>
          </View>
        ) : error ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="alert-circle-outline" size={32} color={theme.accent} />
            <Text style={[styles.empty, { color: theme.accent, marginTop: 8 }]}>
              {error}
            </Text>
          </View>
        ) : filteredList.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="search-outline" size={32} color={theme.mutedText} />
            <Text style={[styles.empty, { color: theme.mutedText, marginTop: 8 }]}>
              No data found
            </Text>
          </View>
        ) : (
          filteredList.map(renderRow)
        )}

        {/* <Text style={[styles.showing, { color: theme.mutedText }]}>
          {t('manageSubscribers.showing', {
            from: filteredList.length ? 1 : 0,
            to: filteredList.length,
            total: isSubscriberView ? MOCK_MY_SUBSCRIPTIONS.length : 464,
          })}
        </Text> */}

        {/* <View style={styles.legend}>
          {[STATUS.active, STATUS.pending, STATUS.canceled, STATUS.expired].map(key => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[key].fg }]} />
              <Text style={[styles.legendText, { color: theme.mutedText }]}>
                {t(`manageSubscribers.legend.${key}`)}
              </Text>
            </View>
          ))}
        </View> */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 ,maginBottom: '5%'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 40 },
  scroll: { padding: 16, paddingBottom: 40 },
  subtitle: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexGrow: 1,
    flexShrink: 1,
  },
  outlineBtnText: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  primaryBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    flexGrow: 1,
    minWidth: 140,
  },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statCard: {
    borderWidth: 1,
    borderBottomWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  statCount: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statPct: { fontSize: 11, marginTop: 4 },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  bannerCopy: { flex: 1, gap: 4 },
  bannerTitle: { fontSize: 14, fontWeight: '700' },
  bannerBody: { fontSize: 12, lineHeight: 17 },
  bannerBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bannerBtnText: { fontSize: 12, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexGrow: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  menu: { borderWidth: 1, borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
  filterHint: { fontSize: 12, marginBottom: 10 },
  empty: { textAlign: 'center', marginVertical: 24, fontSize: 14 },
  personCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personMeta: { flex: 1, minWidth: 0 },
  handle: { fontSize: 14, fontWeight: '700' },
  fullName: { fontSize: 12, marginTop: 2 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 120,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  pendingNote: { marginTop: 6, fontSize: 11, fontWeight: '600' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 10 },
  detailCell: { width: '30%', flexGrow: 1, minWidth: 90 },
  detailLabel: { fontSize: 11, marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '700' },
  detailHint: { fontSize: 11, marginTop: 2 },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showing: { fontSize: 12, marginTop: 4, marginBottom: 16 },
  legend: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  legendText: { flex: 1, fontSize: 12, lineHeight: 18 },
});

export default ManageSubscribersScreen;
