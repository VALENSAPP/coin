// src/navigations/MainTabNavigator.js
import React, { useMemo, useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  getFocusedRouteNameFromRoute,
  StackActions,
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../pages/home';
import ProfileScreen from '../pages/profile';
import {
  MyClosetAddItemDetailsScreen,
  MyClosetAddItemPhotosScreen,
  MyClosetAddItemPriceScreen,
  MyClosetAddItemPublishedScreen,
  MyClosetAddItemReviewScreen,
  MyClosetAddItemShippingScreen,
  MyClosetCreateShopScreen,
  MyClosetLiveScreen,
  MyClosetPreferencesScreen,
  MyClosetTellUsScreen,
  MyClosetUploadLogoScreen,
} from '../pages/profile/MyClosetOnboarding';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import heartNotification from '../pages/home/HeartNotification';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Settings from '../pages/settings';
import UserChat from '../pages/home/chatMessages/UserChat';
import UserClosetChat from '../pages/home/chatMessages/UserClosetChat';
import ChatMessages from '../pages/home/chatMessages/ChatMessages';
import PostScreen from '../pages/post';
import FollowersFollowingScreen from '../pages/profile/FollowersScreen';
import ProfileEditScreen from '../pages/profile/editprofile';
import PostUploadPage from '../pages/post/uploadPost/Postupload';
import PostEditorScreen from '../pages/post/uploadPost/PostEditorScreen';
import InstagramPostCreator from '../pages/post/uploadPost/EditPostSelected';
import WalletScreen from '../pages/wallet';
import DepositeCash from '../pages/wallet/DepositeCash';
import CashOut from '../pages/wallet/CashOut';
import SendCoins from '../pages/wallet/SendCoins';
import PostView from '../components/profile/PostView';
import CreatorCoin from '../pages/profile/CreatorCoin';
import ShareProfile from '../pages/profile/ShareProfile';
import SavedPosts from '../pages/settings/SavedPosts';
import InviteScreen from '../pages/profile/InviteScreen';
import SearchScreen from '../pages/search';
import QuickBuy from '../pages/settings/QuickBuy';
import CashOutScreen from '../pages/settings/CashOutScreen';
import Usersprofile from '../pages/home/Usersprofile';
import Notification from '../pages/settings/Notification';
import Favourites from '../pages/home/Favourites';
import Following from '../pages/home/Following';
import HidePosts from '../pages/settings/HidePosts';
import SubscriptionDetails from '../pages/settings/SubscriptionDetails';
import TextGradient from '../assets/textgradient/TextGradient';
import CreateMission from '../pages/post/uploadPost/CreateMission';
import EditPostScreen from '../pages/post/uploadPost/EditPostScreen';
import PrivateCircleWelcome from '../pages/post/privatecircle/onboarding/Welcome';
import PrivateCircleSelectAccess from '../pages/post/privatecircle/SelectAccess';
import PrivateCircleSelectMembers from '../pages/post/privatecircle/SelectMembers';
import PrivateCircleReview from '../pages/post/privatecircle/Review';
import PrivateCircleCreating from '../pages/post/privatecircle/Creating';
import PrivateCircleSuccess from '../pages/post/privatecircle/Success';
import ViewMissioPost from '../pages/wallet/ViewMissioPost';

// Import Wallet Drawer Screens
import PortfolioScreen from '../pages/wallet/PortfolioScreen';
import MarketScreen from '../pages/wallet/MarketScreen';
import WalletDashboardScreen from '../pages/wallet';
import ActivityScreen from '../pages/wallet/ActivityScreen';
import CreatorsScreen from '../pages/wallet/CreatorsScreen';
import SettingsScreen from '../pages/wallet/SettingScreen';
import ShopSettingsScreen from '../pages/wallet/ShopSettingsScreen';
import ChangePassword from '../pages/wallet/ChangePassword';
import WalletComponent from '../pages/wallet/WalletScreen';
import ProfileSettingsScreen from '../pages/wallet/ProfileSettings';
import VerificationStatusScreen from '../pages/wallet/VerificationStatus';
import PrivacySettingsScreen from '../pages/wallet/PrivacySettings';
import TwoFactorAuthScreen from '../pages/wallet/Two-FactorAuth';
import LoginHistoryScreen from '../pages/wallet/LoginHistory';
import SubventionSetupScreen from '../pages/wallet/Subscriptions';
import EbookPublisherScreen from '../pages/wallet/EbookPublisher';
import TipPayoutSetupScreen from '../pages/wallet/TipPayoutSetup';
import KYCVerification from '../pages/authentication/kycVerification';
import FlipsScreen from '../pages/reels';
import { FLIPS_SCREEN_OPTIONS } from './flipsTransition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBusinessProfileTheme } from '../theme/useBusinessProfileTheme';
import { useThemeContext } from '../theme/ThemeContext';
import TermConditionScreen from '../pages/profile/Term&ConditionScreen';
import { DeviceEventEmitter } from 'react-native';
import PaymentScreen from '../pages/Stripe/PaymentScreen';
import OpenBattleScreen from '../pages/profile/OpenBattleScreen';
import ProfileBattleScreen from '../pages/profile/ProfileBattleScreen';
import EbookDetailScreen from '../components/profile/EbookDetailScreen';
import AllEbooksScreen from '../components/profile/AllEbooksScreen';
import EbookBuyDetailsScreen from '../components/profile/EbookBuyDetailsScreen';
import EbookCheckoutScreen from '../components/profile/EbookCheckoutScreen';
import EbookPaymentSuccessScreen from '../components/profile/EbookPaymentSuccessScreen';
import ArchiveScreen from '../pages/settings/archeive';
import HighlightsScreen from '../pages/settings/highlights';
import BattleInProgress from '../pages/settings/BattleInProgress';
import BattleResults from '../pages/settings/BattleResults';
import BattleReward from '../pages/settings/BattleReward';
import BattleVoteDetails from '../pages/settings/BattleVoteDetails';
import {
  BattleLiveScreen,
  ChallengeBattleSettingsScreen,
  BattleResultsScreen,
  BattleSetupScreen,
  BattlePreviewScreen,
  ChallengeBattleSetupScreen,
  CreateBattleScreen,
  ChallengeShopListScreen,
  ChallengeShopItemsScreen,
  ChallengeBattlePreviewScreen,
  BattleCreatedSuccessScreen,
  ChallengeReceivedScreen,
  ChallengeAcceptedScreen,
} from '../pages/profile/MyClosetBattleScreens';
import HexAvatar from '../components/home/story.js/HexAvatar';
import { getUserCredentials } from '../services/post';
import { getMyClosetMe } from '../services/myCloset';
import RevenueFromSubscriptions from '../pages/wallet/MyRevenue';
import MarketplaceAnalytics from '../pages/wallet/MarketplaceAnalytics';
import ValensWallet from '../pages/wallet/ValensWallet';
import TransactionActivityScreen from '../pages/wallet/TransactionActivityScreen';
import TotalEarningsScreen from '../pages/wallet/TotalEarningsScreen';
import ReferralPointsScreen from '../pages/wallet/ReferralPointsScreen';
import UseYourPointsScreen from '../pages/wallet/UseYourPointsScreen';
import BuyMissionPostScreen from '../pages/wallet/BuyMissionPostScreen';
import BuyMissionPackageScreen from '../pages/wallet/BuyMissionPackageScreen';
import BuyMissionSuccessScreen from '../pages/wallet/BuyMissionSuccessScreen';
import ProfileShop from '../components/profile/Shop';
import MyClosetDashboard from '../components/profile/MyClosetDashboard';
import {
  MyClosetItemEditorScreen,
  MyClosetItemsManagementScreen,
} from '../components/profile/MyClosetItemManagement';
import {
  MyClosetBattlesScreen,
  MyClosetBuyerCartScreen,
  MyClosetBuyerCheckoutScreen,
  MyClosetBuyerItemDetailScreen,
  MyClosetBuyerItemsScreen,
  MyClosetBuyerOptionsScreen,
  MyClosetBuyerOrderReceivedScreen,
  MyClosetBuyerPaymentScreen,
  MyClosetBuyerReviewScreen,
  MyClosetBuyerShippingScreen,
} from '../components/profile/MyClosetBuyerFlow';
import MyClosetOrdersScreen from '../components/profile/MyClosetOrdersScreen';
import MyClosetOrderDetailScreen from '../components/profile/MyClosetOrderDetailScreen';
import ShopScreen from '../pages/wallet/ShopScreen';
import PrivateCircle from '../components/profile/PrivateCircle';
import LanguageSelectionScreen from '../pages/settings/LanguageSelectionScreen';
// ── TRANSLATION CHANGE: import useLanguage hook ──────────────────────────────
import { useLanguage } from '../i18n';
import MyClosetEarningsScreen from '../components/profile/MyClosetEarningsScreen';
import {
  BattleInsightsActionsScreen,
  BoostWinningItemScreen,
  CreateWinnerPromotionScreen,
  PreviewPromotionScreen,
  PromotionDetailsScreen,
  ReviewBoostScreen,
} from '../pages/profile/Myclosetbattleinsightsscreens';
import { normalizeProfileType } from '../utils/closetNavigation';

const VIEWED_PROFILE_THEME_EVENT = 'VIEWED_PROFILE_THEME';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const MyClosetScreen = props => {
  const [storedProfile, setStoredProfile] = React.useState('user');
  const [hasCreatedShop, setHasCreatedShop] = React.useState(false);
  const [shopDraft, setShopDraft] = React.useState(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadShopState = async () => {
        try {
          const [profileValue, createdValue, draftValue, closetValue] = await Promise.all([
            AsyncStorage.getItem('profile'),
            AsyncStorage.getItem('myClosetCreated'),
            AsyncStorage.getItem('myClosetDraft'),
            getMyClosetMe().catch(error => error?.response?.data || null),
          ]);

          if (!isMounted) return;

          if (profileValue) setStoredProfile(normalizeProfileType(profileValue) || 'user');

          const closetData = closetValue?.data || closetValue;
          const hasApiSignal =
            typeof closetValue?.success === 'boolean' ||
            typeof closetValue?.statusCode === 'number';
          const apiReportedNetworkError =
            closetValue?.statusCode === 0 && closetValue?.error === true;
          const closetExists =
            hasApiSignal && !apiReportedNetworkError
              ? closetValue?.statusCode === 200 &&
              Boolean(closetData?.shopName || closetData?.id || closetData?.data)
              : null;

          setHasCreatedShop(
            closetExists === null ? createdValue === 'true' : closetExists,
          );

          if (draftValue) {
            try {
              setShopDraft(JSON.parse(draftValue));
            } catch {
              setShopDraft(null);
            }
          }
        } catch (error) {
          console.log('Error loading My Closet state:', error);
        }
      };

      loadShopState();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  if (hasCreatedShop) {
    return (
      <MyClosetDashboard
        {...props}
        userData={{ profile: storedProfile }}
        shopDraft={shopDraft}
      />
    );
  }

  return (
    <ProfileShop
      {...props}
      isOwnProfile
      userData={{ profile: storedProfile }}
    />
  );
};

const ShopScreenWrapper = props => {
  const [storedProfile, setStoredProfile] = React.useState('user');
  const [hasCreatedShop, setHasCreatedShop] = React.useState(false);
  const [shopDraft, setShopDraft] = React.useState(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadShopState = async () => {
        try {
          const [profileValue, createdValue, draftValue, closetValue] = await Promise.all([
            AsyncStorage.getItem('profile'),
            AsyncStorage.getItem('myClosetCreated'),
            AsyncStorage.getItem('myClosetDraft'),
            getMyClosetMe().catch(error => error?.response?.data || null),
          ]);

          if (!isMounted) return;

          if (profileValue) setStoredProfile(normalizeProfileType(profileValue) || 'user');

          const closetData = closetValue?.data || closetValue;
          const hasApiSignal =
            typeof closetValue?.success === 'boolean' ||
            typeof closetValue?.statusCode === 'number';
          const apiReportedNetworkError =
            closetValue?.statusCode === 0 && closetValue?.error === true;
          const closetExists =
            hasApiSignal && !apiReportedNetworkError
              ? closetValue?.statusCode === 200 &&
              Boolean(closetData?.shopName || closetData?.id || closetData?.data)
              : null;

          setHasCreatedShop(
            closetExists === null ? createdValue === 'true' : closetExists,
          );

          if (draftValue) {
            try {
              setShopDraft(JSON.parse(draftValue));
            } catch {
              setShopDraft(null);
            }
          }
        } catch (error) {
          console.log('Error loading Shop state:', error);
        }
      };

      loadShopState();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  if (hasCreatedShop) {
    return (
      <MyClosetDashboard
        {...props}
        userData={{ profile: storedProfile }}
        shopDraft={shopDraft}
      />
    );
  }

  return (
    <ShopScreen
      {...props}
      userData={{ profile: storedProfile }}
    />
  );
};

export default function MainTabNavigator() {
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const navigation = useNavigation();
  const [viewedProfileType, setViewedProfileType] = React.useState(null);
  const {
    isBusinessProfile,
    bgStyle,
    textStyle,
    bg,
    text,
    border,
    mutedText,
    accent,
    icon,
  } = useBusinessProfileTheme();
  const { isDarkMode } = useThemeContext();
  const headerTitleColor = isDarkMode ? '#ffffff' : '#111827';
  const headerMenuColor = accent;
  // ── TRANSLATION CHANGE: initialise t() ──────────────────────────────────────
  const { t } = useLanguage();

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      VIEWED_PROFILE_THEME_EVENT,
      ({ profileType }) => {
        setViewedProfileType(profileType || null);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const tabAccent = useMemo(() => {
    if (normalizeProfileType(viewedProfileType) === 'company') {
      return '#C9A15A';
    }
    return accent;
  }, [viewedProfileType, accent]);

  const profileTabBorderColor =
    userProfile !== 'user' || isBusinessProfile ? '#C9A15a' : '#5a2d82';

  const HomeStack = useMemo(() => {
    return () => (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
        }}
        initialRouteName="Home"
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HeartNotification" component={heartNotification} />
        <Stack.Screen name="ChatMessages" component={ChatMessages} />
        <Stack.Screen name="Favourites" component={Favourites} />
        <Stack.Screen name="Following" component={Following} />
        <Stack.Screen name="UserChat" component={UserChat} />
        <Stack.Screen name="UserClosetChat" component={UserClosetChat} />
        <Stack.Screen name="UsersProfile" component={Usersprofile} />
        <Stack.Screen name="MyClosetBuyerItems" component={MyClosetBuyerItemsScreen} />
        <Stack.Screen name="MyClosetBuyerItemDetail" component={MyClosetBuyerItemDetailScreen} />
        <Stack.Screen name="MyClosetBuyerOptions" component={MyClosetBuyerOptionsScreen} />
        <Stack.Screen name="MyClosetBuyerCart" component={MyClosetBuyerCartScreen} />
        <Stack.Screen name="MyClosetBuyerCheckout" component={MyClosetBuyerCheckoutScreen} />
        <Stack.Screen name="MyClosetBuyerShipping" component={MyClosetBuyerShippingScreen} />
        <Stack.Screen name="MyClosetBuyerPayment" component={MyClosetBuyerPaymentScreen} />
        <Stack.Screen name="MyClosetBuyerReview" component={MyClosetBuyerReviewScreen} />
        <Stack.Screen name="MyClosetBuyerOrderReceived" component={MyClosetBuyerOrderReceivedScreen} />
        <Stack.Screen name="MyClosetBattles" component={MyClosetBattlesScreen} />
        <Stack.Screen name="BattleLive" component={BattleLiveScreen} />
        <Stack.Screen name="BattleResultsScreen" component={BattleResultsScreen} />
        <Stack.Screen name="BattleInsightsActions" component={BattleInsightsActionsScreen} />
        <Stack.Screen name="BoostWinningItem" component={BoostWinningItemScreen} />
        <Stack.Screen name="ReviewBoost" component={ReviewBoostScreen} />
        <Stack.Screen name="CreateWinnerPromotion" component={CreateWinnerPromotionScreen} />
        <Stack.Screen name="PromotionDetails" component={PromotionDetailsScreen} />
        <Stack.Screen name="PreviewPromotion" component={PreviewPromotionScreen} />
        <Stack.Screen name="CreateBattle" component={CreateBattleScreen} />
        <Stack.Screen name="ChallengeShopList" component={ChallengeShopListScreen} />
        <Stack.Screen name="ChallengeShopItems" component={ChallengeShopItemsScreen} />
        <Stack.Screen name="BattleSetup" component={BattleSetupScreen} />
        <Stack.Screen name="BattlePreview" component={BattlePreviewScreen} />
        <Stack.Screen name="ChallengeBattleSetup" component={ChallengeBattleSetupScreen} />
        <Stack.Screen name="ChallengeBattleSettings" component={ChallengeBattleSettingsScreen} />
        <Stack.Screen name="ChallengeBattlePreview" component={ChallengeBattlePreviewScreen} />
        <Stack.Screen name="BattleCreatedSuccess" component={BattleCreatedSuccessScreen} />
        <Stack.Screen name="ChallengeReceived" component={ChallengeReceivedScreen} />
        <Stack.Screen name="ChallengeAccepted" component={ChallengeAcceptedScreen} />
        <Stack.Screen
          name="ShareProfile"
          component={ShareProfile}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ProfileBattleScreen"
          component={ProfileBattleScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditPost"
          component={EditPostScreen}
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="SelectedPost"
          component={InstagramPostCreator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PostEditor"
          component={PostEditorScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FlipsScreen"
          component={FlipsScreen}
          options={FLIPS_SCREEN_OPTIONS}
        />
        {/* <Stack.Screen name="OpenBattle" component={OpenBattleScreen} options={{ headerShown: false }} /> */}
        <Stack.Screen
          name="EbookDetail"
          component={EbookDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AllEbooks"
          component={AllEbooksScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EbookBuyDetails"
          component={EbookBuyDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EbookCheckout"
          component={EbookCheckoutScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EbookPaymentSuccess"
          component={EbookPaymentSuccessScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }, [bg]);

  const SearchStack = useMemo(() => {
    return () => (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
        }}
        initialRouteName="SearchHome"
      >
        <Stack.Screen name="SearchHome" component={SearchScreen} />
        <Stack.Screen
          name="FlipsScreen"
          component={FlipsScreen}
          options={FLIPS_SCREEN_OPTIONS}
        />
        <Stack.Screen
          name="PostView"
          component={PostView}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="UsersProfile"
          component={Usersprofile}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }, [bg]);

  const ProfileStack = useMemo(() => {
    return () => (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
        }}
        initialRouteName="Profile"
      >
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen
          name="MyClosetCreateShop"
          component={MyClosetCreateShopScreen}
        />
        <Stack.Screen
          name="MyClosetUploadLogo"
          component={MyClosetUploadLogoScreen}
        />
        <Stack.Screen name="MyClosetTellUs" component={MyClosetTellUsScreen} />
        <Stack.Screen
          name="MyClosetPreferences"
          component={MyClosetPreferencesScreen}
        />
        <Stack.Screen name="MyClosetLive" component={MyClosetLiveScreen} />
        <Stack.Screen
          name="MyClosetAddItemPhotos"
          component={MyClosetAddItemPhotosScreen}
        />
        <Stack.Screen
          name="MyClosetAddItemDetails"
          component={MyClosetAddItemDetailsScreen}
        />
        <Stack.Screen
          name="MyClosetAddItemPrice"
          component={MyClosetAddItemPriceScreen}
        />
        <Stack.Screen
          name="MyClosetAddItemShipping"
          component={MyClosetAddItemShippingScreen}
        />
        <Stack.Screen
          name="MyClosetAddItemReview"
          component={MyClosetAddItemReviewScreen}
        />
        <Stack.Screen
          name="MyClosetAddItemPublished"
          component={MyClosetAddItemPublishedScreen}
        />
        <Stack.Screen
          name="MyClosetItemsManagement"
          component={MyClosetItemsManagementScreen}
        />
        <Stack.Screen
          name="MyClosetItemEditor"
          component={MyClosetItemEditorScreen}
        />
        <Stack.Screen name="BattleInsightsActions" component={BattleInsightsActionsScreen} />
        <Stack.Screen name="BoostWinningItem" component={BoostWinningItemScreen} />
        <Stack.Screen name="ReviewBoost" component={ReviewBoostScreen} />
        <Stack.Screen name="CreateWinnerPromotion" component={CreateWinnerPromotionScreen} />
        <Stack.Screen name="PromotionDetails" component={PromotionDetailsScreen} />
        <Stack.Screen name="PreviewPromotion" component={PreviewPromotionScreen} />
        <Stack.Screen name="MyClosetOrders" component={MyClosetOrdersScreen} />
        <Stack.Screen name="MyClosetOrderDetail" component={MyClosetOrderDetailScreen} />
        <Stack.Screen name="MyClosetEarnings" component={MyClosetEarningsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MyClosetBuyerItems" component={MyClosetBuyerItemsScreen} />
        <Stack.Screen name="MyClosetBattles" component={MyClosetBattlesScreen} />
        <Stack.Screen name="MyClosetBuyerItemDetail" component={MyClosetBuyerItemDetailScreen} />
        <Stack.Screen name="MyClosetBuyerOptions" component={MyClosetBuyerOptionsScreen} />
        <Stack.Screen name="MyClosetBuyerCart" component={MyClosetBuyerCartScreen} />
        <Stack.Screen name="MyClosetBuyerCheckout" component={MyClosetBuyerCheckoutScreen} />
        <Stack.Screen name="MyClosetBuyerShipping" component={MyClosetBuyerShippingScreen} />
        <Stack.Screen name="MyClosetBuyerPayment" component={MyClosetBuyerPaymentScreen} />
        <Stack.Screen name="MyClosetBuyerReview" component={MyClosetBuyerReviewScreen} />
        <Stack.Screen name="MyClosetBuyerOrderReceived" component={MyClosetBuyerOrderReceivedScreen} />
        <Stack.Screen name="Settings" component={Settings} />
        <Stack.Screen
          name="FollowersFollowingScreen"
          component={FollowersFollowingScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="EditProfile"
          component={ProfileEditScreen}
          // ── TRANSLATION CHANGE: headerTitle translated ───────────────────
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: bg },
            headerTintColor: text,
            headerTitleStyle: { color: text },
            headerTitle: t('tabNav.editProfile'),
          }}
        />
        <Stack.Screen
          name="PostUpload"
          component={PostUploadPage}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PostEditor"
          component={PostEditorScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditPost"
          component={EditPostScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SelectedPost"
          component={InstagramPostCreator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PostView"
          component={PostView}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EbookDetail"
          component={EbookDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AllEbooks"
          component={AllEbooksScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EbookBuyDetails"
          component={EbookBuyDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EbookCheckout"
          component={EbookCheckoutScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EbookPaymentSuccess"
          component={EbookPaymentSuccessScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreatorCoin"
          component={CreatorCoin}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ShareProfile"
          component={ShareProfile}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SavedPost"
          component={SavedPosts}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="QuickBuy"
          component={QuickBuy}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CashOutScreen"
          component={CashOutScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Invite"
          component={InviteScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="notificationEnable"
          component={Notification}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HidePosts"
          component={HidePosts}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleInProgress"
          component={BattleInProgress}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleVoteDetails"
          component={BattleVoteDetails}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleResults"
          component={BattleResults}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleReward"
          component={BattleReward}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="subscription"
          component={SubscriptionDetails}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ManageSubscription"
          component={PaymentScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FlipsScreen"
          component={FlipsScreen}
          options={FLIPS_SCREEN_OPTIONS}
        />
        <Stack.Screen
          name="TermConditionScreen"
          component={TermConditionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OpenBattle"
          component={OpenBattleScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateBattle"
          component={CreateBattleScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeShopList"
          component={ChallengeShopListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeShopItems"
          component={ChallengeShopItemsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleSetup"
          component={BattleSetupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattlePreview"
          component={BattlePreviewScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeBattleSetup"
          component={ChallengeBattleSetupScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeBattleSettings"
          component={ChallengeBattleSettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeBattlePreview"
          component={ChallengeBattlePreviewScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleCreatedSuccess"
          component={BattleCreatedSuccessScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeReceived"
          component={ChallengeReceivedScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChallengeAccepted"
          component={ChallengeAcceptedScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleLive"
          component={BattleLiveScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BattleResultsScreen"
          component={BattleResultsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ProfileBattleScreen"
          component={ProfileBattleScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ArchiveScreen"
          component={ArchiveScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HighlightsScreen"
          component={HighlightsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
    // ── TRANSLATION CHANGE: t added to dependency array so stack rebuilds on lang change ──
  }, [t, bg, text]);

  // Enhanced Wallet Stack Navigator with ALL drawer screens
  const WalletStack = useMemo(() => {
    return ({ route }) => {
      const initialScreen = 'Dashboard';

      return (
        <Stack.Navigator
          initialRouteName={initialScreen}
          screenOptions={({ navigation }) => ({
            headerShown: true,
            contentStyle: { backgroundColor: bg },
            headerStyle: {
              elevation: 0,
              shadowOpacity: 0,
              backgroundColor: bg,
            },
            headerTitleStyle: {
              fontWeight: 'bold',
              color: headerTitleColor,
            },
            headerTintColor: headerMenuColor,
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.openDrawer()}
                style={{ marginLeft: 15 }}
              >
                <Ionicons name="menu" size={28} color={headerMenuColor} />
              </TouchableOpacity>
            ),
            headerTitle: () => (
              <TextGradient
                style={{ fontWeight: 'bold', fontSize: 20 }}
                locations={[0, 1]}
                colors={['#513189bd', '#e54ba0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                text="VALENS"
              />
            ),
            headerTitleAlign: 'center',
          })}
        >
          {/* Original Wallet Screens */}
          <Stack.Screen
            name="WalletMain"
            component={WalletComponent}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.buyMissionCredits') }}
          />
          <Stack.Screen
            name="DepositeCash"
            component={DepositeCash}
            options={{
              // ── TRANSLATION CHANGE ─────────────────────────────────────────
              headerTitle: t('walletStack.deposit'),
              headerTitleAlign: 'center',
            }}
          />
          <Stack.Screen
            name="CashOut"
            component={CashOut}
            options={{
              // ── TRANSLATION CHANGE ─────────────────────────────────────────
              headerTitle: t('walletStack.cashOut'),
              headerTitleAlign: 'center',
            }}
          />
          <Stack.Screen
            name="SendCoin"
            component={SendCoins}
            options={{
              // ── TRANSLATION CHANGE ─────────────────────────────────────────
              headerTitle: t('walletStack.send'),
              headerTitleAlign: 'center',
            }}
          />

          {/* Drawer Wallet Screens - All accessible from drawer */}
          <Stack.Screen
            name="Dashboard"
            component={WalletDashboardScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('drawerNav.dashboard') }}
          />
          {/* <Stack.Screen
              name="Portfolio"
              component={PortfolioScreen}
              options={{ headerTitle: 'Portfolio' }}
            /> */}
          <Stack.Screen
            name="ValensWallet"
            component={ValensWallet}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.valensWallet') }}
          />
          <Stack.Screen
            name="MyCloset"
            component={MyClosetScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.myCloset') }}
          />
          <Stack.Screen
            name="MyClosetEarnings"
            component={MyClosetEarningsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="EbookDetail"
            component={EbookDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Shop"
            component={ShopScreenWrapper}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.shop') }}
          />
          <Stack.Screen
            name="Privatecircle"
            component={PrivateCircle}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.privateCircle') }}
          />
          <Stack.Screen
            name="TransactionActivity"
            component={TransactionActivityScreen}
            options={({ navigation }) => ({
              // ── TRANSLATION CHANGE ───────────────────────────────────────────
              headerTitle: t('walletStack.recentActivities'),
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <View style={{ marginRight: 10 }}>
                    <Ionicons name="close" size={20} color={icon} />
                  </View>
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen
            name="TotalEarnings"
            component={TotalEarningsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ReferralPoints"
            component={ReferralPointsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UseYourPoints"
            component={UseYourPointsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BuyMissionPost"
            component={BuyMissionPostScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BuyMissionPackage"
            component={BuyMissionPackageScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BuyMissionSuccess"
            component={BuyMissionSuccessScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Market"
            component={MarketScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.market') }}
          />
          <Stack.Screen
            name="Activity"
            component={ActivityScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.activity') }}
          />
          {/* <Stack.Screen
              name="Creators"
              component={CreatorsScreen}
              options={{ headerTitle: 'Creators' }}
            /> */}
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.settings') }}
          />
          <Stack.Screen
            name="ShopSettings"
            component={ShopSettingsScreen}
            options={{ headerTitle: 'Shop Settings' }}
          />
          <Stack.Screen
            name="WalletEditProfile"
            component={ProfileEditScreen}
            options={{
              // ── TRANSLATION CHANGE ─────────────────────────────────────────
              headerTitle: t('walletStack.profileSettings'),
              headerTitleAlign: 'center',
            }}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePassword}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.changePassword') }}
          />
          <Stack.Screen
            name="CreatorProfile"
            component={Usersprofile}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="VerificationStatus"
            component={VerificationStatusScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.verificationStatus') }}
          />
          <Stack.Screen
            name="kycverify"
            component={KYCVerification}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.kycVerification') }}
          />
          <Stack.Screen
            name="PrivacySettings"
            component={PrivacySettingsScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.privacySettings') }}
          />
          <Stack.Screen
            name="TwoFactorAuth"
            component={TwoFactorAuthScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.twoFactorAuth') }}
          />
          <Stack.Screen
            name="LoginHistory"
            component={LoginHistoryScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.loginHistory') }}
          />
          <Stack.Screen
            name="SubscriptionSetup"
            component={SubventionSetupScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.subscriptionSetup') }}
          />
          <Stack.Screen
            name="EbookPublisher"
            component={EbookPublisherScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TipPayoutSetup"
            component={TipPayoutSetupScreen}
            options={{ headerTitle: t('drawerNav.dashboard') }}
          />
          <Stack.Screen
            name="ViewMissionPost"
            component={ViewMissioPost}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.viewMissionPost') }}
          />
          <Stack.Screen
            name="RevenueFromSubscriptions"
            component={RevenueFromSubscriptions}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{ headerTitle: t('walletStack.revenueFromSubscriptions') }}
          />
          <Stack.Screen
            name="MarketplaceAnalytics"
            component={MarketplaceAnalytics}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="LanguageSelectionScreen"
            component={LanguageSelectionScreen}
            // ── TRANSLATION CHANGE ───────────────────────────────────────────
            options={{
              headerTitle: t('walletStack.selectLanguage'),
              headerTitleAlign: 'center',
            }}
          />
        </Stack.Navigator>
      );
    };
    // ── TRANSLATION CHANGE: t added to dependency array so stack rebuilds on lang change ──
  }, [
    t,
    bg,
    text,
    accent,
    icon,
    headerTitleColor,
    headerMenuColor,
    isBusinessProfile,
    isDarkMode,
  ]);

  const PostStack = useMemo(() => {
    return () => (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Add" component={PostScreen} />
        <Stack.Screen
          name="SelectedPost"
          component={InstagramPostCreator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PostEditor"
          component={PostEditorScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditPost"
          component={EditPostScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CreateMission"
          component={CreateMission}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivateCircleWelcome"
          component={PrivateCircleWelcome}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivateCircleSelectAccess"
          component={PrivateCircleSelectAccess}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivateCircleSelectMembers"
          component={PrivateCircleSelectMembers}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivateCircleReview"
          component={PrivateCircleReview}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivateCircleCreating"
          component={PrivateCircleCreating}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivateCircleSuccess"
          component={PrivateCircleSuccess}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }, []);

  // Memoize tab bar styles
  const defaultTabBarStyle = useMemo(
    () => ({
      display: 'flex',
      backgroundColor: bg,
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 0,
      height: 50,
      position: 'absolute',
      bottom: Platform.OS == 'android' ? 0 : 25,
      left: 0,
      right: 0,
      paddingTop: 5,
    }),
    [bg],
  );

  const reelsTabBarStyle = useMemo(
    () => ({
      backgroundColor: '#000000',
      borderTopWidth: 1.5,
      borderTopColor: isDarkMode ? border : '#ffffff',
      height: 50,
      position: 'absolute',
      bottom: Platform.OS == 'android' ? 0 : 25,
      left: 0,
      right: 0,
      paddingTop: 5,
    }),
    [isDarkMode, border],
  );

  const hiddenTabBarStyle = useMemo(
    () => ({
      display: 'none',
    }),
    [],
  );

  // Memoize screen options function
  const getScreenOptions = useCallback(
    ({ route, navigation }) => {
      const isFocused = navigation.isFocused();

      const baseOptions = {
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: defaultTabBarStyle,
        tabBarActiveTintColor:
          route.name === 'Reels' && isFocused ? '#ffffff' : tabAccent,
        tabBarInactiveTintColor:
          route.name === 'Reels' && isFocused ? '#ffffff' : mutedText,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => {
          const isReelsFocused = route.name === 'Reels' && isFocused;
          const iconColor = isReelsFocused
            ? '#ffffff'
            : focused
              ? tabAccent
              : mutedText;

          switch (route.name) {
            case 'HomeMain':
              return (
                <Ionicons
                  name={focused ? 'home' : 'home-outline'}
                  size={26}
                  color={iconColor}
                />
              );
            case 'Search':
              return (
                <Ionicons
                  name={focused ? 'search' : 'search-outline'}
                  size={25}
                  color={iconColor}
                />
              );
            case 'Add':
              return (
                <FontAwesome
                  name={'plus-square-o'}
                  size={28}
                  color={iconColor}
                />
              );
            case 'wallet':
              return (
                <Ionicons
                  name={focused ? 'wallet' : 'wallet-outline'}
                  size={26}
                  color={iconColor}
                />
              );
            case 'ProfileMain':
              if (profileImage) {
                return (
                  // <Image
                  //   source={{ uri: profileImage }}
                  //   style={{
                  //     width: 26,
                  //     height: 26,
                  //     borderRadius: 13,
                  //     borderWidth: focused ? 2 : 0,
                  //     borderColor: focused ? iconColor : 'transparent',
                  //   }}
                  // />
                  <HexAvatar
                    uri={profileImage}
                    size={30}
                    borderWidth={1.5}
                    borderColor={profileTabBorderColor}
                  />
                );
              } else {
                return (
                  <HexAvatar
                    size={30}
                    borderWidth={1.5}
                    borderColor={profileTabBorderColor}
                  />
                );
              }
            default:
              return null;
          }
        },
      };

      if (route.name === 'Search' || route.name === 'wallet') {
        return {
          ...baseOptions,
          tabBarStyle: defaultTabBarStyle,
        };
      }

      return baseOptions;
    },
    [profileImage, defaultTabBarStyle, reelsTabBarStyle, tabAccent, mutedText, profileTabBorderColor, isBusinessProfile],
  );

  // Memoize HomeMain options function
  const getHomeMainOptions = useCallback(
    ({ route }) => {
      const routeName = getFocusedRouteNameFromRoute(route);
      const visibleTabRoutes = [
        'BattleInProgress',
        'BattleResults',
        'BattleReward',
        'ProfileBattleScreen',
        'OpenBattle',
      ];

      const hideTabBarRoutes = [
        'ChatMessages',
        'HeartNotification',
        'Following',
        'UserChat',
        'UserClosetChat',
        'PostUpload',
        'PostEditor',
        'EditPost',
        'SelectedPost',
        'SavedPost',
        'ArchiveScreen',
        'HighlightsScreen',
        'CreatorCoin',
        'notificationEnable',
        'HidePosts',
        'FollowersFollowingScreen',
        'Settings',
        'subscription',
        'QuickBuy',
        'CashOutScreen',
        'Invite',
        'ShareProfile',
        'EditProfile',
        'CreateMission',
        'PrivateCircleWelcome',
        'PrivateCircleSelectAccess',
        'PrivateCircleSelectMembers',
        'PrivateCircleReview',
        'PrivateCircleCreating',
        'PrivateCircleSuccess',
        'MyClosetItemsManagement',
        'MyClosetItemEditor',
        'MyClosetBuyerItems',
        'MyClosetBuyerItemDetail',
        'MyClosetBuyerOptions',
        'MyClosetBuyerCart',
        'MyClosetBuyerCheckout',
        'MyClosetBuyerShipping',
        'MyClosetBuyerPayment',
        'MyClosetBuyerReview',
        'MyClosetBuyerOrderReceived',
        'BattleVoteDetails',
        'CreateBattle',
        'BattleSetup',
        'BattlePreview',
        'ChallengeBattleSetup',
        'ChallengeBattleSettings',
        'ChallengeBattlePreview',
        'BattleCreatedSuccess',
        'ChallengeReceived',
        'ChallengeAccepted',
        'ChallengeShopList',
        'ChallengeShopItems',
        'BattleLive',
        'BattleResultsScreen',
        'ProfileBattleScreen',
        'ArchiveScreen',
        'HighlightsScreen',
        'BoostWinningItem',
        'ReviewBoost',
        'CreateWinnerPromotion',
        'PromotionDetails',
        'PreviewPromotion',
        'BattleInsightsActions',
        'EbookDetail',
        'AllEbooks',
        'EbookBuyDetails',
        'EbookCheckout',
        'EbookPaymentSuccess',
        'FlipsScreen',
      ];

      let currentRouteName = routeName;

      if (!currentRouteName && route.state) {
        const activeRoute = route.state.routes[route.state.index];
        currentRouteName = activeRoute?.name;
      }

      if (
        !currentRouteName &&
        route.state?.routes?.[route.state.index]?.state
      ) {
        const nestedState = route.state.routes[route.state.index].state;
        if (nestedState.routes && nestedState.routes[nestedState.index]) {
          currentRouteName = nestedState.routes[nestedState.index].name;
        }
      }

      if (!currentRouteName && navigation.getState) {
        try {
          const navState = navigation.getState();
          const currentRoute = navState.routes[navState.index];
          if (currentRoute?.state?.routes) {
            const activeNestedRoute =
              currentRoute.state.routes[currentRoute.state.index];
            currentRouteName = activeNestedRoute?.name;
          }
        } catch (error) {
          console.error('Error getting navigation state:', error);
        }
      }

      if (!currentRouteName) {
        if (route.name === 'ProfileMain' && route.state) {
          const profileRoute = route.state.routes[route.state.index];
          if (profileRoute?.name === 'subscription') {
            currentRouteName = 'subscription';
          }
        }
      }

      let hideTabBar = hideTabBarRoutes.includes(currentRouteName);

      if (visibleTabRoutes.includes(currentRouteName)) {
        hideTabBar = false;
      }

      // Check dynamic param for PostView
      if (currentRouteName === 'PostView') {
        const routeObj = route?.state?.routes?.[route?.state?.index]?.params;

        if (routeObj?.hideTabBar !== undefined) {
          hideTabBar = routeObj.hideTabBar; // override
        }
      }

      return {
        tabBarStyle: hideTabBar ? hiddenTabBarStyle : defaultTabBarStyle,
      };
    },
    [hiddenTabBarStyle, defaultTabBarStyle],
  );

  return (
    <View style={[{ flex: 1 }, bgStyle]}>
      <Tab.Navigator
        screenOptions={getScreenOptions}
        sceneContainerStyle={bgStyle}
      >
        <Tab.Screen
          name="HomeMain"
          component={HomeStack}
          options={getHomeMainOptions}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();

              const state = navigation.getState();
              const homeTabIndex = state.routes.findIndex(
                r => r.name === 'HomeMain',
              );
              const homeTabRoute = state.routes[homeTabIndex];
              const isFocused = state.index === homeTabIndex;

              if (homeTabRoute?.state?.key) {
                navigation.dispatch({
                  ...StackActions.popToTop(),
                  target: homeTabRoute.state.key,
                });
              }

              navigation.navigate('HomeMain', { screen: 'Home' });

              if (isFocused) {
                // 🔔 Trigger scroll-to-top + refresh
                DeviceEventEmitter.emit('HOME_TAB_PRESS');
              }
            },
          })}
        />
        <Tab.Screen
          name="Search"
          component={SearchStack}
          options={getHomeMainOptions}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              DeviceEventEmitter.emit('SEARCH_TAB_PRESS');
              navigation.navigate('Search', { screen: 'SearchHome' });
            },
          })}
        />
        <Tab.Screen
          name="Add"
          component={PostStack}
          options={getHomeMainOptions}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              const state = navigation.getState();
              const currentRoute = state.routes.find(r => r.name === 'Add');
              if (currentRoute) {
                const isCurrentTab =
                  state.index === state.routes.findIndex(r => r.name === 'Add');
                if (isCurrentTab) {
                  navigation.reset({
                    index: 0,
                    routes: [
                      {
                        name: 'Add',
                        state: {
                          routes: [{ name: 'Add', params: { fromIcon: true } }],
                          index: 0,
                        },
                      },
                    ],
                  });
                } else {
                  navigation.navigate('Add', {
                    screen: 'Add',
                    params: { fromIcon: true },
                  });
                }
              }
            },
          })}
        />
        <Tab.Screen
          name="wallet"
          component={WalletStack}
          options={{
            tabBarStyle: defaultTabBarStyle,
          }}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('wallet', { screen: 'Dashboard' });
            },
          })}
        />
        <Tab.Screen
          name="ProfileMain"
          component={ProfileStack}
          options={getHomeMainOptions}
          listeners={({ navigation }) => ({
            tabPress: e => {
              e.preventDefault();
              navigation.navigate('ProfileMain', {
                screen: 'Profile',
              });
            },
          })}
        />
      </Tab.Navigator>
    </View>
  );
}
