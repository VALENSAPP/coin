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
import useScreenshotProtection from '../../hooks/useScreenshotProtection';

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
  const { text } = useAppTheme(effectiveProfileType);
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

  const tabs = useMemo(() => {
    const list = [
      {
        key: 'posts',
        label: t('profileTabs.postsTab'),
        icon: (focused) => (
          <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={focused ? text : '#6b7280'} />
        ),
        screen: (
          <PostsScreen
            postCheck={post}
            userData={userData}
            isOwnProfile={isOwnProfile}
            onPostPinChanged={onPostPinChanged}
            scrollEnabled={false}
          />
        ),
      },
      {
        key: 'privateCircle',
        label: t('profileTabs.privateCircleTab'),
        icon: (focused) => (
          <Image
            source={require('../../assets/icons/pngicons/private.png')}
            style={{ width: 35, height: 35, tintColor: focused ? text : '#6b7280' }}
          />
        ),
        screen: (
          <PrivateCircle
            isOwnProfile={isOwnProfile}
            userData={userData}
            onStartPress={handlePrivateCircleStartPress}
            loggedInUserId={loggedInUserId}
          />
        ),
      },
      {
        key: 'reels',
        label: t('profileTabs.reelsTab'),
        icon: (focused) => (
          <ProfileReelIcon fill={focused ? text : '#6b7280'} height={24} width={24} />
        ),
        screen: (
          <ReelsScreen
            postCheck={post}
            userData={userData}
            isOwnProfile={isOwnProfile}
            onPostPinChanged={onPostPinChanged}
            scrollEnabled={false}
          />
        ),
      },
      {
        key: 'privateContent',
        label: userData?.profile === 'company' ? t('profileTabs.shopTab') : t('profileTabs.privateContentTab'),
        icon: (focused) =>
          userData?.profile === 'company' ? (
            <MaterialIcons name="shopping-bag" size={24} color={focused ? text : '#6b7280'} />
          ) : (
            <LockKey fill={focused ? text : '#6b7280'} height={24} width={24} />
          ),
        screen: (
          <PrivateContentScreen
            postCheck={post}
            userData={userData}
            isSubscribed={isSubscribed}
            loggedInUserId={loggedInUserId}
            onSubscribePress={() => userData?.profile !== 'company' && setShowSubscribeModal(true)}
            isCompany={userData?.profile === 'company'}
            refreshKey={`${refreshKey ?? 0}-${privateKey}`}
            scrollEnabled={false}
          />
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
            style={{ width: 35, height: 35, tintColor: focused ? text : '#6b7280' }}
          />
        ),
        screen: <Shop isOwnProfile={isOwnProfile} userData={userData} />,
      });
    }

    return list;
  }, [
    post,
    userData,
    isOwnProfile,
    isSubscribed,
    loggedInUserId,
    refreshKey,
    privateKey,
    text,
    t,
    handlePrivateCircleStartPress,
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

  const privateContentTabIndex = tabs.findIndex(tab => tab.key === 'privateContent');
  const isPrivateContentTabActive =
    privateContentTabIndex >= 0 && activeTab === privateContentTabIndex;

  useScreenshotProtection({
    enabled: isPrivateContentTabActive,
    title: t('postView.screenshotWarningTitle'),
    message: t('postView.screenshotWarningMessage'),
  });

  return (
    <View style={styles.tabsRoot}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { borderBottomColor: '#e5e7eb' }]}>
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

      {/* Active Tab Content — renders directly, no fixed height */}
      <View style={styles.content}>
        {tabs[activeTab]?.screen}
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
    backgroundColor: '#fff',
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
  content: {
    // No fixed height — grows with content naturally
    width: screenWidth,
  },
});