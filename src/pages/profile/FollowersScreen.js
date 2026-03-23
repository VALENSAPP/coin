import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  followers as apiFollowers,
  following as apiFollowing,
} from '../../services/profile';
import { follow, unfollow, getUserCredentials } from '../../services/post';
import SupportCreatorModal from '../../components/modals/SupportCreatorModal';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';
import { getSupportRecipientWalletAddress } from '../../utils/walletPaymentSupport';
import { isSupportAllowed, normalizeProfileType } from '../../utils/supportEligibility';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function FollowersFollowingScreen({ navigation, route }) {
  const initialTab = route?.params?.tab;
  // console.log(route?.params?.params.userName, 'checkTab');

  const headerUsername =
    route?.params?.params?.userName ||
    route?.params?.userName ||
    route?.params?.username ||
    route?.params?.user?.Username ||
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
  const [followBusyById, setFollowBusyById] = useState({});
  const [walletAddress, setWalletAddress] = useState('');
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [selectedSupportUser, setSelectedSupportUser] = useState(null);
  const [selfProfileType, setSelfProfileType] = useState('user');
  const toast = useToast();
  const { startSupportPayment } = useWalletConnectSupport();
  const { bgStyle, textStyle, text } = useAppTheme();

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      const storedWalletAddress = await AsyncStorage.getItem('walletAddress');
      const storedProfile = await AsyncStorage.getItem('profile');
      setSelfUserId(id ? String(id) : null);
      setWalletAddress(storedWalletAddress || '');
      setSelfProfileType(normalizeProfileType(storedProfile || 'user'));
    })();
  }, []);

  const shapeUser = (u, { defaultFollowing = false } = {}) => ({
    id: String(u?.id ?? u?._id ?? u?.userId ?? ''),
    username: u?.userName ?? u?.username ?? 'unknown',
    fullName: u?.displayName ?? u?.fullName ?? '',
    profile: u?.profile ?? u?.accountType ?? '',
    avatar: u?.image ?? u?.avatar ?? DEFAULT_AVATAR,
    isFollowing: typeof u?.isFollowing === 'boolean' ? u.isFollowing : !!defaultFollowing,
    tokenAddress: u?.userTokens?.[0]?.tokenAddress,
    walletAddress:
      u?.walletAddress ||
      u?.walletId ||
      u?.wallet ||
      u?.userWalletAddress ||
      u?.creatorWalletAddress ||
      u?.vendorWalletAddress ||
      u?.receiverWalletAddress ||
      null,
  });

  const enrichUsersWithProfile = useCallback(async (users = []) => {
    const safeUsers = Array.isArray(users) ? users : [];
    const updated = await Promise.all(
      safeUsers.map(async (user) => {
        if (!user?.id) return user;
        try {
          const response = await getUserCredentials(String(user.id));
          const apiData = response?.data?.data ?? response?.data ?? {};
          return {
            ...user,
            profile: apiData?.profile ?? user.profile ?? '',
          };
        } catch (_err) {
          return user;
        }
      }),
    );
    return updated;
  }, []);

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
          console.log(res, 'reposne in folowing liststst');

          const rows = res?.data?.data ?? res?.data ?? [];
          const users = rows
            .map(rel => rel?.follower || rel?.followerUser || rel?.user || null)
            .filter(Boolean)
            .map(u => shapeUser(u, { defaultFollowing: !!u?.isFollowing }));
          const usersWithProfile = await enrichUsersWithProfile(users);
          setFollowersList(usersWithProfile);
        } else {
          const res = await apiFollowing(profileUserId);

          const rows = res?.data?.data ?? res?.data ?? [];
          const users = rows
            .map(rel => rel?.following || rel?.user || null)
            .filter(Boolean)
            .map(u => shapeUser(u, { defaultFollowing: true }));
          const usersWithProfile = await enrichUsersWithProfile(users);
          setFollowingList(usersWithProfile);
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
    [profileUserIdFromRoute, selfUserId, enrichUsersWithProfile],
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

  const updateFollowState = useCallback((targetUserId, nextFollowing) => {
    setFollowersList(prev =>
      prev.map(u => (String(u.id) === String(targetUserId) ? { ...u, isFollowing: nextFollowing } : u)),
    );
    setFollowingList(prev =>
      prev.map(u => (String(u.id) === String(targetUserId) ? { ...u, isFollowing: nextFollowing } : u)),
    );
  }, []);

  const handleVallowingClick = useCallback(
    async (user) => {
      if (!user?.id) return;
      if (followBusyById[user.id]) return;

      const shouldFollow = !user.isFollowing;
      setFollowBusyById(prev => ({ ...prev, [user.id]: true }));

      try {
        const res = shouldFollow ? await follow(user.id) : await unfollow(user.id);
        const ok = res?.statusCode === 200 && (res?.success ?? true);

        if (!ok) {
          showToastMessage(
            toast,
            'danger',
            res?.data?.message || res?.message || 'Unable to update follow',
          );
          return;
        }

        const serverVal = res?.data?.following;
        const resolvedFollowing =
          typeof serverVal === 'boolean' ? serverVal : shouldFollow;
        updateFollowState(user.id, resolvedFollowing);

        if (resolvedFollowing && shouldFollow) {
          setSelectedSupportUser({ ...user, isFollowing: true });
          setSupportModalVisible(true);
        }
      } catch (e) {
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || 'Something went wrong',
        );
      } finally {
        setFollowBusyById(prev => ({ ...prev, [user.id]: false }));
      }
    },
    [followBusyById, toast, updateFollowState],
  );

  const recipientWalletAddress = useMemo(
    () => (selectedSupportUser ? getSupportRecipientWalletAddress(selectedSupportUser) : null),
    [selectedSupportUser],
  );

  const canSupport = !!recipientWalletAddress;

  const handleOpenSupportDisclaimer = useCallback(() => {
    const supporterProfile = selfProfileType;
    const recipientProfile = normalizeProfileType(selectedSupportUser?.profile);
    if (!isSupportAllowed({ supporterProfile, recipientProfile })) {
      Alert.alert(
        'Support unavailable',
        'Tips are not available for business profiles.',
      );
      setSupportModalVisible(false);
      return;
    }
    setSupportModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, [selfProfileType, selectedSupportUser?.profile]);

  const handleSupportNow = useCallback(async () => {
    if (!canSupport) {
      Alert.alert(
        'Wallet not connected',
        'This user has not connected a wallet yet. Follow is still active.',
      );
      return;
    }
    setSupportDisclaimerVisible(false);
    await startSupportPayment(recipientWalletAddress);
  }, [canSupport, recipientWalletAddress, startSupportPayment]);

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

  const getUserAccentColor = useCallback((profileType) => {
    return String(profileType || '').toLowerCase() === 'company'
      ? '#D3B683'
      : '#5a2d82';
  }, []);

  const goToUserProfile = useCallback(
    (user) => {
      if (!user?.id) return;

      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: user.id,
          username: user.username,
          // returnTo: route?.name,
          // stackName: 'ProfileMain',
        },
      });
    },
    [navigation],
  );


  const renderItem =
    tab =>
      ({ item }) => {
        const isFollowingState = !!item.isFollowing;
        const accentColor = getUserAccentColor(item?.profile);

        return (
          <TouchableOpacity style={[styles.userRow, { shadowColor: accentColor }]} activeOpacity={0.7} onPress={() => goToUserProfile(item)}>
            <Image
              source={{
                uri: !imageError && item.avatar ? item.avatar : DEFAULT_AVATAR,
              }}
              style={[styles.avatar, { borderColor: accentColor }]}
              onError={() => setImageError(true)}
            />
            <View style={styles.userInfo}>
              <Text style={[styles.username,{color:accentColor} ]}>{item.username}</Text>
              {!!item.fullName && (
                <Text style={styles.fullName}>{item.fullName}</Text>
              )}
              {/* {!!item.profile && (
                <Text style={[styles.profileType, { color: accentColor }]}>{item.profile}</Text>
              )} */}
            </View>

            {String(item.id) !== String(selfUserId) && (
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  followBusyById[item.id]
                    ? [styles.follow, { backgroundColor: accentColor, shadowColor: accentColor }]
                    : isFollowingState
                      ? [styles.following, { borderColor: accentColor }]
                      : [styles.follow, { backgroundColor: accentColor, shadowColor: accentColor }],
                ]}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  handleVallowingClick(item);
                }}
                disabled={!!followBusyById[item.id]}
              >
                {followBusyById[item.id] ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={isFollowingState ? [styles.followingText, { color: accentColor }] : styles.followText}>
                    {isFollowingState ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
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
            Followers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'following' && styles.tabBtnActive && { backgroundColor: text, shadowColor: text },
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
            Following
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={[styles.searchBar, { shadowColor: text }]}
        placeholder={
          activeTab === 'followers' ? 'Search Followers' : 'Search Following'
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
                No {activeTab === 'followers' ? 'Followers' : 'Following'} yet
              </Text>
            </View>
          )}
        />
      )}

      <SupportCreatorModal
        visible={supportModalVisible}
        creatorName={selectedSupportUser?.username || 'Creator'}
        onClose={() => setSupportModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={selectedSupportUser?.username || 'Creator'}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
      />
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
    backgroundColor: '#5a2d82',
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
  profileType: { color: '#8B5CF6', fontSize: 12, fontWeight: '600', marginTop: 2 },

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
  follow: {
    // backgroundColor: '#5a2d82',
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
