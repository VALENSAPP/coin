import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Linking,
  Modal,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { loggedIn, loggedOut } from '../../redux/actions/LoginAction';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import RBSheet from 'react-native-raw-bottom-sheet';
import createStyles from './Style';
import data from '../../list.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/useApptheme';
import { useToast } from 'react-native-toast-notifications';
import { setUserProfile } from '../../redux/actions/UserProfileAction';
import {
  logout,
  fetchDeviceAccounts,
  extractAccountsFromDeviceAccountsResponse,
  switchAccountRequest,
  extractUserFromSwitchResponse,
  persistSwitchedUser,
  removeDeviceAccountRequest,
  resolveRefreshTokenForAccountSwitch,
  refreshToken,
  extractTokensFromRefreshResponse,
} from '../../services/authentication';
import { showToastMessage } from '../../components/displaytoastmessage';
import {
  ADDING_ACCOUNT_FLAG_KEY,
  applyAccountSession,
  clearSavedAccounts,
  ensureCurrentAccountSaved,
  getSavedAccounts,
  removeSavedAccount,
} from '../../utils/accountSession';
import { logoutDeviecAll } from '../../services/wallet';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { setIsAddAccount } from '../../redux/actions/AddAccountAction';

/** __DEV__ only: set to '' to use real tokens from resolveRefreshTokenForAccountSwitch. */
const DEBUG_STATIC_REFRESH_TOKEN_FOR_SWITCH_TEST = __DEV__
  ? '7a2b9d5913744d3e019e38403e92c925cb9499f727d116898f5dda20af7d9d86'
  : '';

const Settings = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const toast = useToast();
  const styles = createStyles();
  const refRBSheet = useRef();
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [switchableAccounts, setSwitchableAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [switchInFlight, setSwitchInFlight] = useState(false);
  const [removeAccountConfirm, setRemoveAccountConfirm] = useState(null);
  const { bgStyle, textStyle, bg, text, card } = useAppTheme();

  // Handler functions for all menu items
  const handleAccountsCentrePress = () => {
    refRBSheet.current.open();
    // Alert.alert("Accounts Centre", "Navigate to Accounts Centre");
  };

  const handleKYCVerificationPress = () => {
    // navigation.navigate('UnlockAccess');
  }

  const handleSavedPress = () => {
    navigation.navigate('SavedPost');
    // Alert.alert("Saved", "Navigate to Saved items");
  };

  const handleQuickBuy = () => {
    navigation.navigate('QuickBuy');
  };

  const handleCashOut = () => {
    navigation.navigate('CashOutScreen');
  };

  const handleSubscription = () => {
    navigation.navigate('subscription');
  };

  const handleArchivePress = () => {

    navigation.navigate('ArchiveScreen');
  };

  const handleActivityPress = () => {
    Alert.alert('Your activity', 'Navigate to Your activity');
  };

  const handleNotificationsPress = () => {
    navigation.navigate('notificationEnable');
  };

  const handleTimeManagementPress = () => {
    Alert.alert('Time management', 'Navigate to Time management settings');
  };

  const handleAccountPrivacyPress = () => {
    Alert.alert('Account privacy', 'Navigate to Account privacy settings');
  };

  const handleCloseFriendsPress = () => {
    Alert.alert('Top Valens', 'Navigate to Close Friends settings');
  };

  const handleCrosspostingPress = () => {
    Alert.alert('Crossposting', 'Navigate to Crossposting settings');
  };

  const handleBlockedPress = () => {
    Alert.alert('Blocked', 'Navigate to Blocked accounts');
  };

  const handleHideStoryPress = () => {
    navigation.navigate('HidePosts');
  };

  const handleBattleInProgressPress = () => {
    navigation.navigate('BattleInProgress');
  };

  const handleBattleResultsPress = () => {
    navigation.navigate('BattleResults');
  };

  const handleBattleRewardPress = () => {
    navigation.navigate('BattleReward');
  };

  const handleMessagesPress = () => {
    Alert.alert('Messages and story replies', 'Navigate to Messages settings');
  };

  const handleTagsPress = () => {
    Alert.alert('Tags and mentions', 'Navigate to Tags settings');
  };

  const handleCommentsPress = () => {
    Alert.alert('Comments', 'Navigate to Comments settings');
  };

  const handleSharingPress = () => {
    Alert.alert('Sharing', 'Navigate to Sharing settings');
  };

  const handleRestrictedPress = () => {
    Alert.alert('Restricted', 'Navigate to Restricted accounts');
  };

  const handleLimitInteractionsPress = () => {
    Alert.alert(
      'Limit interactions',
      'Navigate to Limit interactions settings',
    );
  };

  const handleHiddenWordsPress = () => {
    Alert.alert('Hidden words', 'Navigate to Hidden words settings');
  };

  const handleFollowInvitePress = () => {
    Alert.alert(
      'Follow and invite friends',
      'Navigate to Follow and invite friends',
    );
  };

  const handleFavouritesPress = () => {
    Alert.alert('Favourites', 'Navigate to Favourites');
  };

  const handleMutedAccountsPress = () => {
    Alert.alert('Muted accounts', 'Navigate to Muted accounts');
  };

  const handleContentPreferencesPress = () => {
    Alert.alert('Content preferences', 'Navigate to Content preferences');
  };

  const handleLikeShareCountsPress = () => {
    Alert.alert(
      'Like and share counts',
      'Navigate to Like and share counts settings',
    );
  };

  const handleSubscriptionsPress = () => {
    Alert.alert('Subscriptions', 'Navigate to Subscriptions');
  };

  const handleDevicePermissionsPress = () => {
    Alert.alert('Device permissions', 'Navigate to Device permissions');
  };

  const handleArchivingDownloadingPress = () => {
    Alert.alert(
      'Archiving and downloading',
      'Navigate to Archiving and downloading',
    );
  };

  const handleAccessibilityPress = () => {
    Alert.alert('Accessibility', 'Navigate to Accessibility settings');
  };

  const handleLanguagePress = () => {
    Alert.alert('Language and translations', 'Navigate to Language settings');
  };

  const handleDataUsagePress = () => {
    Alert.alert(
      'Data usage and media quality',
      'Navigate to Data usage settings',
    );
  };

  const handleAppWebsitePress = () => {
    Alert.alert(
      'App website permissions',
      'Navigate to App website permissions',
    );
  };

  const handleEarlyAccessPress = () => {
    Alert.alert(
      'Early access to features',
      'Navigate to Early access settings',
    );
  };

  const handleAccountTypePress = () => {
    Alert.alert('Account type and tools', 'Navigate to Account type and tools');
  };

  const handleMetaVerifiedPress = () => {
    Alert.alert('Meta Verified', 'Navigate to Meta Verified');
  };

  const handleOrdersPaymentsPress = () => {
    Alert.alert('Orders and payments', 'Navigate to Orders and payments');
  };

  const handleHelpPress = () => {
    const email = 'Support@valens.app';
    const subject = 'App Support Request';
    const body = 'Hi team,\n\nI need help with...';

    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No mail app found');
    });
  };

  const handlePrivacyCentrePress = () => {
    Alert.alert('Privacy Centre', 'Navigate to Privacy Centre');
  };

  const handleAccountStatusPress = () => {
    Alert.alert('Account Status', 'Navigate to Account Status');
  };

  const handleAboutPress = () => {
    Alert.alert('About', 'App version 1.0.0');
  };

  const handleWhatsAppPress = () => {
    Alert.alert('WhatsApp', 'Navigate to WhatsApp');
  };

  const handleEditsPress = () => {
    Alert.alert('Edits', 'Navigate to Edits');
  };

  const handleThreadsPress = () => {
    Alert.alert('Threads', 'Navigate to Threads');
  };

  const handleFacebookPress = () => {
    Alert.alert('Facebook', 'Navigate to Facebook');
  };

  const handleMessengerPress = () => {
    Alert.alert('Messenger', 'Navigate to Messenger');
  };

  const handleMetaAIPress = () => {
    Alert.alert('Meta AI', 'Navigate to Meta AI');
  };

  const handleRayBanPress = () => {
    Alert.alert('Ray-Ban Meta', 'Navigate to Ray-Ban Meta');
  };

  const moveToLoginForAddingAccount = async () => {
    await AsyncStorage.setItem(ADDING_ACCOUNT_FLAG_KEY, 'true');
    // await AsyncStorage.setItem('isLoggedIn', 'true');
    dispatch(setIsAddAccount(true));
  };

  const mergeAccountsServerAndLocal = (serverRows, localRows) => {
    const map = new Map();
    (localRows || []).forEach(a => {
      if (a?.userId) map.set(String(a.userId), { ...a });
    });
    (serverRows || []).forEach(s => {
      if (!s?.userId) return;
      const id = String(s.userId);
      const prev = map.get(id) || {};
      map.set(id, {
        ...prev,
        ...s,
        refreshToken: s.refreshToken || prev.refreshToken,
        displayName: s.displayName || prev.displayName,
        image: s.image || prev.image,
      });
    });
    return Array.from(map.values());
  };

  const switchAccount = async account => {
    try {
      setSwitchInFlight(true);
      const targetUserId = account?.id;
      console.log(targetUserId, "targetUserId==>switch");

      const res = await switchAccountRequest({ targetUserId });
      console.log("switchAccountRequest res==> ", res);
      if (res?.statusCode === 401) {
        showToastMessage(
          toast,
          'danger',
          res?.message ||
          'Session expired for this account. Remove it from this device, then sign in again.',
          4000,
        );
        return;
      }
      const ok = res?.statusCode === 200 || res?.statusCode === 201;
      if (ok) {
        await persistSwitchedUser(res.data, account, dispatch, String(targetUserId));
        const profile = await AsyncStorage.getItem('profile');
        dispatch(setUserProfile(profile || 'normal'));
        setAccountSwitcherVisible(false);
        dispatch(loggedOut());
        setTimeout(() => {
          dispatch(loggedIn());
        }, 50);
        showToastMessage(toast, 'success', 'Switched account', 1500);
        return;
      }
    } catch (e) {
      console.warn('switchAccount', e);
      showToastMessage(toast, 'danger', e?.message || 'Switch failed');
    } finally {
      setSwitchInFlight(false);
    }
  };

  const resolveAccountUserId = account =>
    account?.userId ?? account?.id ?? account?.user_id ?? account?._id;

  const openRemoveAccountConfirm = account => {
    const userId = resolveAccountUserId(account);
    if (userId == null || userId === '') return;
    setRemoveAccountConfirm({ ...account, userId: String(userId) });
  };

  const closeRemoveAccountConfirm = () => setRemoveAccountConfirm(null);

  const confirmRemoveAccountFromDevice = async () => {
    const account = removeAccountConfirm;
    const userId = account?.userId;
    if (!userId) return;
    closeRemoveAccountConfirm();
    try {
      const res = await removeDeviceAccountRequest({ userId });
      const ok = res?.statusCode === 200 || res?.statusCode === 201;
      if (ok) {
        await removeSavedAccount(userId);
        setSwitchableAccounts(prev =>
          prev.filter(a => String(resolveAccountUserId(a)) !== String(userId)),
        );
        showToastMessage(toast, 'success', 'Account removed from device', 2000);
      } else {
        showToastMessage(toast, 'danger', res?.message || 'Could not remove account');
      }
    } catch (err) {
      showToastMessage(toast, 'danger', err?.message || 'Remove failed');
    }
  };

  const handleAddAccountPress = async () => {
    if (loadingAccounts) return;
    try {
      await ensureCurrentAccountSaved();
      setLoadingAccounts(true);

      let merged = [];
      try {
        const apiRes = await fetchDeviceAccounts();
        const accounts = apiRes?.data?.accounts || [];
        console.log('Fetched accounts from device:', accounts);
        setSwitchableAccounts(accounts);
        setAccountSwitcherVisible(true);
      } catch (e) {
        console.warn('fetchDeviceAccounts', e);
        merged = await getSavedAccounts();
      } finally {
        setLoadingAccounts(false);
      }


    } catch (error) {
      Alert.alert('Error', 'Unable to open account switcher right now.');
    }
  };

  const handleLogoutPress = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          (async () => {
            dispatch(setUserProfile('normal'));
            dispatch(showLoader());
            
            const currentUserId = await AsyncStorage.getItem('userId');
            
            // Fetch other accounts BEFORE logout (while token is still valid)
            let otherAccounts = [];
            try {
              const apiRes = await fetchDeviceAccounts();
              otherAccounts = extractAccountsFromDeviceAccountsResponse(apiRes);
              console.log('otherAccounts fetched BEFORE logout:', otherAccounts);
            } catch (e) {
              console.warn('fetchDeviceAccounts before logout failed:', e?.message);
            }
            
            // Now logout
            try {
              const token = await AsyncStorage.getItem('token');
              const refreshToken = await AsyncStorage.getItem('refreshToken');
              await logout({ token, refreshToken });
            } catch (e) {
              // Ignore logout API failure; proceed with local logout.
            }
            
            // Try to switch to another account if available (BEFORE removing current account)
            let switchSuccess = false;
            try {
              if (otherAccounts && otherAccounts.length > 1) {
                // Switch to the second account (first is current user)
                const topAccount = otherAccounts[1];
                const targetUserId = resolveAccountUserId(topAccount);
                console.log('Switching to account:', targetUserId, topAccount);
                
                if (targetUserId) {
                  const switchRes = await switchAccountRequest({ targetUserId });
                  console.log('switchRes from logout:', switchRes);
                  const ok = switchRes?.statusCode === 200 || switchRes?.statusCode === 201;
                  
                  if (ok) {
                    // Auto-switch to account
                    const resData = switchRes.data || switchRes;
                    console.log('resData to persist:', resData);
                    
                    await persistSwitchedUser(resData, topAccount, dispatch, String(targetUserId));
                    const profile = await AsyncStorage.getItem('profile');
                    console.log('Profile after switch:', profile);
                    dispatch(setUserProfile(profile || 'normal'));
                    
                    dispatch(hideLoader());
                    dispatch(loggedOut());
                    setTimeout(() => {
                      console.log('Dispatching loggedIn');
                      dispatch(loggedIn());
                    }, 100);
                    
                    showToastMessage(toast, 'success', `Switched to ${topAccount.displayName || 'another account'}`, 2000);
                    switchSuccess = true;
                  } else {
                    console.warn('Switch failed with status:', switchRes?.statusCode, switchRes?.message);
                  }
                }
              } else {
                console.log('Not enough accounts to switch:', otherAccounts?.length);
              }
            } catch (e) {
              console.warn('Error during account switch:', e?.message, e);
            }
            
            // Remove current account AFTER switch attempt
            if (switchSuccess && currentUserId) {
              try {
                await removeDeviceAccountRequest({ userId: currentUserId });
                console.log('Removed old account from device after successful switch');
              } catch (e) {
                console.warn('removeDeviceAccountRequest failed (non-fatal after switch):', e?.message);
              }
              return;
            }
            
            // If switch failed, proceed with full logout
            await AsyncStorage.setItem('isLoggedIn', 'false');
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('refreshToken');
            await AsyncStorage.removeItem('firebaseToken');
            await AsyncStorage.removeItem('userId');
            await AsyncStorage.removeItem('username');
            await AsyncStorage.removeItem('email');
            await AsyncStorage.removeItem('walletAddress');
            await AsyncStorage.removeItem('walletPrivateKey');
            await AsyncStorage.removeItem('walletMnemonic');
            await AsyncStorage.removeItem('walletChainId');
            await AsyncStorage.removeItem('walletType');
            await AsyncStorage.removeItem('profile');
            await AsyncStorage.removeItem('stripeCustomerId');
            await AsyncStorage.removeItem(ADDING_ACCOUNT_FLAG_KEY);
            
            dispatch(hideLoader());
            dispatch(loggedOut());
            showToastMessage(toast, 'success', 'Logged out', 1500);
          })();
        },
      },
    ]);
  };

  const performLogoutAllAccounts = async () => {
    try {
      dispatch(setUserProfile('normal'));
      dispatch(showLoader());

      let response;
      try {
        response = await logoutDeviecAll();
      } catch (e) {
        console.log('Logout API failed:', e);
      }

      if (response?.statusCode === 200) {
        await AsyncStorage.multiRemove([
          'token',
          'refreshToken',
          'firebaseToken',
          'userId',
          'username',
          'email',
          'walletAddress',
          'walletPrivateKey',
          'walletMnemonic',
          'walletChainId',
          'walletType',
          'profile',
          'stripeCustomerId',
          ADDING_ACCOUNT_FLAG_KEY,
        ]);

        await AsyncStorage.setItem('isLoggedIn', 'false');

        await clearSavedAccounts();

        dispatch(loggedOut());
      } else {
        console.log('Logout all failed:', response);
      }
    } catch (error) {
      console.log('Logout All Error:', error);
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleLogoutAllPress = () => {
    Alert.alert(
      'Log Out of All Accounts',
      'Are you sure you want to log out of all accounts?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out All',
          style: 'destructive',
          onPress: () => {
            void performLogoutAllAccounts();
          },
        },
      ],
    );
  };

  const handleRemoveModalLogoutAllDevices = () => {
    closeRemoveAccountConfirm();
    setAccountSwitcherVisible(false);
    void performLogoutAllAccounts();
  };

  const SettingsItem = ({
    icon,
    title,
    subtitle,
    onPress,
    showChevron = true,
    rightText,
    hasBlueIcon = false,
  }) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <View style={styles.itemLeft}>
        <Icon name={icon} size={24} color="#262626" />
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemText}>{title}</Text>
          {subtitle && <Text style={styles.itemSubtext}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.itemRight}>
        {rightText && <Text style={styles.rightText}>{rightText}</Text>}
        {hasBlueIcon && <View style={styles.blueIndicator} />}
        {showChevron && <Icon name="chevron-right" size={24} color="#8e8e93" />}
      </View>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const ActionItem = ({
    title,
    onPress,
    isDestructive = false,
    isBlue = false,
  }) => (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      <Text
        style={[
          styles.actionText,
          isDestructive && styles.destructiveText,
          isBlue && styles.blueText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#262626" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings and activity</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Your account section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Your account</Text>
            {/* <Text style={styles.metaText}>Meta</Text> */}
          </View>

          {/* <SettingsItem
            icon="account-circle"
            title="Accounts Center"
            subtitle="Password, security, personal details, ad preferences"
            onPress={handleAccountsCentrePress}
          /> */}
          {/* <SettingsItem
            icon="account-circle"
            title="KYC Verification"
            onPress={handleKYCVerificationPress}
          /> */}

          <SettingsItem
            icon="subscriptions"
            title="Subscription"
            onPress={handleSubscription}
          />

          <Text style={styles.sectionDescription}>
            Manage your connected experiences and account settings across Valens
            technologies App.
            {/* <Text style={styles.learnMore}> Learn more</Text> */}
          </Text>
        </View>

        {/* How you use Instagram section */}
        <View style={styles.section}>
          <SectionHeader title=" Using Valens" />

          <SettingsItem
            icon="bookmark"
            title="Saved"
            onPress={handleSavedPress}
          />
          <SettingsItem
            icon="archive"
            title="Archive"
            onPress={handleArchivePress}
          />


        </View>

        {/* Who can see your content section */}
        <View style={styles.section}>
          <SectionHeader title="Who can see your content" />

          <SettingsItem
            icon="privacy-tip"
            title="Account privacy"
            rightText="Private"
          // onPress={handleAccountPrivacyPress}
          />
          <SettingsItem
            icon="visibility-off"
            title="Hide Posts"
            onPress={handleHideStoryPress}
          />
          {/* <SettingsItem
            icon="visibility-off"
            title="Battle in progress"
            onPress={handleBattleInProgressPress}
          />
            <SettingsItem
            icon="visibility-off"
            title="Battle result "
            onPress={handleBattleResultsPress}
          />
            <SettingsItem
            icon="visibility-off"
            title="Battle Reward"
            onPress={handleBattleRewardPress}
          /> */}
        </View>

        {/* More info and support section */}
        <View style={styles.section}>
          <SectionHeader title="More info and support" />

          <SettingsItem
            icon="help-outline"
            title="Help"
            onPress={handleHelpPress}
          />
          <SettingsItem icon="info" title="About" onPress={handleAboutPress} />
        </View>

        {/* Login section */}
        <View style={styles.section}>
          <SectionHeader title="Login" />
          <ActionItem
            title={loadingAccounts ? 'Loading accounts…' : 'Add accounts'}
            onPress={handleAddAccountPress}
            isDestructive={true}
          />
          <ActionItem
            title="Log out"
            onPress={handleLogoutPress}
            isDestructive={true}
          />
          {/* <ActionItem
            title="Log out all accounts"
            onPress={handleLogoutAllPress}
            isDestructive={true}
          /> */}
        </View>
        <RBSheet
          ref={refRBSheet}
          draggable
          customModalProps={{
            // animationType: 'slide',
            statusBarTranslucent: true,
          }}
          customStyles={{
            container: {
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
            },
            draggableIcon: {
              width: 80,
            },
          }}
        >
          <ScrollView>
            <View style={styles.gridContainer}>
              {data.grids.map(grid => (
                <TouchableOpacity
                  key={grid.icon}
                  onPress={() => refRBSheet.current?.close()}
                  style={styles.gridButtonContainer}
                >
                  <Text style={styles.gridLabel}>{grid.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </RBSheet>
      </ScrollView>

      <Modal
        visible={accountSwitcherVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountSwitcherVisible(false)}
      >
        <View style={switcherStyles.overlay}>
          <View style={[switcherStyles.card, { backgroundColor: card }]}>
            <Text style={[switcherStyles.title, { color: text }]}>Switch account</Text>
            <Text style={[switcherStyles.subtitle, { color: text }]}>
              Select an account, remove one from this device, or add another.
            </Text>

            {switchInFlight ? (
              <View style={switcherStyles.inlineLoading}>
                <ActivityIndicator style={switcherStyles.inlineSpinner} color={text} />
                <Text style={[switcherStyles.inlineLoadingText, { color: text }]}>Switching…</Text>
              </View>
            ) : null}

            <ScrollView
              style={switcherStyles.list}
              contentContainerStyle={switcherStyles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {switchableAccounts
                .filter(account => !account.isCurrent)
                .map(account => {
                  const label =
                    account.displayName ||
                    account.username ||
                    account.email ||
                    `Account ${account.id}`;

                  const avatarUri =
                    account.image || account.userImage || account.profileImage;

                  const initial = (label?.trim?.()?.charAt(0) || 'U').toUpperCase();

                  const rowKey = String(resolveAccountUserId(account) ?? account.id ?? label);

                  return (
                    <View
                      key={rowKey}
                      style={[switcherStyles.accountRow, { backgroundColor: bg }]}
                    >
                      <TouchableOpacity
                        style={switcherStyles.accountRowMain}
                        disabled={switchInFlight}
                        onPress={() => switchAccount(account)}
                      >
                        {avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={switcherStyles.avatar} />
                        ) : (
                          <View style={[switcherStyles.avatarFallback, { backgroundColor: text }]}>
                            <Text style={switcherStyles.avatarInitial}>{initial}</Text>
                          </View>
                        )}
                        <Text
                          style={[switcherStyles.accountName, { color: text }]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setAccountSwitcherVisible(false);   // CLOSE FIRST MODAL
                          setTimeout(() => {
                            openRemoveAccountConfirm(account); // THEN OPEN SECOND
                          }, 300);
                        }}
                        disabled={switchInFlight}
                        style={switcherStyles.removeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Remove account from this device"
                      >
                        <Icon name="delete-outline" size={22} color="#c62828" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              style={[switcherStyles.addBtn, { backgroundColor: text }]}
              disabled={switchInFlight}
              onPress={async () => {
                setAccountSwitcherVisible(false);
                await moveToLoginForAddingAccount();
              }}
            >
              <Text style={switcherStyles.addBtnText}>Add another account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[switcherStyles.cancelBtn, { borderColor: text }]}
              onPress={() => setAccountSwitcherVisible(false)}
            >
              <Text style={[switcherStyles.cancelBtnText, { color: text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!removeAccountConfirm}
        transparent
        animationType="fade"
        onRequestClose={closeRemoveAccountConfirm}
      >
        <View style={switcherStyles.overlay}>
          <View style={[switcherStyles.card, { backgroundColor: card }]}>
            <Text style={[switcherStyles.title, { color: text }]}>Log out</Text>
            <Text style={[switcherStyles.confirmBody, { color: text }]}>
              {/* Do you want to log out this account from this device only, or from all devices? */}
              Do you want to log out this account from this device
            </Text>
            <TouchableOpacity
              style={[switcherStyles.addBtn, { backgroundColor: text }]}
              onPress={confirmRemoveAccountFromDevice}
              disabled={switchInFlight}
            >
              <Text style={switcherStyles.addBtnText}>Logout</Text>
            </TouchableOpacity>
            {/* <TouchableOpacity
              style={[switcherStyles.dangerBtn, switcherStyles.choiceBtnSpacing]}
              onPress={handleRemoveModalLogoutAllDevices}
              disabled={switchInFlight}
            >
              <Text style={switcherStyles.dangerBtnText}>From all devices</Text>
            </TouchableOpacity> */}
            <TouchableOpacity
              style={[switcherStyles.cancelBtn, { borderColor: text }]}
              onPress={closeRemoveAccountConfirm}
              disabled={switchInFlight}
            >
              <Text style={[switcherStyles.cancelBtnText, { color: text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const switcherStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '72%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#151515',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    color: '#6F6F6F',
  },
  confirmBody: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: '#6F6F6F',
  },
  dangerBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#c62828',
  },
  choiceBtnSpacing: {
    marginTop: 8,
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    maxHeight: 250,
  },
  listContent: {
    gap: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 10,
    backgroundColor: '#F7F7F7',
  },
  accountRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  removeBtn: {
    padding: 8,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  inlineSpinner: {
    marginRight: 8,
  },
  inlineLoadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222222',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  accountName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#202020',
  },
  addBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#131313',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEDEDE',
  },
  cancelBtnText: {
    color: '#404040',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Settings;
