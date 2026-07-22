import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { normalizeProfileType } from '../../utils/supportEligibility';
import SubscribeModal from '../modals/SubscriptionModal';
import { getFansubscriptionStatus } from '../../services/stirpe';
import {
  getMyClosetMe,
  getMyClosetById,
  trackClosetView, 
} from '../../services/myCloset';
import {
  privateSetup,
  parsePrivateCircleSetup,
  isPrivateCircleApiSuccess,
} from '../../services/privatecircle';
import { useNavigation } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../displaytoastmessage';
import ProfileEbookScreen from './ProfileEbookScreen';
import MyClosetShopFront from './MyClosetShopFront';
import BusinessShop from './BusinessShop';
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
  const [mediaTab, setMediaTab] = useState('photo');
  const [hasCreatedShop, setHasCreatedShop] = useState(false);
  const [shopDraft, setShopDraft] = useState(null);
  const [closetCheckComplete, setClosetCheckComplete] = useState(false);
  // Full closet object returned by getMyClosetMe/getMyClosetById, e.g.
  // { id, userId, shopName, shopUsername, shopLogo, description, ... }
  const [closetData, setClosetData] = useState(null);

  const effectiveProfileType = normalizeProfileType(profileType || userData?.profile);
  const { bg, border, accent, mutedText } = useAppTheme(effectiveProfileType);
  const inactiveTabColor = mutedText;
  const { t } = useLanguage();

  const isOwnProfile = String(loggedInUserId || '') === String(userData?.id || '');
  const targetProfileId = targetUserId || userData?.id;

  const closetTabKey = effectiveProfileType === 'company' ? 'shop' : 'closet';
  const closetNavContext = useMemo(
    () => ({
      isOwnProfile,
      sellerProfile: effectiveProfileType,
      sellerId: userData?.id,
      closetId: closetData?.id || closetData?.closetDetails?.id,
      returnTo: isOwnProfile
        ? { tab: 'Profile', screen: 'Profile', params: { initialTab: closetTabKey } }
        : {
          tab: 'HomeMain',
          screen: 'UsersProfile',
          params: { userId: userData?.id, initialTab: closetTabKey },
        },
    }),
    [closetData, closetTabKey, effectiveProfileType, isOwnProfile, userData?.id],
  );

  const unwrapMyClosetResponse = useCallback((source) => {
    const level1 = source?.data ?? source;
    if (level1 && typeof level1 === 'object' && !Array.isArray(level1)) {
      if (level1.data && typeof level1.data === 'object') {
        return level1.data;
      }
      return level1;
    }
    return {};
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadClosetState = async () => {
      try {
        const [apiResponse, draftValue, createdValue] = await Promise.all([
          isOwnProfile
            ? getMyClosetMe().catch(error => error?.response?.data || null)
            : getMyClosetById({ userId: targetProfileId }).catch(error => error?.response?.data || null),
          AsyncStorage.getItem('myClosetDraft'),
          AsyncStorage.getItem('myClosetCreated'),
        ]);

        if (!isMounted) return;
        const unwrappedClosetData = unwrapMyClosetResponse(apiResponse);
        const apiHasCloset = Boolean(
          unwrappedClosetData?.closetDetails?.id ||
          unwrappedClosetData?.closetDetails?.shopName ||
          unwrappedClosetData?.shopName ||
          unwrappedClosetData?.id ||
          unwrappedClosetData?.data,
        );

        setHasCreatedShop(apiHasCloset || createdValue === 'true');
        setClosetData(apiHasCloset ? unwrappedClosetData : null);

        if (draftValue) {
          try {
            setShopDraft(JSON.parse(draftValue));
          } catch {
            setShopDraft(null);
          }
        }
      } catch (error) {
        if (isMounted) {
          setHasCreatedShop(false);
          setClosetData(null);
        }
      } finally {
        if (isMounted) {
          setClosetCheckComplete(true);
        }
      }
    };

    loadClosetState();

    return () => {
      isMounted = false;
    };
  }, [isOwnProfile, targetProfileId, unwrapMyClosetResponse]);

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
  const MEDIA_TABS = useMemo(() => ([
    { key: 'photo', label: 'Photos', icon: 'images-outline' },
    { key: 'video', label: 'Videos', icon: 'videocam-outline' },
    { key: 'ebook', label: 'E-books', icon: 'book-outline' },
  ]), []);

  // closetId can come from the closet object we already fetched, or directly
  // off userData if the profile payload includes it. Adjust the userData
  // field name below to match your actual API contract.
  const closetId =
    closetData?.id ||
    closetData?.closetDetails?.id ||
    userData?.closetId ||
    userData?.myCloset?.id ||
    null;

  // Fire-and-forget view tracking for the shop/closet tabs. The API already
  // ignores self-views server-side (SELF_VIEW_IGNORED), so no isOwnProfile
  // check is needed here.
  const trackShopView = useCallback(async () => {
    if (!closetId) return;
    try {
      await trackClosetView(closetId);
    } catch (error) {
      // Non-critical — don't block tab navigation or surface an error toast.
    }
  }, [closetId]);

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
      <View style={styles.postsWrap}>
        {/* {userData?.profile !== 'company' && */}
        <View style={[styles.mediaTabsRow, { backgroundColor: bg, borderBottomColor: border }]}>
          {MEDIA_TABS.map((tab) => {
            const focused = mediaTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.mediaTabItem}
                onPress={() => setMediaTab(tab.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={tab.icon} size={22} color={focused ? accent : inactiveTabColor} />
                <Text style={[styles.mediaTabLabel, { color: focused ? accent : inactiveTabColor }]}>
                  {tab.label}
                </Text>
                {focused && <View style={[styles.mediaTabIndicator, { backgroundColor: accent }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
        {/* } */}
        {mediaTab === 'ebook' ? (
          <ProfileEbookScreen
            userData={userData}
            isSubscribed={isSubscribed}
            loggedInUserId={loggedInUserId}
            onSubscribePress={() => userData?.profile !== 'company' && setShowSubscribeModal(true)}
            isCompany={userData?.profile === 'company'}
            refreshKey={`${refreshKey ?? 0}-${privateKey}`}
            isActiveTab={activeTab === PRIVATE_CONTENT_TAB_INDEX}
            onOpenEbook={(ebook) => {
              navigation.navigate('EbookDetail', {
                ebook,
                userData,
                loggedInUserId,
                returnTo: isOwnProfile
                  ? { tab: 'ProfileMain', screen: 'Profile', params: { initialTab: initialTab || 'privateContent' } }
                  : { tab: 'HomeMain', screen: 'UsersProfile', params: { userId: targetUserId || userData?.id, initialTab: initialTab || 'privateContent' } },
                username: userData?.userName || userData?.username || ebook?.userName
              });
            }}
          />
        ) : (
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
            activeMediaFilter={mediaTab}
          />
        )}

      </View>
    ),
    shop: (
      <BusinessShop
            postCheck={post}
            userData={userData}
            isSubscribed={isSubscribed}
            loggedInUserId={loggedInUserId}
            onSubscribePress={() => userData?.profile !== 'company' && setShowSubscribeModal(true)}
            isCompany={userData?.profile === 'company'}
            refreshKey={`${refreshKey ?? 0}-${privateKey}`}
            scrollEnabled={false}
            isActiveTab={activeTab === PRIVATE_CONTENT_TAB_INDEX}
            activeMediaFilter={mediaTab}
            closetData={closetData}
            dashboard={dashboard}
            closetNavContext={closetNavContext}
          />
    ),
    closet: (
      closetCheckComplete && hasCreatedShop ? (
        <MyClosetShopFront
          navigation={navigation}
          userData={userData}
          shopDraft={shopDraft}
          isOwnProfile={isOwnProfile}
          loggedInUserId={loggedInUserId}
          closetData={closetData}
          closetNavContext={closetNavContext}
        />
      ) : (
        <Shop
          isOwnProfile={isOwnProfile}
          userData={userData}
          onStartPress={() => navigation.navigate('MyClosetCreateShop')}
          closetData={closetData}
        />
      )
    ),
  }), [
    post,
    userData,
    isOwnProfile,
    isSubscribed,
    loggedInUserId,
    refreshKey,
    privateKey,
    handlePrivateCircleStartPress,
    onPostPinChanged,
    activeTab,
    mediaTab,
    MEDIA_TABS,
    accent,
    inactiveTabColor,
    bg,
    border,
    closetCheckComplete,
    hasCreatedShop,
    shopDraft,
    navigation,
    closetData,
    closetNavContext,
  ]);

  // ── Tab metadata — icons/labels/onPress only, NO screen elements ─────────────
  const tabs = useMemo(() => {
    const list = [
      {
        key: 'posts',
        label: t('profileTabs.postsTab'),
        icon: (focused) => (
          <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={focused ? accent : inactiveTabColor} />
        ),
      },
      {
        key: 'privateCircle',
        label: t('profileTabs.privateCircleTab'),
        icon: (focused) => (
          <Image
            source={require('../../assets/icons/pngicons/private.png')}
            style={{ width: 35, height: 35, tintColor: focused ? accent : inactiveTabColor }}
          />
        ),
      },
      {
        key: 'reels',
        label: t('profileTabs.reelsTab'),
        icon: (focused) => (
          <ProfileReelIcon fill={focused ? accent : inactiveTabColor} height={24} width={24} />
        ),
      },
    ];

    // Only add privateContent tab for company profiles
    // Private Content tab (show for both User & Company)
    list.push({
      key: 'privateContent',
      label: t('profileTabs.privateContentTab'),
      icon: (focused) => (
        <LockKey
          fill={focused ? accent : inactiveTabColor}
          height={24}
          width={24}
        />
      ),
      onPress: async () => {
        if (!loggedInUserId || isOwnProfile || isSubscribed) return;

        const hasActive = await getSubscriptionStatus(targetProfileId);
        if (!hasActive) {
          setPrivatKey(p => p + 1);
          setTimeout(() => setShowSubscribeModal(true), 50);
        }
      },
    });

    // Shop tab (Company only)
    if (userData?.profile === 'company') {
      list.push({
        key: 'shop',
        label: t('profileTabs.shopTab'),
        icon: (focused) => (
          <MaterialIcons
            name="shopping-bag"
            size={24}
            color={focused ? accent : inactiveTabColor}
          />
        ),
        onPress: trackShopView,
      });
    }

    // Closet tab (User only)
    if (userData?.profile === 'user') {
      list.push({
        key: 'closet',
        label: t('profileTabs.myClosetTab'),
        icon: (focused) => (
          <Image
            source={require('../../assets/icons/pngicons/shop.png')}
            style={{
              width: 35,
              height: 35,
              tintColor: focused ? accent : inactiveTabColor,
            }}
          />
        ),
        onPress: trackShopView,
      });
    }

    return list;
  }, [
    accent,
    inactiveTabColor,
    t,
    userData,
    isOwnProfile,
    isSubscribed,
    loggedInUserId,
    targetProfileId,
    getSubscriptionStatus,
    trackShopView,
  ]);

  useEffect(() => {
    if (!initialTab) return;
    const resolvedInitialTab = (initialTab === 'closet' || initialTab === 'shop') ? closetTabKey : initialTab;
    const index = tabs.findIndex(tab => tab.key === resolvedInitialTab);
    if (index < 0) return;

    setActiveTab(index);

    const timer = setTimeout(async () => {
      if (!loggedInUserId || isOwnProfile) return;
      // Subscription popup is only for Private Content.
      // Private Circle (invite/member access) must never trigger it.
      if (initialTab !== 'privateContent') return;
      const hasActive = await getSubscriptionStatus(targetProfileId);
      if (!hasActive) {
        setPrivatKey(p => p + 1);
        setShowSubscribeModal(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    initialTab,
    loggedInUserId,
    isOwnProfile,
    getSubscriptionStatus,
    targetProfileId,
    userData?.profile,
    tabs,
    closetTabKey,
  ]);

  return (
    <View style={styles.tabsRoot}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: bg, borderBottomColor: border }]}>
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
                <View style={[styles.indicator, { backgroundColor: accent }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content — all tabs stay mounted, inactive ones are hidden */}
      <View style={styles.contentWrapper}>
        {tabs.map((tab, index) => (
          <View
            key={tab.key}
            style={index === activeTab ? styles.tabVisible : styles.tabHidden}
            pointerEvents={index === activeTab ? 'auto' : 'none'}
          >
            {tabScreens[tab.key]}
          </View>
        ))}
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
  postsWrap: {
    flex: 1,
  },
  mediaTabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  mediaTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  mediaTabLabel: {
    marginTop: 4,
    fontSize: 11,
  },
  mediaTabIndicator: {
    position: 'absolute',
    bottom: -7,
    width: '58%',
    height: 3,
    borderRadius: 999,
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
