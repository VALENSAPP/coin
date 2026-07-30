import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { exploretBattle } from '../../services/battle';
import BattleCard from '../../components/search/Battlecard';
import { BattleSlide, mapBattle } from '../../components/profile/MyClosetShopFront';
import { mapBattleCard } from '../../utils/battleCardUtils';
import { navigateToBattleLive, withClosetNavParams, buildClosetReturnTo } from '../../utils/closetNavigation';
import { useLanguage } from '../../i18n';

const BoostedWinnerCard = ({ item, cardWidth, accent, border, onPress }) => {
  const raw = item?.raw || item;
  const bwp = raw?.battleWinnerProduct || {};
  const product = bwp?.product || bwp || {};

  const productName =
    product?.name || product?.title ||
    bwp?.name || bwp?.title || 'Battle Winner';
  const productPrice =
    product?.price != null ? `$${Number(product.price).toFixed(2)}` :
      bwp?.price != null ? `$${Number(bwp.price).toFixed(2)}` : '';
  const productImage =
    (Array.isArray(product?.images) ? product.images[0] : null) ||
    product?.image ||
    (Array.isArray(bwp?.images) ? bwp.images[0] : null) ||
    bwp?.image || null;

  const votePercentage =
    bwp?.votePercentage ??
    bwp?.winnerPct ??
    product?.votePercentage ??
    raw?.winnerPct ??
    100;
  const displayPct = Math.round(Number(votePercentage) || 0);
  const cardH = 215;
  const imgW = Math.round(cardWidth * 0.42);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        width: cardWidth,
        height: cardH,
        borderRadius: 14,
        overflow: 'hidden',
        flexDirection: 'row',
        backgroundColor: accent || '#6C3FE8',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: border,
      }}
    >
      <View style={{ width: imgW, height: cardH, position: 'relative' }}>
        {productImage ? (
          <Image
            source={{ uri: productImage }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            fadeDuration={0}
          />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bag-handle-outline" size={40} color="rgba(255,255,255,0.4)" />
          </View>
        )}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="swap-horizontal-outline" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
            Battle Winner
          </Text>
        </View>
        <Text numberOfLines={2} style={{ color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 22, marginTop: 4 }}>
          {productName}
        </Text>
        {!!productPrice && (
          <Text style={{ color: '#C8A8FF', fontSize: 20, fontWeight: '800', marginTop: 2 }}>
            {productPrice}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginTop: 6, gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: accent || '#6C3FE8', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trending-up-outline" size={14} color="#fff" />
          </View>
          <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <View>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{displayPct}%</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Community Votes</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function BattleExplore({ onClose, profile }) {
  const navigation = useNavigation();
  const toast = useToast();
  const themeProfile = String(profile || '').toLowerCase() === 'company' ? 'company' : undefined;
  const { bgStyle, text, card, border, mutedText, icon, accent } = useAppTheme(themeProfile);
  const { isDarkMode } = useThemeContext();
  const labelColor = isDarkMode ? '#ffffff' : '#111827';
  const inputSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : card;
  const { t } = useLanguage();
  const cardWidth = Dimensions.get('window').width - 32;

  const [battles, setBattles] = useState([]);
  const [filteredBattles, setFilteredBattles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [userId, setUserId] = useState(null);
  const [selectedBattleOptions, setSelectedBattleOptions] = useState({});

  const toastRef = useRef(toast);
  const searchTimeoutRef = useRef(null);

  useEffect(() => { toastRef.current = toast; }, [toast]);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setUserId(id));
  }, []);

  const isOwnProfileForCloset = async (closetLike) => {
    const storedUserId = await AsyncStorage.getItem('userId');
    const closetId =
      closetLike?.id ??
      closetLike?._id ??
      closetLike?.userId ??
      closetLike?.sellerId ??
      closetLike?.closetId ??
      '';

    const normalizedUserId = String(storedUserId ?? '').trim();
    const normalizedClosetId = String(closetId ?? '').trim();
    return normalizedUserId !== '' && normalizedUserId === normalizedClosetId;
  }

  const fetchBattles = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await exploretBattle();
      console.log(response,'explore bataatateeeleleeleleelelelel')
      if (response?.statusCode === 200 || response?.status === 200) {
        const rawBattles = response?.data?.battles || response?.data?.data || response?.data || [];
        const normalized = [];
        const seen = new Set();
        if (Array.isArray(rawBattles)) {
          rawBattles.forEach(battle => {
            const mapped = mapBattleCard(battle);
            if (!mapped.id || seen.has(mapped.id)) return;
            seen.add(mapped.id);
            normalized.push(mapped);
          });
        }
        setBattles(normalized);
      } else {
        setBattles([]);
      }
    } catch (error) {
      setBattles([]);
      showToastMessage(toastRef.current, 'danger', t('battleExplore.fetchFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBattles();
  }, [fetchBattles]);

  useEffect(() => {
    let result = [...battles];

    const query = searchText.trim().toLowerCase();
    if (query) {
      result = result.filter(b => {
        const title = String(b.title || '').toLowerCase();
        const creatorName = String(b.creator?.name || b.creator?.userName || b.creator?.businessName || '').toLowerCase();
        const creatorBusiness = String(b.creator?.businessName || '').toLowerCase();
        const opponentName = String(b.opponent?.name || b.opponent?.userName || b.opponent?.businessName || '').toLowerCase();
        const opponentBusiness = String(b.opponent?.businessName || '').toLowerCase();
        const user1Name = String(b.user1?.name || b.user1?.userName || '').toLowerCase();
        const user2Name = String(b.user2?.name || b.user2?.userName || '').toLowerCase();
        return (
          title.includes(query) ||
          creatorName.includes(query) ||
          creatorBusiness.includes(query) ||
          opponentName.includes(query) ||
          opponentBusiness.includes(query) ||
          user1Name.includes(query) ||
          user2Name.includes(query)
        );
      });
    }

    setFilteredBattles(result);
  }, [battles, searchText]);

  const handleSearch = useCallback(value => {
    setSearchText(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      // state update handled by useEffect above
    }, 300);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBattles(true);
  }, [fetchBattles]);

  const handleUserProfile = useCallback(user => {
    const targetId = user?.id || user?.userId || user?._id;
    if (!targetId) {
      showToastMessage(toastRef.current, 'danger', t('battleExplore.unableToOpenProfile'));
      return;
    }
    if (String(targetId) === String(userId || '')) {
      navigation.navigate('ProfileMain', { screen: 'Profile' });
      return;
    }
    navigation.navigate('HomeMain', {
      screen: 'UsersProfile',
      params: {
        userId: String(targetId),
        username: user?.userName || user?.username || '',
        returnTo: 'Search',
      },
    });
  }, [navigation, userId, t]);

  const updateSelectedBattleOption = useCallback((battleId, optionLabel) => {
    if (!battleId || !optionLabel) return;
    setSelectedBattleOptions(prev => ({ ...prev, [battleId]: optionLabel }));
  }, []);

  const selectedBattleOptionsRef = useRef(selectedBattleOptions);
  useEffect(() => {
    selectedBattleOptionsRef.current = selectedBattleOptions;
  }, [selectedBattleOptions]);

  const handleBattleCardPress = useCallback(async(battleItem) => {
    const raw = battleItem?.raw || battleItem;
    const fmt = String(raw?.format || battleItem?.format || '').toLowerCase();
    const tbb = String(raw?.typeByBattle || battleItem?.typeByBattle || '').toLowerCase();

    if (fmt === 'boosted' || tbb === 'boosted_product') {
      const bwp = raw?.battleWinnerProduct || {};
      const product = bwp?.product || bwp || {};
      const closet = bwp?.closet || {};
      const seller = bwp?.seller || {};
      console.log("seller------------------------------",seller)
      const cleanProduct = {
        ...product,
        id: product?.id || product?._id || bwp?.id,
        name: product?.name || product?.title || bwp?.name || '',
        price: product?.price ?? bwp?.price ?? 0,
        image:
          (Array.isArray(product?.images) ? product.images[0] : null) ||
          product?.image ||
          (Array.isArray(bwp?.images) ? bwp.images[0] : null) ||
          bwp?.image || null,
        images: product?.images || bwp?.images || [],
        userId: closet?.sellerId || closet?.userId || product?.userId,
        closetId: closet?.closetId || closet?.id,
        seller: {
          id: closet?.sellerId || closet?.userId || product?.userId,
          userName: closet?.shopUsername || '',
          userImage: closet?.shopLogo || '',
          profile: 'user',
          closet,
        },
        closet,
      };
      const votePercentage =
        bwp?.votePercentage ?? bwp?.winnerPct ?? product?.votePercentage ?? raw?.winnerPct ?? 100;
      const winnerMeta = {
        pct: Math.round(Number(votePercentage) || 0),
        totalVotes: raw?.totalVotes || 0,
        battleId: raw?.id || null,
        battleTitle: raw?.title || 'Battle Winner',
      };
      const isOwnProfile = await isOwnProfileForCloset(seller);
      console.log("isOwnProfile------------------",isOwnProfile)
      console.log("isOwnProfile------------------",typeof(isOwnProfile))
      navigation?.navigate?.('ProfileMain', {
        screen: 'MyClosetBuyerItemDetail',
        params: withClosetNavParams(
          { params: {} },
          {
            item: cleanProduct?.raw || cleanProduct,
            items: [cleanProduct],
            seller: cleanProduct.seller,
            sellerId: cleanProduct.userId,
            closetId: cleanProduct.closetId,
            isOwnProfile: isOwnProfile,
            battleWinner: winnerMeta || null,
            returnTo: { tab: 'Search', screen: 'SearchHome', params: {} },
            returnParams: {},
          },
        ),
      });
      return;
    }

    if (fmt === 'marketplace' || tbb === 'marketplace') {
      const mappedBattle = mapBattle(raw || battleItem, 0);
      const closet = raw?.closet || battleItem?.raw?.closet || battleItem?.closet || {};
      navigateToBattleLive(navigation, {
        battleId: mappedBattle?.id,
        initialBattle: mappedBattle,
        userProfile: profile,
        selectedItems: [mappedBattle?.left, mappedBattle?.right].filter(Boolean),
        isOwnProfile: isOwnProfileForCloset(closet),
        returnToProfile: buildClosetReturnTo({
          isOwnProfile: isOwnProfileForCloset(closet),
          sellerProfile: profile,
        }),
      });
      return;
    }

    navigation.navigate('ProfileMain', {
      screen: 'BattleInProgress',
      params: {
        battleId: battleItem?.id,
        battle: battleItem,
        entryPoint: 'battleExplore',
        selectedOption: selectedBattleOptionsRef.current[battleItem?.id] || '',
        returnTo: 'Search',
        profile,
      },
    });
  }, [navigation, profile]);

  const renderItem = useCallback(({ item, index }) => {
    const rawFormat = String(item?.raw?.format || item?.format || '').toLowerCase();
    const rawTypeByBattle = String(item?.raw?.typeByBattle || item?.typeByBattle || '').toLowerCase();
    const isMarketplace = rawFormat === 'marketplace' || rawTypeByBattle === 'marketplace';
    const isBoosted = rawFormat === 'boosted' || rawTypeByBattle === 'boosted_product';

    if (isMarketplace || isBoosted) {
      if (isBoosted) {
        return (
          <View style={[styles.cardWrapper, styles.marketplaceCardWrapper]}>
            <BoostedWinnerCard
              item={item}
              cardWidth={cardWidth}
              accent={accent}
              border={border}
              onPress={() => handleBattleCardPress(item.raw || item)}
            />
          </View>
        );
      }
      const mappedBattle = mapBattle(item.raw || item, index);
      return (
        <View style={[styles.cardWrapper, styles.marketplaceCardWrapper]}>
          <BattleSlide
            key={item.id || mappedBattle.id}
            battle={mappedBattle}
            accent={accent}
            t={t}
            onPress={() => handleBattleCardPress(item.raw || item)}
            card={card}
            border={border}
            textColor={text}
            mutedText={mutedText}
            isDark={false}
            thumbSurface={isDarkMode ? '#333' : '#f5f3ef'}
            mutedColor={mutedText}
            loadingOverlayColor={isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(245,243,238,0.72)'}
            customWidth={'100%'}
            imageSize={70}
          />
        </View>
      );
    }
    return (
      <View style={styles.cardWrapper}>
        <BattleCard
          item={item}
          fullWidth
          bottomMargin={0}
          selectedOption={selectedBattleOptions[item.id]}
          onCardPress={handleBattleCardPress}
          onOptionSelect={updateSelectedBattleOption}
          onUserPress={handleUserProfile}
        />
      </View>
    );
  }, [selectedBattleOptions, handleBattleCardPress, updateSelectedBattleOption, handleUserProfile, accent, t, card, border, text, mutedText, isDarkMode]);

  const keyExtractor = useCallback((item, idx) => String(item.id ?? idx), []);

  return (
    <View style={[styles.container, bgStyle]}>
      <Pressable onPress={Keyboard.dismiss} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onClose?.()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: labelColor }]}>
          {t('battleExplore.headerTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: inputSurface, borderColor: border }]}>
        <Icon name="search" size={20} color={mutedText} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: labelColor }]}
          placeholder={t('battleExplore.searchPlaceholder')}
          placeholderTextColor={mutedText}
          value={searchText}
          onChangeText={handleSearch}
          returnKeyType="search"
          onSubmitEditing={Keyboard.dismiss}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => handleSearch('')}
            style={styles.clearSearchBtn}>
            <Icon name="close-circle" size={20} color={mutedText} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={[styles.emptySubtitle, { color: mutedText }]}>{t('battleExplore.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBattles}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} colors={[accent]} />
          }
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="shield-outline" size={60} color={mutedText} />
              <Text style={[styles.emptyTitle, { color: labelColor }]}>{t('battleExplore.emptyTitle')}</Text>
              <Text style={[styles.emptySubtitle, { color: mutedText }]}>{t('battleExplore.emptySubtitle')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'android' ? 40 : 55,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderRadius: 24,
    borderColor: '#e6e6e6',
    paddingVertical: Platform.OS === 'android' ? 6 : 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  clearSearchBtn: {
    marginLeft: 8,
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  cardWrapper: {
    width: '100%',
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  marketplaceCardWrapper: {
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
