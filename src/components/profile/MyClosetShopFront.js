import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import {
  getClosetItemsByClosetId,
  getMyClosetById,
  getMyClosetItems,
  getClosetBattlesPriority,
} from '../../services/myCloset';
import { useSelector } from 'react-redux';
import {
  buildClosetNavContext,
  navigateToBattleLive,
  withClosetNavParams,
} from '../../utils/closetNavigation';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 3;

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v) => {
  if (v == null || v === '') return '$0.00';
  const s = String(v).trim();
  if (s.startsWith('$')) return s;
  const n = Number(s);
  return Number.isNaN(n) ? s : `$${n.toFixed(2)}`;
};

const thumb = (item) => item?.images?.[0] || item?.image || item?.thumbnail || null;

const unwrapMyClosetResponse = (source) => {
  const level1 = source?.data ?? source;
  if (level1 && typeof level1 === 'object' && !Array.isArray(level1)) {
    if (level1.data && typeof level1.data === 'object') {
      return level1.data;
    }
    return level1;
  }
  return {};
};

const unwrapBattlesResponse = (source) => {
  const battles = source?.data?.battles ?? source?.battles ?? [];
  return Array.isArray(battles) ? battles : [];
};

const mapParticipant = (p = {}, closet) => {
  const product = p.product ?? {};
  return {
    participantId: p.id,
    name: product.name || '',
    price: fmt(product.price),
    image: thumb(product), // product.images[0]
    user: closet?.shopName || closet?.shopUsername || '',
    pct: Number(p.votePercentage ?? 0),
    isWinner: !!p.isWinner,
  };
};

const mapBattle = (b, i) => {
  const sorted = [...(b.participants ?? [])].sort((a, c) => (a.position ?? 0) - (c.position ?? 0));
  const [p1, p2] = sorted;
  return {
    id: String(b.id ?? i),
    title: b.title,
    left: mapParticipant(p1, b.closet),
    right: mapParticipant(p2, b.closet),
  };
};

// ── placeholder battle data (fallback while loading / on error) ──────────────

const BATTLES_FALLBACK = [
  {
    id: 'b1',
    left: { name: 'Gucci Ophidia Bag', price: '$850', user: 'Priya', pct: 68 },
    right: { name: 'Chanel Classic Bag', price: '$2,350', user: 'Ananya', pct: 32 },
  },
  {
    id: 'b2',
    left: { name: 'Prada Sunglasses', price: '$220', user: 'Rohan', pct: 55 },
    right: { name: 'Cartier Bracelet', price: '$3,200', user: 'Meera', pct: 45 },
  },
];

const BattleSlide = ({ battle, accent, t, onPress }) => (
  <TouchableOpacity activeOpacity={0.9} style={s.slide} onPress={onPress}>
    <View style={s.battleHeader}>
      <Text style={s.battleTitle} numberOfLines={1}>
        {battle.title || t('myClosetShopFront.battlePicksTitle')}
      </Text>
    </View>

    <View style={s.battleBody}>
      {/* left */}
      <View style={s.fighter}>
        <View style={s.fighterThumb}>
          {battle.left.image
            ? <Image source={{ uri: battle.left.image }} style={s.fighterImg} resizeMode="cover" />
            : <Ionicons name="bag-outline" size={34} color="#9b8c7a" />}
        </View>
        <Text style={s.fighterName} numberOfLines={2}>{battle.left.name}</Text>
        <Text style={s.fighterPrice}>{battle.left.price}</Text>
        <View style={s.userRow}>
          {/* <View style={s.avatar} />
          <Text style={s.username}>{battle.left.user}</Text> */}
          <Text style={[s.pct, { color: accent }]}>{battle.left.pct}%</Text>
        </View>
      </View>

      {/* VS */}
      <View style={s.vsBubble}>
        <Text style={s.vsText}>{t('myClosetShopFront.vs')}</Text>
      </View>

      {/* right */}
      <View style={s.fighter}>
        <View style={[s.fighterThumb, { backgroundColor: '#f0eeec' }]}>
          {battle.right.image
            ? <Image source={{ uri: battle.right.image }} style={s.fighterImg} resizeMode="cover" />
            : <Ionicons name="bag-handle-outline" size={34} color="#9b8c7a" />}
        </View>
        <Text style={s.fighterName} numberOfLines={2}>{battle.right.name}</Text>
        <Text style={s.fighterPrice}>{battle.right.price}</Text>
        <View style={s.userRow}>
          {/* <View style={s.avatar} />
          <Text style={s.username}>{battle.right.user}</Text> */}
          <Text style={s.pctRed}>{battle.right.pct}%</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);
// ── ItemTile ──────────────────────────────────────────────────────────────────

const ItemTile = ({ item, accent, onPress }) => {
  const [liked, setLiked] = useState(false);
  return (
    <TouchableOpacity activeOpacity={0.85} style={s.tile} onPress={onPress}>
      <View style={s.tileThumb}>
        {item.image
          ? <Image source={{ uri: item.image }} style={s.tileImg} />
          : <View style={s.tileImgPlaceholder}><Ionicons name="shirt-outline" size={28} color="#9b8c7a" /></View>
        }
        <TouchableOpacity
          style={s.heart}
          onPress={() => setLiked(l => !l)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={18}
            color={liked ? accent : '#9b8c7a'}
          />
        </TouchableOpacity>
      </View>
      <Text style={s.tileName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.tilePrice}>{item.price}</Text>
    </TouchableOpacity>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const MyClosetShopFront = ({ navigation, userData, shopDraft, isOwnProfile = true, closetNavContext }) => {
  const { t } = useLanguage();
  const [storedUsername, setStoredUsername] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dotIdx, setDotIdx] = useState(0);
  const [closetDetails, setClosetDetails] = useState(null);
  const [closetId, setClosetId] = useState(null);

  // ── battles state ──
  const [battles, setBattles] = useState([]);
  const [battlesLoading, setBattlesLoading] = useState(false);

  const targetUserId = userData?.id;

  const { text, bgStyle } = useAppTheme(userData?.profile);
  const accent = text || '#6d28d9';

  useEffect(() => {
    let ok = true;
    AsyncStorage.getItem('currentUsername')
      .then(v => { if (ok && v) setStoredUsername(v); })
      .catch(() => { });
    return () => { ok = false; };
  }, []);

  const loadBattles = useCallback(async (id) => {
    if (!id) {
      setBattles([]);
      return;
    }
    setBattlesLoading(true);
    try {
      const res = await getClosetBattlesPriority(id, { page: 1, limit: 10 });
      console.log('getClosetBattlesPriority response:', JSON.stringify(res, null, 2));
      const raw = unwrapBattlesResponse(res);
      setBattles(raw.map(mapBattle));
    } catch (err) {
      console.log('getClosetBattlesPriority error:', err);
      setBattles([]);
    } finally {
      setBattlesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let resolvedClosetId = null;

      if (isOwnProfile) {
        const closetRes = await getMyClosetById({ userId: targetUserId }).catch(() => null);
        const apiCloset = unwrapMyClosetResponse(closetRes);
        const closetRecord = apiCloset?.closetDetails || apiCloset || null;
        setClosetDetails(closetRecord);

        resolvedClosetId = apiCloset?.closetId ?? closetRecord?.id ?? closetRecord?._id ?? null;
        setClosetId(resolvedClosetId);

        const res = await getMyClosetItems();
        const raw = res?.data?.data ?? res?.data?.items ?? res?.data ?? res;
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.items) ? raw.items
            : Array.isArray(raw?.data) ? raw.data
              : [];
        setItems(list);
      } else {
        // Step 1: get closetId for this user
        const byUserRes = await getMyClosetById({ userId: targetUserId });
        const closetData = unwrapMyClosetResponse(byUserRes);
        const closetRecord = closetData?.closetDetails || closetData;
        resolvedClosetId = closetData?.closetId ?? closetRecord?.id ?? null;

        if (!resolvedClosetId) {
          setItems([]);
          setClosetDetails(null);
          setClosetId(null);
          setBattles([]);
          return;
        }
        setClosetId(resolvedClosetId);
        setClosetDetails(closetRecord);

        // Step 2: fetch items using closetId
        const itemsRes = await getClosetItemsByClosetId(resolvedClosetId);
        const raw = itemsRes?.data?.data ?? itemsRes?.data ?? [];
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.items) ? raw.items
            : Array.isArray(raw?.data) ? raw.data
              : [];
        setItems(list);
      }

      // ── fetch battle picks once we know the closetId, for either profile type ──
      await loadBattles(resolvedClosetId);
    } catch {
      setItems([]);
      setClosetDetails(null);
      setBattles([]);
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, targetUserId, loadBattles]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    setItems([]);
    setClosetDetails(null);
    setClosetId(null);
    setDotIdx(0);
    setBattles([]);
  }, [targetUserId, isOwnProfile]);

  const shopName = useMemo(() =>
    closetDetails?.shopName
    || t('myClosetShopFront.defaultShopName'),
    [closetDetails?.shopName, t],
  );

  const tiles = useMemo(() =>
    items.slice(0, 6).map((it, i) => ({
      key: String(it?.id || it?._id || i),
      name: it?.name || it?.title || it?.itemName || t('myClosetShopFront.untitled'),
      price: fmt(it?.price ?? it?.amount ?? it?.salePrice),
      image: thumb(it),
      raw: it,
    })),
    [items, t],
  );

  // Use real battles once loaded; fall back to placeholder only while loading
  // and nothing has come back yet, so the section never looks empty on first paint.
  const displayBattles = battles.length > 0
    ? battles
    : (battlesLoading ? BATTLES_FALLBACK : battles);

  const onScroll = (e) => {
    setDotIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 24)));
  };

  const seller = {
    id: userData?.id,
    displayName: userData?.displayName,
    userName: userData?.userName,
    image: userData?.image,
    profile: userData?.profile,
  };

  const navContext = useMemo(
    () =>
      closetNavContext ||
      buildClosetNavContext({
        isOwnProfile,
        sellerProfile: userData?.profile,
        sellerId: userData?.id,
        closetId,
        seller,
      }),
    [closetId, closetNavContext, isOwnProfile, seller, userData?.id, userData?.profile],
  );

  const goItems = () => navigation?.navigate?.('MyClosetBuyerItems', withClosetNavParams(
    { params: navContext },
    { items, seller, sellerId: userData?.id, closetId, isOwnProfile },
  ));

  const openItem = item => navigation?.navigate?.('MyClosetBuyerItemDetail', withClosetNavParams(
    { params: navContext },
    {
      item: item?.raw || item,
      items,
      seller,
      sellerId: userData?.id,
      closetId,
      isOwnProfile,
    },
  ));

  const goBattles = () => navigation?.navigate?.('MyClosetBattles', withClosetNavParams(
    { params: navContext },
    { closetId },
  ));

  const openBattle = battle => navigateToBattleLive(navigation, withClosetNavParams(
    { params: navContext },
    {
      battleId: battle?.id,
      initialBattle: battle,
      selectedItems: [battle?.left, battle?.right].filter(Boolean),
    },
  ));
  const goStorefront = () => navigation?.navigate?.('ProfileMain', { screen: 'MyClosetStorefront' });
  const goAddFirst = (isFirstItem = true) => navigation?.navigate?.('ProfileMain', {
    screen: 'MyClosetAddItemPhotos', params: { draft: {}, isFirstItem },
  });

  return (
    <ScrollView style={[s.root, bgStyle]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── Banner ── */}
      {userData?.profile !== 'user' ? (
        <TouchableOpacity activeOpacity={0.9} style={s.banner} onPress={goStorefront}>
          <View style={[s.bannerIcon, { backgroundColor: `${accent}18` }]}>
            <Ionicons name="storefront-outline" size={26} color={accent} />
          </View>
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: accent }]}>{shopName}</Text>
            <Text style={s.bannerSub}>{t('myClosetShopFront.shopOwnerBannerSubtitle')}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity activeOpacity={0.9} style={s.banner} onPress={goStorefront}>
          <View style={[s.bannerIcon, { backgroundColor: `${accent}18` }]}>
            <Ionicons name="bag-handle" size={26} color={accent} />
          </View>
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: accent }]}>{shopName}</Text>
            <Text style={s.bannerSub}>{t('myClosetShopFront.userBannerSubtitle')}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Battle Picks ── */}
      {(battlesLoading || displayBattles.length > 0) && (
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionLeft}>
              <Text style={s.sectionEmoji}>⚔️</Text>
              <Text style={s.sectionTitle}>{t('myClosetShopFront.battlePicksTitle')}</Text>
            </View>
            <TouchableOpacity onPress={goBattles} activeOpacity={0.7}>
              <Text style={[s.seeAll, { color: accent }]}>{t('myClosetShopFront.seeAll')} ›</Text>
            </TouchableOpacity>
          </View>

          {battlesLoading && battles.length === 0 ? (
            <View style={s.center}><ActivityIndicator color={accent} /></View>
          ) : (
            <>
              <FlatList
                data={displayBattles}
                keyExtractor={b => b.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => <BattleSlide battle={item} accent={accent} t={t} onPress={() => openBattle(item)} />}
              />
              <View style={s.dots}>
                {displayBattles.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      i === dotIdx
                        ? { backgroundColor: accent, width: 16 }
                        : { backgroundColor: '#d1d5db' },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* ── My Items ── */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>{t('myClosetShopFront.myItemsTitle')}</Text>
          {(isOwnProfile || tiles.length > 0) && (
            <TouchableOpacity onPress={goItems} activeOpacity={0.7}>
              <Text style={[s.seeAll, { color: accent }]}>{t('myClosetShopFront.seeAll')} ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={accent} /></View>
        ) : tiles.length === 0 ? (
          isOwnProfile ? (
            <View style={s.center}>
              <Ionicons name="shirt-outline" size={32} color="#d1d5db" />
              <Text style={s.emptyTxt}>{t('myClosetShopFront.noItemsYet')}</Text>
              <TouchableOpacity style={[s.addBtn, { borderColor: accent }]} onPress={() => goAddFirst(true)}>
                <Text style={[s.addBtnTxt, { color: accent }]}>{t('myClosetShopFront.addFirstItem')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={s.emptyTxt}>{t('myClosetShopFront.noItemsAvailable')}</Text>
            </View>
          )
        ) : (
          <View style={s.grid}>
            {tiles.map(it => (
              <ItemTile key={it.key} item={it} accent={accent} onPress={() => { openItem(it) }} />
            ))}
            {isOwnProfile && (
              <TouchableOpacity activeOpacity={0.85} style={s.tile} onPress={() => goAddFirst(false)}>
                <View style={[s.tileThumb, s.addTile]}>
                  <Ionicons name="add" size={28} color={accent} />
                </View>
                <Text style={[s.tileName, { color: accent }]} numberOfLines={1}>
                  {t('myClosetShopFront.addNewItem')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

    </ScrollView>
  );
};

export default MyClosetShopFront;

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 60 },

  /* banner */
  banner: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff'
  },
  bannerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bannerBody: { flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  bannerSub: { fontSize: 12, color: '#6b7280', lineHeight: 17 },

  /* section */
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  seeAll: { fontSize: 13, fontWeight: '600' },

  /* battle slide */
  slide: {
    width: SCREEN_W - 24,
    marginLeft: 12,
    flexDirection: 'column',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0ece8',
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  battleHeader: { width: '100%', marginBottom: 12, alignItems: 'center' },
  battleTitle: { fontSize: 14, fontWeight: '800', color: '#111827', textAlign: 'center' },
  battleBody: { flexDirection: 'row', alignItems: 'center' },
  fighter: { flex: 1, alignItems: 'center' },
  fighterThumb: { width: 100, height: 100, borderRadius: 14, backgroundColor: '#f5f3ee', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  fighterImg: { width: '100%', height: '100%', borderRadius: 12 },
  fighterName: { fontSize: 12, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 2 },
  fighterPrice: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#d1d5db' },
  username: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  pct: { fontSize: 12, fontWeight: '800', marginLeft: 2 },
  pctRed: { fontSize: 12, fontWeight: '800', color: '#ef4444', marginLeft: 2 },
  vsBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  vsText: { fontSize: 12, fontWeight: '900', color: '#111827' },

  /* dots */
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { height: 7, width: 7, borderRadius: 4 },

  /* items grid */
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },
  tile: { width: CARD_W },
  tileThumb: { width: '100%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 6, backgroundColor: '#f5f3ee' },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    backgroundColor: '#fafafa',
  },
  tileImg: { width: '100%', height: '100%' },
  tileImgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f3ee' },
  heart: { position: 'absolute', top: 7, right: 7, backgroundColor: '#ffffffcc', borderRadius: 20, padding: 4 },
  tileName: { fontSize: 12, fontWeight: '700', color: '#111827' },
  tilePrice: { fontSize: 13, fontWeight: '800', color: '#111827', marginTop: 1 },

  /* empty / loading */
  center: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTxt: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  addBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  addBtnTxt: { fontSize: 13, fontWeight: '700' },
});
