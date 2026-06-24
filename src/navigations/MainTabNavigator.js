// src/navigations/MainTabNavigator.js
import React, { useMemo, useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  getFocusedRouteNameFromRoute,
  StackActions,
  useNavigation,
  useRoute,
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
import subscription from '../pages/settings/Subscription';
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
import ChangePassword from '../pages/wallet/ChangePassword';
import WalletComponent from '../pages/wallet/WalletScreen';
import ProfileSettingsScreen from '../pages/wallet/ProfileSettings';
import VerificationStatusScreen from '../pages/wallet/VerificationStatus';
import PrivacySettingsScreen from '../pages/wallet/PrivacySettings';
import TwoFactorAuthScreen from '../pages/wallet/Two-FactorAuth';
import LoginHistoryScreen from '../pages/wallet/LoginHistory';
import SubventionSetupScreen from '../pages/wallet/Subscriptions';
import EbookPublisherScreen from '../pages/wallet/EbookPublisher';
import KYCVerification from '../pages/authentication/kycVerification';
import FlipsScreen from '../pages/reels';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../theme/useApptheme';
import TermConditionScreen from '../pages/profile/Term&ConditionScreen';
import { DeviceEventEmitter } from 'react-native';
import PaymentScreen from '../pages/Stripe/PaymentScreen';
import OpenBattleScreen from '../pages/profile/OpenBattleScreen';
import ProfileBattleScreen from '../pages/profile/ProfileBattleScreen';
import EbookDetailScreen from '../components/profile/EbookDetailScreen';
import ArchiveScreen from '../pages/settings/archeive';
import HighlightsScreen from '../pages/settings/highlights';
import BattleInProgress from '../pages/settings/BattleInProgress';
import BattleResults from '../pages/settings/BattleResults';
import BattleReward from '../pages/settings/BattleReward';
import BattleVoteDetails from '../pages/settings/BattleVoteDetails';
import HexAvatar from '../components/home/story.js/HexAvatar';
import { getUserCredentials } from '../services/post';
import RevenueFromSubscriptions from '../pages/wallet/MyRevenue';
import ValensWallet from '../pages/wallet/ValensWallet';
import TransactionActivityScreen from '../pages/wallet/TransactionActivityScreen';
import ProfileShop from '../components/profile/Shop';
import MyClosetDashboard from '../components/profile/MyClosetDashboard';
import ShopScreen from '../pages/wallet/ShopScreen';
import PrivateCircle from '../components/profile/PrivateCircle';
import LanguageSelectionScreen from '../pages/settings/LanguageSelectionScreen';
// ── TRANSLATION CHANGE: import useLanguage hook ──────────────────────────────
import { useLanguage } from '../i18n';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const MyClosetScreen = props => {
  const [storedProfile, setStoredProfile] = React.useState('user');
  const [hasCreatedShop, setHasCreatedShop] = React.useState(false);
  const [shopDraft, setShopDraft] = React.useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadShopState = async () => {
      try {
        const [profileValue, createdValue, draftValue] = await Promise.all([
          AsyncStorage.getItem('profile'),
          AsyncStorage.getItem('myClosetCreated'),
          AsyncStorage.getItem('myClosetDraft'),
        ]);

        if (!isMounted) return;

        if (profileValue) setStoredProfile(profileValue);
        setHasCreatedShop(createdValue === 'true');

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
  }, []);

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

export default function MainTabNavigator() {
  const [profile, setProfile] = React.useState(null);
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const userProfile = useSelector(state => state.userProfile.userProfile);
  const navigation = useNavigation();
  const { bgStyle, textStyle, bg, text } = useAppTheme();
  // ── TRANSLATION CHANGE: initialise t() ──────────────────────────────────────
  const { t } = useLanguage();

  const getUserDetail = async () => {
    try {
      // dispatch(showLoader());
      // const id = await AsyncStorage.getItem('userId');
      const profile = await AsyncStorage.getItem('profile');

      // if (!id) {
      //   console.log('User ID not found');
      //   return;
      // }

      // const response = await getUserCredentials(id);

      // console.log('API Response: data in thi apiaiaaiaiaai', response);
      setProfile(profile);
    } catch (error) {
      console.log('Error fetching user details:', error);
    } finally {
      // dispatch(hideLoader()); // Add this
    }
  };
  useEffect(() => {
    getUserDetail();
  }, []);

  const HomeStack = useMemo(() => {
    return () => (
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="Home"
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HeartNotification" component={heartNotification} />
        <Stack.Screen name="ChatMessages" component={ChatMessages} />
        <Stack.Screen name="Favourites" component={Favourites} />
        <Stack.Screen name="Following" component={Following} />
        <Stack.Screen name="UserChat" component={UserChat} />
        <Stack.Screen name="UsersProfile" component={Usersprofile} />
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
        {/* <Stack.Screen name="OpenBattle" component={OpenBattleScreen} options={{ headerShown: false }} /> */}
      </Stack.Navigator>
    );
  }, []);

  const ProfileStack = useMemo(() => {
    return () => (
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
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
            headerStyle: ['#fff'],
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
          component={subscription}
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
          options={{
            headerShown: false,
            presentation: 'fullScreenModal', // Optional: makes it feel like a modal transition
            animation: 'slide_from_bottom', // Optional: adds nice animation
          }}
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
  }, [t]);

  // Enhanced Wallet Stack Navigator with ALL drawer screens
  const WalletStack = useMemo(() => {
    return ({ route }) => {
      const initialScreen = 'Dashboard';

      return (
        <Stack.Navigator
          initialRouteName={initialScreen}
          screenOptions={({ navigation }) => ({
            headerShown: true,
            headerStyle: [
              {
                elevation: 0,
                shadowOpacity: 0,
                backgroundColor:
                  userProfile !== 'user' ? '#fcfbfaff' : '#f8f2fd',
              },
            ],
            headerTitleStyle: {
              fontWeight: 'bold',
              color: '#111',
            },
            headerTintColor: '#111',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.openDrawer()}
                style={{ marginLeft: 15 }}
              >
                <Ionicons name="menu" size={28} color={text} />
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
            name="Shop"
            component={ShopScreen}
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
                    <Ionicons name="close" size={20} color="#000" />
                  </View>
                </TouchableOpacity>
              ),
            })}
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
  }, [t, text, userProfile]);

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
      // backgroundColor: bg,
      borderTopWidth: 1.5,
      bgStyle,
      borderTopColor: '#dbdbdb',
      height: 50,
      position: 'absolute',
      bottom: Platform.OS == 'android' ? 0 : 25,
      left: 0,
      right: 0,
      paddingTop: 5,
    }),
    [],
  );

  const reelsTabBarStyle = useMemo(
    () => ({
      backgroundColor: '#000',
      borderTopWidth: 1.5,
      borderTopColor: '#fff',
      height: 50,
      position: 'absolute',
      bottom: Platform.OS == 'android' ? 0 : 25,
      left: 0,
      right: 0,
      paddingTop: 5,
    }),
    [],
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
        tabBarActiveTintColor:
          route.name === 'Reels' && isFocused ? '#fff' : '#000',
        tabBarInactiveTintColor:
          route.name === 'Reels' && isFocused ? '#fff' : '#666',
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => {
          const isReelsFocused = route.name === 'Reels' && isFocused;
          const iconColor = isReelsFocused ? '#fff' : color;

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
                    borderColor={userProfile !== 'user' ? '#C9A15a' : '#5a2d82'}
                  />
                );
              } else {
                return (
                  <HexAvatar
                    uri={require('../assets/icons/pngicons/user.png')}
                    size={30}
                    borderWidth={1.5}
                    borderColor={userProfile !== 'user' ? '#C9A15a' : '#5a2d82'}
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
    [profileImage, defaultTabBarStyle, reelsTabBarStyle],
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
        'BattleVoteDetails',
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
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={getScreenOptions}>
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
          component={SearchScreen}
          options={{
            tabBarStyle: defaultTabBarStyle,
          }}
          listeners={() => ({
            tabPress: () => {
              DeviceEventEmitter.emit('SEARCH_TAB_PRESS');
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
