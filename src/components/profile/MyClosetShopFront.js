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
import { getClosetItemsByClosetId, getMyClosetById, getMyClosetItems } from '../../services/myCloset';
import { useSelector } from 'react-redux';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 3; // 3-col grid

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v) => {
  if (v == null || v === '') return '$0.00';
  const s = String(v).trim();
  if (s.startsWith('$')) return s;
  const n = Number(s);
  return Number.isNaN(n) ? s : `$${n.toFixed(2)}`;
};

const thumb = (item) => item?.images?.[0] || item?.image || item?.thumbnail || null;

// ── placeholder battle data (swap with real API when ready) ──────────────────

const BATTLES = [
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

// ── BattleSlide ───────────────────────────────────────────────────────────────

const BattleSlide = ({ battle, accent }) => (
  <View style={s.slide}>
    {/* left */}
    <View style={s.fighter}>
      <View style={s.fighterThumb}>
        <Ionicons name="bag-outline" size={34} color="#9b8c7a" />
      </View>
      <Text style={s.fighterName} numberOfLines={2}>{battle.left.name}</Text>
      <Text style={s.fighterPrice}>{battle.left.price}</Text>
      <View style={s.userRow}>
        <View style={s.avatar} />
        <Text style={s.username}>{battle.left.user}</Text>
        <Text style={[s.pct, { color: accent }]}>{battle.left.pct}%</Text>
      </View>
    </View>

    {/* VS */}
    <View style={s.vsBubble}>
      <Text style={s.vsText}>VS</Text>
    </View>

    {/* right */}
    <View style={s.fighter}>
      <View style={[s.fighterThumb, { backgroundColor: '#f0eeec' }]}>
        <Ionicons name="bag-handle-outline" size={34} color="#9b8c7a" />
      </View>
      <Text style={s.fighterName} numberOfLines={2}>{battle.right.name}</Text>
      <Text style={s.fighterPrice}>{battle.right.price}</Text>
      <View style={s.userRow}>
        <View style={s.avatar} />
        <Text style={s.username}>{battle.right.user}</Text>
        <Text style={s.pctRed}>{battle.right.pct}%</Text>
      </View>
    </View>
  </View>
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

const MyClosetShopFront = ({ navigation, userData, shopDraft, isOwnProfile = true }) => {
  const [storedUsername, setStoredUsername] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dotIdx, setDotIdx] = useState(0);
  const [closetDetails, setClosetDetails] = useState(null);
  const [closetId, setClosetId] = useState(null);

  const userProfile = useSelector(state => state.userProfile.userProfile);
  const { text, bgStyle } = useAppTheme(userData?.profile);
  const accent = text || '#6d28d9';

  // stored username
  useEffect(() => {
    let ok = true;
    AsyncStorage.getItem('currentUsername')
      .then(v => { if (ok && v) setStoredUsername(v); })
      .catch(() => { });
    return () => { ok = false; };
  }, []);

  // closet items — reload every time tab becomes active
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isOwnProfile) {
        // Own profile: existing flow works fine
        const res = await getMyClosetItems();
        const raw = res?.data?.data ?? res?.data?.items ?? res?.data ?? res;
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.items) ? raw.items
            : Array.isArray(raw?.data) ? raw.data
              : [];
        setItems(list);
      } else {
        // Step 1: get closetId for this user
        const byUserRes = await getMyClosetById({ userId: userData?.id });
        const closetData = byUserRes?.data?.closetDetails ?? byUserRes?.data?.data ?? null;
        const closetId = byUserRes?.data?.closetId ?? closetData?.id ?? null;
        if (!closetId) {
          setItems([]);
          setClosetDetails(null);
          return;
        }
        setClosetId(closetId);
        setClosetDetails(closetData);

        // Step 2: fetch items using closetId
        const itemsRes = await getClosetItemsByClosetId(closetId);
        const raw = itemsRes?.data?.data ?? itemsRes?.data ?? [];
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.items) ? raw.items
            : Array.isArray(raw?.data) ? raw.data
              : [];
        setItems(list);
      }
    } catch {
      setItems([]);
      setClosetDetails(null);
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, userData?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shopName = useMemo(() =>
    shopDraft?.shopName
    || closetDetails?.shopName
    || userData?.businessName
    || userData?.companyProfile?.businessName
    || storedUsername
    || userData?.displayName
    || 'My Closet',
    [shopDraft, storedUsername, userData],
  );

  const tiles = useMemo(() =>
    items.slice(0, 6).map((it, i) => ({
      key: String(it?.id || it?._id || i),
      name: it?.name || it?.title || it?.itemName || 'Untitled',
      price: fmt(it?.price ?? it?.amount ?? it?.salePrice),
      image: thumb(it),
      raw: it,
    })),
    [items],
  );

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

  const goItems = () => navigation?.navigate?.('MyClosetBuyerItems', {
    items,
    seller,
    sellerId: userData?.id,
    closetId,
  });

  const openItem = item => navigation?.navigate?.('MyClosetBuyerItemDetail', {
    item: item?.raw || item,
    items,
    seller,
    sellerId: userData?.id,
    closetId,
    isOwnProfile, 
  });

  const goBattles = () => navigation?.navigate?.('ProfileMain', { screen: 'MyBattles' });
  const goStorefront = () => navigation?.navigate?.('ProfileMain', { screen: 'MyClosetStorefront' });
  const goAddFirst = () => navigation?.navigate?.('ProfileMain', {
    screen: 'MyClosetAddItemPhotos', params: { draft: {}, isFirstItem: true },
  });

  return (
    <ScrollView style={[s.root, bgStyle]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── Banner ── */}
      {userProfile !== 'user' ? (
        // Shop owner banner
        <TouchableOpacity
          activeOpacity={0.9}
          style={s.banner}
          onPress={goStorefront}
        >
          <View style={[s.bannerIcon, { backgroundColor: `${accent}18` }]}>
            <Ionicons name="storefront-outline" size={26} color={accent} />
          </View>
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: accent }]}>{shopName}</Text>
            <Text style={s.bannerSub}>
              Welcome to this shop.{'\n'}
              Explore the collection, discover new pieces, and experience the brand behind it. Shop now.
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        // Regular user (My Closet) banner
        <TouchableOpacity
          activeOpacity={0.9}
          style={s.banner}
          onPress={goStorefront}
        >
          <View style={[s.bannerIcon, { backgroundColor: `${accent}18` }]}>
            <Ionicons name="bag-handle" size={26} color={accent} />
          </View>
          <View style={s.bannerBody}>
            <Text style={[s.bannerTitle, { color: accent }]}>{ isOwnProfile ? 'My Closet' : shopName}</Text>
            <Text style={s.bannerSub}>
              Here you will find the things I let it go.{'\n'}
              Shop now and be happy the way I was with the item.{'\n'}
              This is my closet - things I've created, let it go.
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Battle Picks ── */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <View style={s.sectionLeft}>
            <Text style={s.sectionEmoji}>⚔️</Text>
            <Text style={s.sectionTitle}>Battle Picks</Text>
          </View>
          <TouchableOpacity onPress={goBattles} activeOpacity={0.7}>
            <Text style={[s.seeAll, { color: accent }]}>See all ›</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={BATTLES}
          keyExtractor={b => b.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => <BattleSlide battle={item} accent={accent} />}
        />

        {/* dots */}
        <View style={s.dots}>
          {BATTLES.map((_, i) => (
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
      </View>

      {/* ── My Items ── */}
      <View style={s.section}>
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>My Items</Text>
          {(isOwnProfile || tiles.length > 0) && (
            <TouchableOpacity onPress={goItems} activeOpacity={0.7}>
              <Text style={[s.seeAll, { color: accent }]}>See all ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={accent} /></View>
        ) : tiles.length === 0 ? (
          isOwnProfile ? (  // ← non-own profile sees nothing when empty
            <View style={s.center}>
              <Ionicons name="shirt-outline" size={32} color="#d1d5db" />
              <Text style={s.emptyTxt}>No items yet</Text>
              <TouchableOpacity style={[s.addBtn, { borderColor: accent }]} onPress={goAddFirst}>
                <Text style={[s.addBtnTxt, { color: accent }]}>Add your first item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={s.emptyTxt}>No items available</Text>
            </View>
          )
        ) : (
          <View style={s.grid}>
            {tiles.map(it => (
              <ItemTile
                key={it.key}
                item={it}
                accent={accent}
                onPress={() => openItem(it)}
              />
            ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0ece8',
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  fighter: { flex: 1, alignItems: 'center' },
  fighterThumb: { width: 100, height: 100, borderRadius: 14, backgroundColor: '#f5f3ee', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
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
