import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RBSheet from 'react-native-raw-bottom-sheet';

import {
  followers as apiFollowers,
  following as apiFollowing,
} from '../../services/profile';
import TokenSellModal from '../../components/modals/TokenSellModal';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';

const BRAND = '#4c2a88ab';
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function FollowersFollowingScreen({ navigation, route }) {
  const initialTab = route?.params?.tab;
  console.log(route?.params?.params.userName, 'checkTab');

  const headerUsername =
    route?.params?.params.userName ||
    route?.params.userName ||
    route?.params.username ||
    route?.params.user?.Username ||
    'Unknown User';
  const profileUserIdFromRoute = route?.params.userId || null;

  const [imageError, setImageError] = useState(false);
  const [selfUserId, setSelfUserId] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab == 'following' ? 'following' : 'followers');
  const [search, setSearch] = useState('');
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Token sell modal state
  const sellSheetRef = useRef();
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTokens, setUserTokens] = useState(1000);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const toast = useToast();
  const { bgStyle, textStyle, text } = useAppTheme();

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      setSelfUserId(id ? String(id) : null);

      // Load user's token balance
      const tokens = await AsyncStorage.getItem('PlatFormToken');
      if (tokens) {
        setUserTokens(parseInt(tokens) || 0);
      }
    })();
  }, []);

  const shapeUser = (u, { defaultFollowing = false } = {}) => ({
    id: String(u?.id ?? u?._id ?? u?.userId ?? ''),
    username: u?.userName ?? u?.username ?? 'unknown',
    fullName: u?.displayName ?? u?.fullName ?? '',
    avatar: u?.image ?? u?.avatar ?? DEFAULT_AVATAR,
    isFollowing: typeof u?.isFollowing === 'boolean' ? u.isFollowing : !!defaultFollowing,
    tokenAddress: u?.userTokens?.[0]?.tokenAddress
  });

  const loadData = useCallback(
    async (tab, { silent = false } = {}) => {
      const profileUserId = profileUserIdFromRoute || selfUserId;
      if (!profileUserId) {
        if (!silent) setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      try {
        if (tab === 'followers') {
          const res = await apiFollowers(profileUserId);
          const rows = res?.data?.data ?? res?.data ?? [];
          const users = rows
            .map(rel => rel?.follower || rel?.followerUser || rel?.user || null)
            .filter(Boolean)
            .map(u => shapeUser(u, { defaultFollowing: !!u?.isFollowing }));
          setFollowersList(users);
        } else {
          const res = await apiFollowing(profileUserId);

          const rows = res?.data?.data ?? res?.data ?? [];
          console.log('res in following list-------->>>>>>>>>', rows);
          const users = rows
            .map(rel => rel?.following || rel?.user || null)
            .filter(Boolean)
            .map(u => shapeUser(u, { defaultFollowing: true }));
          setFollowingList(users);
        }
      } catch (e) {
        console.log(e);
        Alert.alert(
          'Error',
          e?.response?.data?.message || 'Failed to load list',
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [profileUserIdFromRoute, selfUserId],
  );

  useEffect(() => {
    if (selfUserId || profileUserIdFromRoute) {
      loadData(activeTab);
    }
  }, [activeTab, selfUserId, profileUserIdFromRoute, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(activeTab, { silent: true });
    setRefreshing(false);
  }, [activeTab, loadData]);

  // Updated function to handle opening TokenSellModal instead of API calls
  const handleVallowingClick = useCallback(
    (user, tab) => {
      if (!user?.id) return;

      console.log('Opening TokenSellModal for user:', user);
      console.log('User token address:', user?.tokenAddress);
      setSelectedUser(user);
      sellSheetRef.current?.open();
    },
    [],
  );

  // Handle successful token sell
  const handleTokenSell = useCallback(() => {
    sellSheetRef.current?.close();
    showToastMessage(toast, 'success', 'Tokens sold successfully!');
    onRefresh();
  }, [onRefresh]);

  const filteredFollowers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return followersList;
    return followersList.filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q),
    );
  }, [search, followersList]);

  const filteredFollowing = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return followingList;
    return followingList.filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q),
    );
  }, [search, followingList]);

  const renderItem =
    tab =>
      ({ item }) => {
        const isFollowingState = !!item.isFollowing;

        return (
          <TouchableOpacity style={[styles.userRow, { shadowColor: text }]} activeOpacity={0.7}>
            <Image
              source={{
                uri: !imageError && item.avatar ? item.avatar : DEFAULT_AVATAR,
              }}
              style={[styles.avatar, { borderColor: text }]}
              onError={() => setImageError(true)}
            />
            <View style={styles.userInfo}>
              <Text style={[styles.username, textStyle]}>{item.username}</Text>
              {!!item.fullName && (
                <Text style={styles.fullName}>{item.fullName}</Text>
              )}
            </View>

            {isFollowingState &&
              <>
                {String(item.id) !== String(selfUserId) && (
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      isFollowingState ? (styles.following && { borderColor: text }) : (styles.follow && { backgroundColor: text }),
                    ]}
                    onPress={() => handleVallowingClick(item, tab)}
                  >
                    <Text
                      style={
                        isFollowingState ? (styles.followingText && textStyle) : styles.followText
                      }
                    >
                      {isFollowingState ? 'Vallowing' : 'Vallow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            }
          </TouchableOpacity>
        );
      };

  const data =
    activeTab === 'followers' ? filteredFollowers : filteredFollowing;

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* Header */}
      <View style={styles.headerView}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={[styles.usernameHeader, textStyle]}>{headerUsername}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'followers' && styles.tabBtnActive && { backgroundColor: text, shadowColor: text },
          ]}
          onPress={() => setActiveTab('followers')}
        >
          <Text
            style={[
              styles.tabText,
              textStyle,
              activeTab === 'followers' && styles.tabTextActive,
            ]}
          >
            Vallowers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'following' && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab('following')}
        >
          <Text
            style={[
              styles.tabText,
              textStyle,
              activeTab === 'following' && styles.tabTextActive,
            ]}
          >
            Vallowing
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={[styles.searchBar, { shadowColor: text }]}
        placeholder={
          activeTab === 'followers' ? 'Search vallowers' : 'Search vallowing'
        }
        placeholderTextColor="#888"
        value={search}
        onChangeText={setSearch}
      />

      {/* List */}
      {loading ? (
        <View style={{ paddingTop: 40 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem(activeTab)}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={refreshing}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 30 }}>
              <Text style={{ color: '#888' }}>
                No {activeTab === 'followers' ? 'vallowers' : 'vallowing'} yet
              </Text>
            </View>
          )}
        />
      )}

      {/* Token Sell Modal */}
      <RBSheet
        ref={sellSheetRef}
        height={530}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onOpen={() => setPurchaseAutoFocus(true)}
        onClose={() => {
          Keyboard.dismiss();
          setPurchaseAutoFocus(false);
          setSelectedUser(null);
        }}
        customStyles={{
          container: [{
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            bottom: -30,
          }, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
        }}
      >
        {selectedUser && (
          <TokenSellModal
            onSell={handleTokenSell}
            userId={selectedUser?.id}
            tokenAddress={selectedUser?.tokenAddress}
          />
        )}
      </RBSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  // Header
  headerView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  usernameHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: '#f3f0f7',
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: {
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },

  // Search bar
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 14,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // User list row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
    borderWidth: 2,
    backgroundColor: '#f3f0f7',
  },
  userInfo: { flex: 1 },
  username: { fontWeight: '700', fontSize: 16 },
  fullName: { color: '#6B7280', fontSize: 14 },

  // Follow button
  followBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  following: {
    backgroundColor: '#f3f0f7',
    borderWidth: 1.5,
  },
  followText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  followingText: {
    fontWeight: '700',
    fontSize: 14,
  },

  separator: { height: 12 },
});