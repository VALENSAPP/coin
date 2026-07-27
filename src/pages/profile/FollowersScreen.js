import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
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
import TipSupportModal from '../../components/modals/TipSupportModal';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useDispatch } from 'react-redux';
import { connectWalletLogin } from '../authentication/socialLogin';
import { updateWallet } from '../../services/wallet';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import {
  getSupportRecipientWalletAddress,
  handleMetaMaskSupportFlow,
  openWalletPayment,
} from '../../utils/metaMaskSupport';
import {
  isSupportAllowed,
  normalizeProfileType,
} from '../../utils/supportEligibility';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useLanguage } from '../../i18n';
import { navigateToUserProfile } from '../../utils/navigateToUserProfile';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function FollowersFollowingScreen({ navigation, route }) {
  const initialTab = route?.params?.tab;

  const headerUsername =
    route?.params?.params?.userName ||
    route?.params?.userName ||
    route?.params?.username ||
    route?.params?.user?.Username ||
    'Unknown User';
  const profileUserIdFromRoute = route?.params?.userId || route?.params?.params?.userId || null;

  const [selfUserId, setSelfUserId] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab == 'following' ? 'following' : 'followers');
  const [search, setSearch] = useState('');
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [followBusyById, setFollowBusyById] = useState({});
  const [walletAddress, setWalletAddress] = useState('');
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [tipPurchaseVisible, setTipPurchaseVisible] = useState(false);
  const [selectedSupportUser, setSelectedSupportUser] = useState(null);
  const [selfProfileType, setSelfProfileType] = useState('user');

  const toast = useToast();
  const { startSupportPayment } = useWalletConnectSupport();
  const {
    bgStyle,
    textStyle,
    accent,
    card,
    cardStyle,
    border,
    mutedText,
    mutedTextStyle,
    icon,
  } = useBusinessProfileTheme();
  const { t } = useLanguage();

  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        const storedWalletAddress = await AsyncStorage.getItem('walletAddress');
        const storedProfile = await AsyncStorage.getItem('profile');
        setSelfUserId(id ? String(id) : null);
        setWalletAddress(storedWalletAddress || '');
        setSelfProfileType(normalizeProfileType(storedProfile || 'user'));
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const shapeUser = (u, { defaultFollowing = false, followsMe = false } = {}) => ({
    id: String(u?.id ?? u?._id ?? u?.userId ?? ''),
    username: u?.userName ?? u?.username ?? 'unknown',
    fullName: u?.displayName ?? u?.fullName ?? '',
    profile: u?.profile ?? u?.accountType ?? '',
    avatar: u?.image ?? u?.avatar ?? DEFAULT_AVATAR,
    isFollowing: typeof u?.isFollowing === 'boolean' ? u.isFollowing : !!defaultFollowing,
    followsMe,
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

  const getRelationUserId = useCallback((rel, relationType) => {
    const user =
      relationType === 'following'
        ? rel?.following || rel?.user || rel?.toUser || rel?.to || null
        : rel?.follower || rel?.followerUser || rel?.user || rel?.fromUser || rel?.from || null;

    return user?.id ?? user?._id ?? user?.userId ?? null;
  }, []);

  const fetchSelfRelationshipIds = useCallback(async () => {
    if (!selfUserId) {
      return { followingSet: new Set(), followerSet: new Set() };
    }

    try {
      const [followingRes, followersRes] = await Promise.all([
        apiFollowing(selfUserId),
        apiFollowers(selfUserId),
      ]);

      const followingIds = (followingRes?.data?.data ?? followingRes?.data ?? [])
        .map(rel => getRelationUserId(rel, 'following'))
        .filter(Boolean)
        .map(id => String(id));
      const followerIds = (followersRes?.data?.data ?? followersRes?.data ?? [])
        .map(rel => getRelationUserId(rel, 'followers'))
        .filter(Boolean)
        .map(id => String(id));

      return {
        followingSet: new Set(followingIds),
        followerSet: new Set(followerIds),
      };
    } catch (_e) {
      return { followingSet: new Set(), followerSet: new Set() };
    }
  }, [getRelationUserId, selfUserId]);

  const loadData = useCallback(
    async (tab, { silent = false } = {}) => {
      if (!authReady) return;

      const profileUserId = profileUserIdFromRoute || selfUserId;
      if (!profileUserId) {
        if (!silent) setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      try {
        const { followingSet, followerSet } = await fetchSelfRelationshipIds();

        if (tab === 'followers') {
          const res = await apiFollowers(profileUserId);
          const rows = res?.data?.data ?? res?.data ?? [];
          const users = rows
            .map((rel) => {
              const user =
                rel?.follower || rel?.followerUser || rel?.user || rel?.fromUser || rel?.from || null;
              if (!user) return null;

              const userId = user?.id ?? user?._id ?? user?.userId ?? null;
              const derivedFollowing = userId
                ? followingSet.has(String(userId))
                : false;
              const followsMe = userId ? followerSet.has(String(userId)) : false;
              return shapeUser(user, { defaultFollowing: derivedFollowing, followsMe });
            })
            .filter(Boolean);
          const usersWithProfile = await enrichUsersWithProfile(users);
          setFollowersList(usersWithProfile);
        } else {
          const res = await apiFollowing(profileUserId);
          const rows = res?.data?.data ?? res?.data ?? [];
          const users = rows
            .map(rel => rel?.following || rel?.user || rel?.toUser || rel?.to || null)
            .filter(Boolean)
            .map((u) => {
              const userId = u?.id ?? u?._id ?? u?.userId ?? null;
              const derivedFollowing = userId
                ? followingSet.has(String(userId)) || String(profileUserId) === String(selfUserId)
                : false;
              const followsMe = userId ? followerSet.has(String(userId)) : false;
              return shapeUser(u, { defaultFollowing: derivedFollowing, followsMe });
            });
          const usersWithProfile = await enrichUsersWithProfile(users);
          setFollowingList(usersWithProfile);
        }
      } catch (e) {
        console.log(e);
        Alert.alert(
          t('followersFollowing.errorTitle'),
          e?.response?.data?.message || t('followersFollowing.loadListError'),
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [authReady, profileUserIdFromRoute, selfUserId, enrichUsersWithProfile, fetchSelfRelationshipIds, t],
  );

  useEffect(() => {
    if (authReady && (selfUserId || profileUserIdFromRoute)) {
      loadData(activeTab);
    }
  }, [activeTab, authReady, selfUserId, profileUserIdFromRoute, loadData]);

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
            res?.data?.message || res?.message || t('followersFollowing.unableToUpdateFollow'),
          );
          return;
        }

        const serverVal = res?.data?.following;
        const resolvedFollowing =
          typeof serverVal === 'boolean' ? serverVal : shouldFollow;
        updateFollowState(user.id, resolvedFollowing);

        if (resolvedFollowing && shouldFollow) {
          const recipientProfile = normalizeProfileType(user.profile);
          if (isSupportAllowed({ supporterProfile: selfProfileType, recipientProfile })) {
            setSelectedSupportUser({ ...user, isFollowing: true });
            setSupportModalVisible(true);
          }
        }
      } catch (e) {
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || t('followersFollowing.somethingWentWrong'),
        );
      } finally {
        setFollowBusyById(prev => ({ ...prev, [user.id]: false }));
      }
    },
    [followBusyById, toast, updateFollowState, selfProfileType, t],
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
        t('followersFollowing.supportUnavailableTitle'),
        t('followersFollowing.supportUnavailableMessage'),
      );
      setSupportModalVisible(false);
      return;
    }
    setSupportModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, [selfProfileType, selectedSupportUser?.profile, t]);

  const handleSupportNow = useCallback(async () => {
    if (!canSupport) {
      Alert.alert(
        t('followersFollowing.walletNotConnectedTitle'),
        t('followersFollowing.walletNotConnectedMessage'),
      );
      return;
    }
    setSupportDisclaimerVisible(false);
    await startSupportPayment(recipientWalletAddress, {
      senderId: selfUserId != null ? String(selfUserId) : '',
      receiverId: selectedSupportUser?.id != null ? String(selectedSupportUser.id) : '',
      chain: 'POLYGON',
    });
  }, [
    canSupport,
    recipientWalletAddress,
    startSupportPayment,
    selfUserId,
    selectedSupportUser?.id,
    t,
  ]);

  const handleSendTip = useCallback(() => {
    setSupportDisclaimerVisible(false);
    setTipPurchaseVisible(true);
  }, []);

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
    return String(profileType || '').toLowerCase() === 'company' ? '#C9A15a' : '#5a2d82';
  }, []);

  const goToUserProfile = useCallback(
    (user) => {
      if (!user?.id) return;

      const returnToPayload = {
        tab: 'ProfileMain',
        screen: 'FollowersFollowingScreen',
        params: {
          tab: activeTab,
          userName: headerUsername,
          userId: profileUserIdFromRoute,
          returnTo: route?.params?.returnTo,
          screenParams: route?.params?.screenParams || route?.params?.params,
        },
      };

      void navigateToUserProfile(navigation, user.id, {
        loggedInUserId: selfUserId,
        username: user.username,
        returnTo: returnToPayload,
      });
    },
    [
      activeTab,
      headerUsername,
      navigation,
      profileUserIdFromRoute,
      route?.params,
      selfUserId,
    ],
  );

  const handleBack = () => {
    const nested = route?.params?.params || {};
    const screenParams =
      route?.params?.screenParams ||
      nested?.screenParams ||
      nested ||
      {};
    const returnTo = route?.params?.returnTo || nested?.returnTo;

    if (returnTo === 'Dashboard') {
      navigation.navigate('wallet', { screen: 'Dashboard' });
      return;
    }

    // Prefer real stack history for other cases — custom returnTo routes often break 
    // (e.g. own profile wrongly sent to CreatorProfile and never leaves this screen).
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const targetUserId =
      screenParams?.userId ||
      route?.params?.userId ||
      nested?.userId ||
      '';
    const targetUsername =
      screenParams?.username ||
      screenParams?.userName ||
      route?.params?.userName ||
      nested?.userName ||
      '';

    if (returnTo === 'Home' && targetUserId) {
      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: targetUserId,
          username: targetUsername,
          returnTo: screenParams?.returnTo || 'Home',
        },
      });
      return;
    }



    navigation.navigate('ProfileMain', { screen: 'Profile' });
  };
  const renderItem =
    tab =>
      ({ item }) => {
        const isFollowingState = !!item.isFollowing;
        const followButtonLabel = isFollowingState
          ? t('followersFollowing.following')
          : item.followsMe
            ? t('followersFollowing.followback')
            : t('followersFollowing.follow');
        const accentColor = getUserAccentColor(item?.profile);

        return (
          <TouchableOpacity
            style={[styles.userRow, cardStyle, { shadowColor: accentColor, borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}
            activeOpacity={0.7}
            onPress={() => goToUserProfile(item)}
          >
            <View style={styles.avatarWrap}>
              <HexAvatar
                uri={item.avatar || DEFAULT_AVATAR}
                size={50}
                borderWidth={2}
                borderColor={accentColor}
              />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: accentColor }]}>{item.username}</Text>
              {!!item.fullName && (
                <Text style={[styles.fullName, mutedTextStyle]}>{item.fullName}</Text>
              )}
            </View>

            {String(item.id) !== String(selfUserId) && (
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  followBusyById[item.id] || !isFollowingState
                    ? { backgroundColor: accentColor, shadowColor: accentColor }
                    : { backgroundColor: card, borderColor: accentColor, borderWidth: 1.5 },
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
                  <Text style={isFollowingState
                    ? [styles.followingText, { color: accentColor }]
                    : styles.followText}
                  >
                    {followButtonLabel}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      };

  const listData = activeTab === 'followers' ? filteredFollowers : filteredFollowing;

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* Header */}
      <View style={styles.headerView}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.usernameHeader, textStyle]}>{headerUsername}</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: card, borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'followers' && [styles.tabBtnActive, { backgroundColor: accent, shadowColor: accent }],
          ]}
          onPress={() => setActiveTab('followers')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'followers'
                ? styles.tabTextActive
                : { color: mutedText },
            ]}
          >
            {t('followersFollowing.followersTab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'following' && [styles.tabBtnActive, { backgroundColor: accent, shadowColor: accent }],
          ]}
          onPress={() => setActiveTab('following')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'following'
                ? styles.tabTextActive
                : { color: mutedText },
            ]}
          >
            {t('followersFollowing.followingTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={[
          styles.searchBar,
          cardStyle,
          textStyle,
          { shadowColor: accent, borderColor: border, borderWidth: StyleSheet.hairlineWidth },
        ]}
        placeholder={
          activeTab === 'followers'
            ? t('followersFollowing.searchFollowers')
            : t('followersFollowing.searchFollowing')
        }
        placeholderTextColor={mutedText}
        value={search}
        onChangeText={setSearch}
      />

      {/* List */}
      {loading ? (
        <View style={{ paddingTop: 40 }}>
          <ActivityIndicator color={accent} />
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem(activeTab)}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={refreshing}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', paddingTop: 30 }}>
              <Text style={mutedTextStyle}>
                {activeTab === 'followers'
                  ? t('followersFollowing.noFollowers')
                  : t('followersFollowing.noFollowing')}
              </Text>
            </View>
          )}
        />
      )}

      <SupportCreatorModal
        visible={supportModalVisible}
        creatorName={selectedSupportUser?.username || t('followersFollowing.creatorFallback')}
        onClose={() => setSupportModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={selectedSupportUser?.username || t('followersFollowing.creatorFallback')}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
        onTipSupport={handleSendTip}
        canSupport={canSupport}
      />
      <TipSupportModal
        visible={tipPurchaseVisible}
        creatorName={selectedSupportUser?.username || t('followersFollowing.creatorFallback')}
        vendorId={selectedSupportUser?.id}
        onClose={() => setTipPurchaseVisible(false)}
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
      zIndex: 2,
    },
    backBtn: {
      padding: 4,
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
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
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
      borderRadius: 12,
      marginBottom: 10,
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    avatarWrap: {
      marginRight: 14,
    },
    userInfo: { flex: 1 },
    username: { fontWeight: '700', fontSize: 16 },
    fullName: { fontSize: 14 },

    // Follow button
    followBtn: {
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 6,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
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
    tipModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(12, 8, 20, 0.45)',
      justifyContent: 'flex-end',
    },
    tipModalSheet: {
      backgroundColor: '#FFFFFF',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      minHeight: 500,
      paddingBottom: 20,
    },
  });
