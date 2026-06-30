import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { getMyClosetItems } from '../../services/myCloset';

const mixWithWhite = (hex, amount = 0.88) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f5f3ff';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = channel => Math.round(channel + (255 - channel) * amount);
  const toHex = channel => mix(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(201,161,90,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const nestedSurface = (isDarkMode, accent, border) =>
  isDarkMode ? withAlpha(accent, 0.14) : mixWithWhite(accent, 0.92);

const statCards = [
  { key: 'views', label: 'Views', value: '245', delta: '+18%', icon: 'eye-outline' },
  { key: 'likes', label: 'Likes', value: '32', delta: '+12%', icon: 'heart-outline' },
  { key: 'orders', label: 'Orders', value: '3', delta: '+50%', icon: 'bag-outline' },
  { key: 'revenue', label: 'Revenue', value: '$210', delta: '+22%', icon: 'cash-outline' },
];

const overviewCards = [
  { key: 'items', label: 'Items', value: '12' },
  { key: 'sold', label: 'Sold', value: '8' },
  { key: 'earnings', label: 'Earnings', value: '$1,250' },
  { key: 'rating', label: 'Rating', value: '4.8' },
];

const battleStats = [
  { key: 'entered', label: 'Battles Entered', value: '5', icon: 'trophy-outline' },
  { key: 'votes', label: 'Total Votes', value: '125', icon: 'people-outline' },
  { key: 'winrate', label: 'Win Rate', value: '62%', icon: 'trending-up-outline' },
  { key: 'topranked', label: 'Top Ranked', value: '2', icon: 'navigate-circle-outline' },
  { key: 'battleviews', label: 'Battle Views', value: '860', icon: 'eye-outline' },
];

const recentOrders = [
  { key: 'jacket', name: 'Vintage Leather Jacket', order: 'Order #1023', price: '$120.00', status: 'Delivered', statusColor: '#16a34a' },
  { key: 'bag', name: 'Mini Shoulder Bag', order: 'Order #1022', price: '$85.00', status: 'Shipped', statusColor: '#2563eb' },
  { key: 'shoes', name: 'White Sneakers', order: 'Order #1021', price: '$65.00', status: 'Processing', statusColor: '#d97706' },
];

const MyClosetDashboard = ({ navigation, userData, shopDraft }) => {
  const [storedUsername, setStoredUsername] = useState('');
  const [closetItems, setClosetItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const {
    bgStyle,
    textStyle,
    text,
    accent,
    cardStyle,
    border,
    mutedText,
    mutedTextStyle,
  } = useBusinessProfileTheme();
  const { isDarkMode } = useThemeContext();
  const surface = nestedSurface(isDarkMode, accent, border);

  useEffect(() => {
    let isMounted = true;
    const loadUsername = async () => {
      try {
        const value = await AsyncStorage.getItem('currentUsername');
        if (isMounted && value) setStoredUsername(value);
      } catch {
        // Ignore storage read issues
      }
    };
    loadUsername();
    return () => { isMounted = false; };
  }, []);

  const loadClosetItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const response = await getMyClosetItems();
      const payload =
        response?.data?.data ??
        response?.data?.items ??
        response?.data ??
        response;

      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      setClosetItems(items);
    } catch (error) {
      console.warn('Unable to load closet items:', error);
      setClosetItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClosetItems();
    }, [loadClosetItems]),
  );

  const shopName = useMemo(
    () =>
      shopDraft?.shopName ||
      userData?.businessName ||
      userData?.companyProfile?.businessName ||
      storedUsername ||
      userData?.displayName ||
      'My Closet',
    [shopDraft?.shopName, storedUsername, userData?.businessName, userData?.companyProfile?.businessName, userData?.displayName],
  );

  const shopHandle = useMemo(
    () =>
      shopDraft?.username ||
      userData?.userName ||
      userData?.username ||
      storedUsername ||
      'grazielascloset',
    [shopDraft?.username, storedUsername, userData?.userName, userData?.username],
  );

  const avatarUri =
    shopDraft?.logo?.uri ||
    userData?.image ||
    userData?.avatar ||
    userData?.profilePicture ||
    null;

  const handleAddItemPress = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetAddItemPhotos',
      params: {
        draft: {},
        isFirstItem: closetItems.length === 0,
      },
    });
  };

  const handleSharePress = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'ShareProfile',
      params: { userData, initialTab: 'closet', shopHandle },
    });
  };

  const handleCreateBattlePress = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'CreateBattle', // same — must exist in ProfileStack
    });
  };

  const handleViewAllBattles = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyBattles', // make sure this is registered in ProfileStack
    });
  };

  const handleViewAllItems = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetItemsManagement',
      params: { section: 'items' },
    });
  };

  const handleViewAllOrders = () => {
    navigation?.navigate?.('ProfileMain', {
      screen: 'MyClosetOrders',
    });
  };

  const formatPrice = value => {
    if (value == null || value === '') return '$0.00';
    const textValue = String(value).trim();
    if (textValue.startsWith('$')) return textValue;
    const numericValue = Number(textValue);
    if (Number.isNaN(numericValue)) return textValue;
    return `$${numericValue.toFixed(2)}`;
  };

  const getItemImage = item => item?.images?.[0] || item?.image || item?.thumbnail || null;

  const displayItems = closetItems.slice(0, 6).map((item, index) => ({
    key: String(item?.id || item?._id || index),
    name: item?.name || item?.title || item?.itemName || 'Untitled item',
    price: formatPrice(item?.price ?? item?.amount ?? item?.salePrice),
    image: getItemImage(item),
  }));

  return (
    <ScrollView
      style={[styles.container, bgStyle]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Profile Card ── */}
      <View style={[styles.heroCard, cardStyle, { borderColor: border }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <View style={[styles.heroBadge, { backgroundColor: withAlpha(accent, 0.15) }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.heroAvatar} />
              ) : (
                <Ionicons name="bag-handle" size={30} color={accent} />
              )}
              <View style={[styles.verifiedDot, { backgroundColor: accent }]}>
                <Ionicons name="checkmark" size={9} color="#fff" />
              </View>
            </View>
            <View style={styles.heroMeta}>
              <Text style={[styles.heroTitle, textStyle]}>{shopName}</Text>
              <Text style={[styles.heroHandle, mutedTextStyle]}>valens.app/{String(shopHandle).toLowerCase()}</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSharePress}
            style={[styles.shareButton, { borderColor: withAlpha(accent, 0.35) }]}
          >
            <Text style={[styles.shareButtonText, { color: accent }]}>Share Shop</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.heroStatsRow}>
          {overviewCards.map((card, idx) => (
            <React.Fragment key={card.key}>
              <View style={styles.heroStatItem}>
                <Text style={[styles.heroStatValue, textStyle]}>{card.value}</Text>
                <Text style={[styles.heroStatLabel, mutedTextStyle]}>{card.label}</Text>
              </View>
              {idx < overviewCards.length - 1 && (
                <View style={[styles.heroStatDivider, { backgroundColor: border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Live banner */}
        <View style={[styles.liveBanner, { backgroundColor: withAlpha(accent, 0.12) }]}>
          <Ionicons name="bag-handle-outline" size={16} color={accent} />
          <Text style={[styles.liveBannerText, textStyle]}>
            Your shop is live! 🎉{'  '}
            <Text style={[styles.liveBannerSub, mutedTextStyle]}>Keep adding items and grow your closet.</Text>
          </Text>
        </View>
      </View>

      {/* ── Overview (this week) ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>Overview</Text>
          <Text style={[styles.sectionMeta, mutedTextStyle]}>This week ▾</Text>
        </View>

        <View style={styles.quickGrid}>
          {statCards.map(card => (
            <View key={card.key} style={[styles.quickCard, { backgroundColor: surface }]}>
              <Ionicons name={card.icon} size={18} color={accent} />
              <Text style={[styles.quickValue, textStyle]}>{card.value}</Text>
              <Text style={[styles.quickLabel, mutedTextStyle]}>{card.label}</Text>
              <Text style={styles.quickDelta}>↑ {card.delta}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Battle Performance ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.rowCenter}>
            <Ionicons name="flame-outline" size={16} color={accent} style={{ marginRight: 5 }} />
            <Text style={[styles.sectionTitle, textStyle]}>Battle Performance</Text>
            <Ionicons name="information-circle-outline" size={14} color={mutedText} style={{ marginLeft: 4 }} />
          </View>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllBattles}>
            <Text style={[styles.sectionMeta, mutedTextStyle]}>View all battles</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.battleGrid}>
          {battleStats.map(stat => (
            <View key={stat.key} style={[styles.battleCard, { backgroundColor: surface }]}>
              <Ionicons name={stat.icon} size={20} color={accent} />
              <Text style={[styles.battleValue, textStyle]}>{stat.value}</Text>
              <Text style={[styles.battleLabel, mutedTextStyle]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Recent Orders ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>Recent Orders</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllOrders}>
            <Text style={[styles.sectionMeta, mutedTextStyle]}>View all ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.itemList}>
          {recentOrders.map(item => (
            <TouchableOpacity key={item.key} activeOpacity={0.8} style={styles.orderRow}>
              <View style={[styles.itemThumb, { backgroundColor: withAlpha(accent, 0.1) }]}>
                <Ionicons name="shirt-outline" size={18} color={accent} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={[styles.itemName, textStyle]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.itemOrder, mutedTextStyle]}>{item.order}</Text>
              </View>
              <View style={styles.orderRight}>
                <View style={[styles.statusBadge, { backgroundColor: `${item.statusColor}18` }]}>
                  <Text style={[styles.statusText, { color: item.statusColor }]}>{item.status}</Text>
                </View>
                <Text style={[styles.orderPrice, textStyle]}>{item.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Your Items Grid ── */}
      <View style={[styles.sectionCard, cardStyle, { borderColor: border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>Your Items</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleViewAllItems}>
            <Text style={[styles.sectionMeta, mutedTextStyle]}>View all ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.itemsGrid}>
          {itemsLoading ? (
            <View style={styles.itemsLoadingWrap}>
              <ActivityIndicator color={accent} />
            </View>
          ) : displayItems.length ? (
            displayItems.map(item => (
              <TouchableOpacity key={item.key} activeOpacity={0.85} style={styles.itemGridCard}>
                <View style={[styles.itemGridThumb, { backgroundColor: withAlpha(accent, 0.08) }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemGridImage} />
                  ) : (
                    <Ionicons name="shirt-outline" size={28} color={accent} />
                  )}
                </View>
                <Text style={[styles.itemGridName, textStyle]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.itemGridPrice, mutedTextStyle]}>{item.price}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.emptyItemsCard, { borderColor: border }]}>
              <Ionicons name="shirt-outline" size={24} color={accent} />
              <Text style={[styles.emptyItemsText, textStyle]}>No items yet</Text>
            </View>
          )}

          {/* Add New Item tile */}
          <TouchableOpacity activeOpacity={0.85} style={styles.itemGridCard} onPress={handleAddItemPress}>
            <View style={[styles.itemGridThumb, styles.addItemThumb, { borderColor: withAlpha(accent, 0.35) }]}>
              <Ionicons name="add" size={28} color={accent} />
            </View>
            <Text style={[styles.itemGridName, { color: accent, fontWeight: '700' }]}>Add New Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Battle Item CTA ── */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleCreateBattlePress}
        style={[styles.battleCta, { backgroundColor: accent }]}
      >
        <View style={styles.battleCtaLeft}>
          <Ionicons name="flame" size={20} color="#fff" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.battleCtaTitle}>Battle Item</Text>
            <Text style={styles.battleCtaSub}>Let your items compete and earn votes!</Text>
          </View>
        </View>
        <View style={[styles.battleCtaButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.battleCtaButtonText}>Create Battle</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 55 },

  // Hero
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    padding: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  heroAvatar: { width: '100%', height: '100%' },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  heroMeta: { flex: 1 },
  heroTitle: { fontSize: 18, fontWeight: '800' },
  heroHandle: { marginTop: 2, fontSize: 12 },
  shareButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  shareButtonText: { fontWeight: '700', fontSize: 13 },

  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  heroStatItem: { alignItems: 'center', flex: 1 },
  heroStatValue: { fontSize: 18, fontWeight: '800' },
  heroStatLabel: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  heroStatDivider: { width: 1, height: 32 },

  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  liveBannerText: { fontSize: 13, fontWeight: '700', flex: 1 },
  liveBannerSub: { fontWeight: '500' },

  // Section card
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionMeta: { fontSize: 12, fontWeight: '600' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },

  // Overview quick cards
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '31%',
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  quickValue: { fontSize: 18, fontWeight: '800' },
  quickLabel: { fontSize: 12, fontWeight: '600' },
  quickDelta: { color: '#16a34a', fontSize: 12, fontWeight: '700' },

  // Battle
  battleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  battleCard: {
    width: '31%',
    borderRadius: 16,
    padding: 12,
    gap: 4,
    alignItems: 'flex-start',
  },
  battleValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  battleLabel: { fontSize: 11, fontWeight: '600' },

  // Orders
  itemList: { gap: 6 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemCopy: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700' },
  itemOrder: { marginTop: 2, fontSize: 12, fontWeight: '500' },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderPrice: { fontSize: 13, fontWeight: '700' },

  // Items grid
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemGridCard: {
    width: '31%',
  },
  itemGridThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  itemGridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  addItemThumb: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  itemMoreDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemGridName: { fontSize: 12, fontWeight: '700', textAlign: 'left' },
  itemGridPrice: { marginTop: 1, fontSize: 11, fontWeight: '600' },
  itemsLoadingWrap: {
    width: '100%',
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyItemsCard: {
    width: '100%',
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 2,
  },
  emptyItemsText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Battle CTA
  battleCta: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  battleCtaLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  battleCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  battleCtaSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 1 },
  battleCtaButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  battleCtaButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});

export default MyClosetDashboard;
