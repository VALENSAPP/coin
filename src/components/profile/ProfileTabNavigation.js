import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useNavigation } from '@react-navigation/native';
import PostsScreen from '../profile/PostScreen';
import ReelsScreen from '../profile/ReelsScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LockKey, ProfileReelIcon } from '../../assets/icons';
import SubscribeModal from '../modals/SubscriptionModal';
import { useAppTheme } from '../../theme/useApptheme';
import PrivateContentScreen from './PrivateContentScreen';
import { getFansubscriptionStatus } from '../../services/stirpe';
import PrivateCircle from './PrivateCircle';
import Shop from './Shop';
import { Dimensions, Image } from 'react-native';
import { useLanguage } from '../../i18n';

const Tab = createMaterialTopTabNavigator();

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
  ListHeaderComponent,
  onScroll,
  scrollEventThrottle,
  refreshControl,
  onPostPinChanged,
  scrollEnabled = true,
}) => {
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [privateKey, setPrivatKey] = useState(0);

  const effectiveProfileType = profileType || userData?.profile;
  const { textStyle, text } = useAppTheme(effectiveProfileType);
  const { t } = useLanguage();

  const tabScreenOptions = useMemo(() => ({
    tabBarShowLabel: false,
    swipeEnabled: true,
    animationEnabled: true,
    lazy: true,
    lazyPlaceholder: () => null,
    tabBarStyle: {
      marginTop: 2,
      height: 52,
      backgroundColor: '#fff',
      elevation: 2,
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    tabBarIndicatorStyle: {
      backgroundColor: text,
      height: 3,
      borderRadius: 999,
      bottom: 0,
    },
    tabBarIconStyle: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabBarPressColor: 'transparent',
    tabBarPressOpacity: 0.7,
  }), [text]);

  useEffect(() => {
    const normalizedIsSubscribed =
      isSubscribedProp === true ||
      String(isSubscribedProp || '').toUpperCase() === 'ACTIVE' ||
      String(isSubscribedProp || '').toLowerCase() === 'true';
    setIsSubscribed(normalizedIsSubscribed);
  }, [isSubscribedProp]);

  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const targetProfileId = targetUserId || userData?.id;

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
      } else if (Array.isArray(data?.subscriptions)) {
        isActive = data.subscriptions.some((sub) => isActiveStatus(sub?.status));
      } else if (Array.isArray(data)) {
        isActive = data.some((sub) => isActiveStatus(sub?.status));
      }
      setIsSubscribed(isActive);
      return isActive;
    } catch (error) {
      console.log('Error checking fan subscription status:', error);
      setIsSubscribed(false);
      return false;
    }
  }, [isOwnProfile, isActiveStatus]);

  const renderPostsScreen = useCallback(
    (navProps) => (
      <PostsScreen
        {...navProps}
        postCheck={post}
        userData={userData}
        isOwnProfile={isOwnProfile}
        onPostPinChanged={onPostPinChanged}
        scrollEnabled={scrollEnabled}
      />
    ),
    [post, userData, isOwnProfile, onPostPinChanged, scrollEnabled],
  );

  const renderReelsScreen = useCallback(
    (navProps) => (
      <ReelsScreen
        {...navProps}
        postCheck={post}
        userData={userData}
        isOwnProfile={isOwnProfile}
        onPostPinChanged={onPostPinChanged}
        scrollEnabled={scrollEnabled}
      />
    ),
    [post, userData, isOwnProfile, onPostPinChanged, scrollEnabled],
  );

  const renderPrivateContentScreen = useCallback(
    (navProps) => (
      <PrivateContentScreen
        {...navProps}
        postCheck={post}
        userData={userData}
        isSubscribed={isSubscribed}
        loggedInUserId={loggedInUserId}
        onSubscribePress={() => { userData?.profile !== 'company' && setShowSubscribeModal(true); }}
        isCompany={userData?.profile === 'company'}
        refreshKey={`${refreshKey ?? 0}-${privateKey}`}
        scrollEnabled={scrollEnabled}
      />
    ),
    [post, userData, isSubscribed, loggedInUserId, refreshKey, privateKey, scrollEnabled],
  );

  const renderPrivateCircleScreen = useCallback(
    (navProps) => <PrivateCircle {...navProps} isOwnProfile={isOwnProfile} userData={userData} />,
    [isOwnProfile, userData],
  );

  const renderShopScreen = useCallback(
    (navProps) => <Shop {...navProps} isOwnProfile={isOwnProfile} userData={userData} />,
    [isOwnProfile, userData],
  );

  const navigation = useNavigation();

  const handleModalClose = () => {
    setShowSubscribeModal(false);
  };

  const handleSubscription = () => {
    setIsSubscribed(true);
    setShowSubscribeModal(false);
    setPrivatKey((prev) => prev + 1);
  };

  return (
    <>
      <Tab.Navigator
        initialLayout={{ width: Dimensions.get('window').width }}
        screenOptions={tabScreenOptions}
      >
        {/* Posts Tab */}
        <Tab.Screen
          name="Posts"
          options={{
            tabBarAccessibilityLabel: t('profileTabs.postsTab'),
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={24}
                color={focused ? text : '#6b7280'}
              />
            ),
          }}
        >
          {renderPostsScreen}
        </Tab.Screen>

        {/* Private Circle Tab */}
        <Tab.Screen
          name="Private Circle"
          options={{
            tabBarAccessibilityLabel: t('profileTabs.privateCircleTab'),
            tabBarIcon: ({ focused }) => (
              <Image
                source={require('../../assets/icons/pngicons/private.png')}
                style={{
                  width: 35,
                  height: 35,
                  tintColor: focused ? text : '#6b7280',
                }}
              />
            ),
          }}
        >
          {renderPrivateCircleScreen}
        </Tab.Screen>

        {/* Reels Tab */}
        <Tab.Screen
          name="Reels"
          options={{
            tabBarAccessibilityLabel: t('profileTabs.reelsTab'),
            tabBarIcon: ({ focused }) => (
              <ProfileReelIcon
                fill={focused ? text : '#6b7280'}
                height={24}
                width={24}
              />
            ),
          }}
        >
          {renderReelsScreen}
        </Tab.Screen>

        {/* Private Content / Shop Tab */}
        <Tab.Screen
          name="PrivateContent"
          options={{
            tabBarAccessibilityLabel: userData?.profile === 'company'
              ? t('profileTabs.shopTab')
              : t('profileTabs.privateContentTab'),
            tabBarIcon: ({ focused }) => (
              userData?.profile === 'company' ? (
                <MaterialIcons
                  name="shopping-bag"
                  size={24}
                  color={focused ? text : '#6b7280'}
                />
              ) : (
                <LockKey
                  fill={focused ? text : '#6b7280'}
                  height={24}
                  width={24}
                />
              )
            ),
          }}
          listeners={{
            tabPress: async () => {
              if (!loggedInUserId) return;
              if (isOwnProfile || isSubscribed) {
                setShowSubscribeModal(false);
                return;
              }
              const hasActiveSubscription = await getSubscriptionStatus(targetProfileId);
              if (hasActiveSubscription) {
                setShowSubscribeModal(false);
                return;
              }
              if (!isOwnProfile) {
                setPrivatKey(prev => prev + 1);
                setShowSubscribeModal(false);
                setTimeout(() => {
                  if (userData?.profile !== 'company') {
                    setShowSubscribeModal(true);
                  }
                }, 50);
              }
            },
          }}
        >
          {renderPrivateContentScreen}
        </Tab.Screen>

        {/* My Closet Tab — users only */}
        {userData?.profile === 'user' && (
          <Tab.Screen
            name="My Closet"
            options={{
              tabBarAccessibilityLabel: t('profileTabs.myClosetTab'),
              tabBarIcon: ({ focused }) => (
                <Image
                  source={require('../../assets/icons/pngicons/shop.png')}
                  style={{
                    width: 35,
                    height: 35,
                    tintColor: focused ? text : '#6b7280',
                  }}
                />
              ),
            }}
          >
            {renderShopScreen}
          </Tab.Screen>
        )}
      </Tab.Navigator>

      {!isSubscribed && (
        <SubscribeModal
          visible={showSubscribeModal}
          onClose={handleModalClose}
          membershipPrice={19.99}
          onPaymentDone={(info) => {
            console.log('Payment info:', info);
            handleSubscription();
          }}
          displayName={displayName}
          userData={userData}
          dashboard={dashboard}
          targetUserId={targetProfileId}
        />
      )}
    </>
  );
});

ProfileTabs.displayName = 'ProfileTabs';
export default ProfileTabs;
