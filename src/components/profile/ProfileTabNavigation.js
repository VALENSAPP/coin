import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions
} from 'react-native';
import PostsScreen from '../profile/PostScreen';
import ReelsScreen from '../profile/ReelsScreen';
import PrivateContentScreen from './PrivateContentScreen';
import PrivateCircle from './PrivateCircle';
import Shop from './Shop';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LockKey, ProfileReelIcon } from '../../assets/icons';
import { Image } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import SubscribeModal from '../modals/SubscriptionModal';
import { getFansubscriptionStatus } from '../../services/stirpe';
import {
  privateSetup,
  parsePrivateCircleSetup,
  isPrivateCircleApiSuccess,
} from '../../services/privatecircle';
import { useNavigation } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
const { width: screenWidth } = Dimensions.get('window');

const ProfileTabs = memo(({
  post,
  displayName,
  userData,
  profileType,
  dashboard,
  targetUserId,
  isSubscribed: isSubscribedProp,
  loggedInUserId,
  refreshKey,
  onPostPinChanged,
  scrollEnabled = false,
  initialTab,
}) => {
  const navigation = useNavigation();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [privateKey, setPrivatKey] = useState(0);

  const effectiveProfileType = profileType || userData?.profile;
  const { text, bg, card, border, mutedText, icon, cardStyle } = useAppTheme(effectiveProfileType);
  const { t } = useLanguage();

  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const targetProfileId = targetUserId || userData?.id;

  useEffect(() => {
    const normalizedIsSubscribed =
      isSubscribedProp === true ||
      String(isSubscribedProp || '').toUpperCase() === 'ACTIVE' ||
      String(isSubscribedProp || '').toLowerCase() === 'true';
    setIsSubscribed(normalizedIsSubscribed);
  }, [isSubscribedProp]);

  const isActiveStatus = useCallback((value) => {
    if (value === true) return true;
    return String(value || '').toUpperCase() === 'ACTIVE';
  }, []);

  const getSubscriptionStatus = useCallback(async (id) => {
    if (!id || isOwnProfile) return true;
    try {
      const response = await getFansubscriptionStatus(id);
      const data = response?.data;
      let isActive = false;
      if (
        isActiveStatus(response?.status) ||
        isActiveStatus(data?.status) ||
        isActiveStatus(data?.subscriptionStatus) ||
        isActiveStatus(data?.subscription?.status) ||
        isActiveStatus(data?.fanSubscription?.status)
      ) {
        isActive = true;
      } else if (typeof data?.isSubscribed === 'boolean') {
        isActive = data.isSubscribed;
      }
      setIsSubscribed(isActive);
      return isActive;
    } catch (error) {
      setIsSubscribed(false);
      return false;
    }
  }, [isOwnProfile, isActiveStatus]);

  const handlePrivateCircleStartPress = useCallback(async () => {
    try {
      const response = await privateSetup();
      if (!isPrivateCircleApiSuccess(response)) {
        showToastMessage(
          toast,
          'danger',
          response?.message || t('privateCircleMint.setupError'),
        );
        return;
      }

      const { members, count } = parsePrivateCircleSetup(response);
      const parentNavigation = navigation.getParent?.() || navigation;
      if (count > 0) {
        parentNavigation.navigate('Add', {
          screen: 'PrivateCircleReview',
          params: {
            mode: 'mint',
            members,
            selectedIds: members.map((member) => member.id),
            selectedMembers: members,
          },
        });
        return;
      }

      parentNavigation.navigate('Add', {
        screen: 'PrivateCircleWelcome',
        params: { mode: 'setup' },
      });
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('privateCircleMint.setupError'),
      );
    }
  }, [navigation, t, toast]);

  const PRIVATE_CIRCLE_TAB_INDEX = 1; 
  const PRIVATE_CONTENT_TAB_INDEX = 3;

  // ── Tab screens — stable identity, only remount when data deps change ────────
  const tabScreens = useMemo(() => ({
    posts: (
      <PostsScreen
        postCheck={post}
        userData={userData}
        isOwnProfile={isOwnProfile}
        onPostPinChanged={onPostPinChanged}
        scrollEnabled={false}
      />
    ),

    privateCircle: (
      <PrivateCircle
        isOwnProfile={isOwnProfile}
        userData={userData}
        onStartPress={handlePrivateCircleStartPress}
        loggedInUserId={loggedInUserId}
         isActiveTab={activeTab === PRIVATE_CIRCLE_TAB_INDEX}
      />
    ),

    reels: (
      <ReelsScreen
        postCheck={post}
        userData={userData}
        isOwnProfile={isOwnProfile}
        onPostPinChanged={onPostPinChanged}
        scrollEnabled={false}
      />
    ),

    privateContent: (
      <PrivateContentScreen
        postCheck={post}
        userData={userData}
        isSubscribed={isSubscribed}
        loggedInUserId={loggedInUserId}
        onSubscribePress={() => userData?.profile !== 'company' && setShowSubscribeModal(true)}
        isCompany={userData?.profile === 'company'}
        refreshKey={`${refreshKey ?? 0}-${privateKey}`}
        scrollEnabled={false}
        isActiveTab={activeTab === PRIVATE_CONTENT_TAB_INDEX}  
      />
    ),

    closet: (
      <Shop isOwnProfile={isOwnProfile} userData={userData} />
    ),
  }), [
    post,
    userData,
    isOwnProfile,
    onPostPinChanged,
  ]);

  const renderTabScreen = useCallback((tabKey, isTabActive) => {
    if (tabKey === 'privateCircle') {
      return (
        <PrivateCircle
          isOwnProfile={isOwnProfile}
          userData={userData}
          onStartPress={handlePrivateCircleStartPress}
          loggedInUserId={loggedInUserId}
          isTabActive={isTabActive}
        />
      );
    }

    if (tabKey === 'privateContent') {
      return (
        <PrivateContentScreen
          postCheck={post}
          userData={userData}
          isSubscribed={isSubscribed}
          loggedInUserId={loggedInUserId}
          onSubscribePress={() => userData?.profile !== 'company' && setShowSubscribeModal(true)}
          isCompany={userData?.profile === 'company'}
          refreshKey={`${refreshKey ?? 0}-${privateKey}`}
          scrollEnabled={false}
          isTabActive={isTabActive}
        />
      );
    }

    return tabScreens[tabKey] ?? null;
  }, [
    handlePrivateCircleStartPress,
    isOwnProfile,
    isSubscribed,
    loggedInUserId,
    post,
    privateKey,
    refreshKey,
    tabScreens,
    userData,
    handlePrivateCircleStartPress,
    onPostPinChanged,
    activeTab
  ]);

  // ── Tab metadata — icons/labels/onPress only, NO screen elements ─────────────
  const tabs = useMemo(() => {
    const list = [
      {
        key: 'posts',
        label: t('profileTabs.postsTab'),
        icon: (focused) => (
          <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={focused ? text : mutedText} />
        ),
      },
      {
        key: 'privateCircle',
        label: t('profileTabs.privateCircleTab'),
        icon: (focused) => (
          <Image
            source={require('../../assets/icons/pngicons/private.png')}
            style={{ width: 35, height: 35, tintColor: focused ? text : mutedText }}
          />
        ),
      },
      {
        key: 'reels',
        label: t('profileTabs.reelsTab'),
        icon: (focused) => (
          <ProfileReelIcon fill={focused ? text : mutedText} height={24} width={24} />
        ),
      },
      {
        key: 'privateContent',
        label: userData?.profile === 'company' ? t('profileTabs.shopTab') : t('profileTabs.privateContentTab'),
        icon: (focused) =>
          userData?.profile === 'company' ? (
            <MaterialIcons name="shopping-bag" size={24} color={focused ? text : mutedText} />
          ) : (
            <LockKey fill={focused ? text : mutedText} height={24} width={24} />
          ),
        onPress: async () => {
          if (!loggedInUserId || isOwnProfile || isSubscribed) return;
          const hasActive = await getSubscriptionStatus(targetProfileId);
          if (!hasActive && userData?.profile !== 'company') {
            setPrivatKey(p => p + 1);
            setTimeout(() => setShowSubscribeModal(true), 50);
          }
        },
      },
    ];

    if (userData?.profile === 'user') {
      list.push({
        key: 'closet',
        label: t('profileTabs.myClosetTab'),
        icon: (focused) => (
          <Image
            source={require('../../assets/icons/pngicons/shop.png')}
            style={{ width: 35, height: 35, tintColor: focused ? text : mutedText }}
          />
        ),
      });
    }

    return list;
  }, [
    text,
    mutedText,
    card,
    border,
    t,
    userData,
    isOwnProfile,
    isSubscribed,
    loggedInUserId,
    targetProfileId,
    getSubscriptionStatus,
  ]);

  useEffect(() => {
    if (!initialTab) return;
    const index = tabs.findIndex(tab => tab.key === initialTab);
    if (index < 0) return;

    setActiveTab(index);

    const timer = setTimeout(async () => {
      if (!loggedInUserId || isOwnProfile) return;
      const hasActive = await getSubscriptionStatus(targetProfileId);
      if (!hasActive && userData?.profile !== 'company') {
        setPrivatKey(p => p + 1);
        setShowSubscribeModal(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [initialTab, loggedInUserId]);

  return (
    <View style={styles.tabsRoot}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: card, borderBottomColor: border }]}>
        {tabs.map((tab, index) => {
          const focused = activeTab === index;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={async () => {
                setActiveTab(index);
                await tab.onPress?.();
              }}
              activeOpacity={0.7}
            >
              {tab.icon(focused)}
              {focused && (
                <View style={[styles.indicator, { backgroundColor: text }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content — all tabs stay mounted, inactive ones are hidden */}
      <View style={styles.contentWrapper}>
        {tabs.map((tab, index) => {
          const isTabActive = activeTab === index;
          return (
            <View
              key={tab.key}
              style={isTabActive ? styles.tabVisible : styles.tabHidden}
              pointerEvents={isTabActive ? 'auto' : 'none'}
            >
              {renderTabScreen(tab.key, isTabActive)}
            </View>
          );
        })}
      </View>

      {!isSubscribed && (
        <SubscribeModal
          visible={showSubscribeModal}
          onClose={() => setShowSubscribeModal(false)}
          membershipPrice={19.99}
          onPaymentDone={() => {
            setIsSubscribed(true);
            setShowSubscribeModal(false);
            setPrivatKey(p => p + 1);
          }}
          displayName={displayName}
          userData={userData}
          dashboard={dashboard}
          targetUserId={targetProfileId}
        />
      )}
    </View>
  );
});

ProfileTabs.displayName = 'ProfileTabs';
export default ProfileTabs;

const styles = StyleSheet.create({
  tabsRoot: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 52,
    borderBottomWidth: 1,
    elevation: 2,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    marginTop: 2,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 3,
    borderRadius: 999,
  },
  contentWrapper: {
    flex: 1,
    width: screenWidth,
  },
  tabVisible: {
    flex: 1,
    width: screenWidth,
  },
  tabHidden: {
    position: 'absolute',
    width: screenWidth,
    opacity: 0,
    zIndex: -1,
  },
});