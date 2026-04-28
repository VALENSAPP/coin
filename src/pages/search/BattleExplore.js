import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Keyboard,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { exploretBattle } from '../../services/battle';
import { following } from '../../services/profile';
import BattleCard from '../../components/search/Battlecard';
import BattleExploreTabs from '../../components/battles/BattleExploreTabs';
import {
  mapBattleCard,
} from '../../utils/battleCardUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'open', label: 'Open' },
  { key: 'finished', label: 'Finished' },
  { key: 'following', label: 'Following' },
];

const getBattleFeedType = battle => {
  const status = String(battle?.status || '').trim().toLowerCase();
  const now = Date.now();
  const endTime = battle?.endTime ? (new Date(battle.endTime).getTime() || Infinity) : Infinity;
  if (battle?.isLive || ['live', 'active', 'in_progress', 'ongoing'].includes(status)) return 'live';
  if (['finished', 'closed', 'resolved', 'completed', 'ended'].includes(status) || endTime < now) return 'finished';
  if (['open', 'pending', 'upcoming', 'queued'].includes(status) || endTime >= now) return 'open';
  return 'trending';
};

export default function BattleExplore({ onClose }) {
  const navigation = useNavigation();
  const toast = useToast();
  const { bgStyle, text } = useAppTheme();

  const [battles, setBattles] = useState([]);
  const [filteredBattles, setFilteredBattles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [userId, setUserId] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [selectedBattleOptions, setSelectedBattleOptions] = useState({});

  const toastRef = useRef(toast);
  const searchTimeoutRef = useRef(null);

  useEffect(() => { toastRef.current = toast; }, [toast]);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setUserId(id));
  }, []);

  const fetchBattles = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await exploretBattle();
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
      showToastMessage(toastRef.current, 'danger', 'Failed to load battles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchFollowing = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await following(userId);
      const list = res?.data?.following || res?.data || [];
      const ids = new Set(
        list.map(u => String(u?.id || u?._id || u?.userId || '')).filter(Boolean)
      );
      setFollowingIds(ids);
    } catch {
      setFollowingIds(new Set());
    }
  }, [userId]);

  useEffect(() => {
    fetchBattles();
  }, [fetchBattles]);

  useEffect(() => {
    if (userId) fetchFollowing();
  }, [userId, fetchFollowing]);

  useEffect(() => {
    let result = [...battles];

    // Tab filter
    if (activeTab !== 'all') {
      if (activeTab === 'following') {
        result = result.filter(b =>
          followingIds.has(String(b?.creator?.id || '')) ||
          followingIds.has(String(b?.opponent?.id || ''))
        );
      } else {
        result = result.filter(b => getBattleFeedType(b) === activeTab);
      }
    }

    // Search filter
    const query = searchText.trim().toLowerCase();
    if (query) {
      result = result.filter(b => {
        const title = String(b.title || '').toLowerCase();
        const creatorName = String(b.creator?.name || b.creator?.userName || '').toLowerCase();
        const opponentName = String(b.opponent?.name || b.opponent?.userName || '').toLowerCase();
        const user1Name = String(b.user1?.name || b.user1?.userName || '').toLowerCase();
        const user2Name = String(b.user2?.name || b.user2?.userName || '').toLowerCase();
        return (
          title.includes(query) ||
          creatorName.includes(query) ||
          opponentName.includes(query) ||
          user1Name.includes(query) ||
          user2Name.includes(query)
        );
      });
    }

    setFilteredBattles(result);
  }, [battles, activeTab, searchText, followingIds]);

  const handleSearch = useCallback(text => {
    setSearchText(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      // state update handled by useEffect above
    }, 300);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBattles(true), userId ? fetchFollowing() : Promise.resolve()]);
  }, [fetchBattles, fetchFollowing, userId]);

  const handleUserProfile = useCallback(user => {
    const targetId = user?.id || user?.userId || user?._id;
    if (!targetId) { showToastMessage(toastRef.current, 'danger', 'Unable to open profile'); return; }
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
  }, [navigation, userId]);

  const updateSelectedBattleOption = useCallback((battleId, optionLabel) => {
    if (!battleId || !optionLabel) return;
    setSelectedBattleOptions(prev => ({ ...prev, [battleId]: optionLabel }));
  }, []);

  const selectedBattleOptionsRef = useRef(selectedBattleOptions);
  useEffect(() => { selectedBattleOptionsRef.current = selectedBattleOptions; }, [selectedBattleOptions]);

  const handleBattleCardPress = useCallback((battleItem) => {
    navigation.navigate('ProfileMain', {
      screen: 'BattleInProgress',
      params: {
        battleId: battleItem?.id,
        battle: battleItem,
        entryPoint: 'battleExplore',
        selectedOption: selectedBattleOptionsRef.current[battleItem?.id] || '',
        returnTo: 'Search',
      },
    });
  }, [navigation]);

  const renderItem = useCallback(({ item }) => (
    <View style={styles.cardWrapper}>
      <BattleCard
        item={item}
        fullWidth
        selectedOption={selectedBattleOptions[item.id]}
        onCardPress={handleBattleCardPress}
        onOptionSelect={updateSelectedBattleOption}
        onUserPress={handleUserProfile}
      />
    </View>
  ), [selectedBattleOptions, handleBattleCardPress, updateSelectedBattleOption, handleUserProfile]);

  const keyExtractor = useCallback((item, idx) => String(item.id ?? idx), []);

  return (
    <View style={[styles.container, bgStyle]}>
      <Pressable onPress={Keyboard.dismiss} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onClose?.()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>Battle Explore</Text>
        <View style={styles.backBtn} />
      </View>

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#999" />
          <Text style={styles.emptySubtitle}>Loading battles...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBattles}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="shield-outline" size={60} color="#ddd" />
              <Text style={styles.emptyTitle}>No battles found</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'following'
                  ? 'Battles from people you follow will appear here'
                  : 'Try a different search or tab'}
              </Text>
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  cardWrapper: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 4,
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

