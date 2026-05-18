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
import { useLanguage } from '../../i18n';

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
  const { t } = useLanguage();

  // Handler functions for all menu items
  const handleAccountsCentrePress = () => {
    refRBSheet.current.open();
  };

  const handleKYCVerificationPress = () => {
    // navigation.navigate('UnlockAccess');
  }

  const handleSavedPress = () => {
    navigation.navigate('SavedPost');
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
    Alert.alert(t('settings.yourActivity'), t('settings.navigateYourActivity'));
  };

  const handleNotificationsPress = () => {
    navigation.navigate('notificationEnable');
  };

  const handleTimeManagementPress = () => {
    Alert.alert(t('settings.timeManagement'), t('settings.navigateTimeManagement'));
  };

  const handleAccountPrivacyPress = () => {
    Alert.alert(t('settings.accountPrivacy'), t('settings.navigateAccountPrivacy'));
  };

  const handleCloseFriendsPress = () => {
    Alert.alert(t('settings.topValens'), t('settings.navigateCloseFriends'));
  };

  const handleCrosspostingPress = () => {
    Alert.alert(t('settings.crossposting'), t('settings.navigateCrossposting'));
  };

  const handleBlockedPress = () => {
    Alert.alert(t('settings.blocked'), t('settings.navigateBlocked'));
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
    Alert.alert(t('settings.messagesReplies'), t('settings.navigateMessages'));
  };

  const handleTagsPress = () => {
    Alert.alert(t('settings.tagsMentions'), t('settings.navigateTags'));
  };

  const handleCommentsPress = () => {
    Alert.alert(t('settings.comments'), t('settings.navigateComments'));
  };

  const handleSharingPress = () => {
    Alert.alert(t('settings.sharing'), t('settings.navigateSharing'));
  };

  const handleRestrictedPress = () => {
    Alert.alert(t('settings.restricted'), t('settings.navigateRestricted'));
  };

  const handleLimitInteractionsPress = () => {
    Alert.alert(t('settings.limitInteractions'), t('settings.navigateLimitInteractions'));
  };

  const handleHiddenWordsPress = () => {
    Alert.alert(t('settings.hiddenWords'), t('settings.navigateHiddenWords'));
  };

  const handleFollowInvitePress = () => {
    Alert.alert(t('settings.followInvite'), t('settings.navigateFollowInvite'));
  };

  const handleFavouritesPress = () => {
    Alert.alert(t('settings.favourites'), t('settings.navigateFavourites'));
  };

  const handleMutedAccountsPress = () => {
    Alert.alert(t('settings.mutedAccounts'), t('settings.navigateMutedAccounts'));
  };

  const handleContentPreferencesPress = () => {
    Alert.alert(t('settings.contentPreferences'), t('settings.navigateContentPreferences'));
  };

  const handleLikeShareCountsPress = () => {
    Alert.alert(t('settings.likeShareCounts'), t('settings.navigateLikeShareCounts'));
  };

  const handleSubscriptionsPress = () => {
    Alert.alert(t('settings.subscriptions'), t('settings.navigateSubscriptions'));
  };

  const handleDevicePermissionsPress = () => {
    Alert.alert(t('settings.devicePermissions'), t('settings.navigateDevicePermissions'));
  };

  const handleArchivingDownloadingPress = () => {
    Alert.alert(t('settings.archivingDownloading'), t('settings.navigateArchivingDownloading'));
  };

  const handleAccessibilityPress = () => {
    Alert.alert(t('settings.accessibility'), t('settings.navigateAccessibility'));
  };

  const handleLanguagePress = () => {
    Alert.alert(t('settings.languageTranslations'), t('settings.navigateLanguage'));
  };

  const handleDataUsagePress = () => {
    Alert.alert(t('settings.dataUsage'), t('settings.navigateDataUsage'));
  };

  const handleAppWebsitePress = () => {
    Alert.alert(t('settings.appWebsitePermissions'), t('settings.navigateAppWebsite'));
  };

  const handleEarlyAccessPress = () => {
    Alert.alert(t('settings.earlyAccess'), t('settings.navigateEarlyAccess'));
  };

  const handleAccountTypePress = () => {
    Alert.alert(t('settings.accountTypeTools'), t('settings.navigateAccountType'));
  };

  const handleMetaVerifiedPress = () => {
    Alert.alert(t('settings.metaVerified'), t('settings.navigateMetaVerified'));
  };

  const handleOrdersPaymentsPress = () => {
    Alert.alert(t('settings.ordersPayments'), t('settings.navigateOrdersPayments'));
  };

  const handleHelpPress = () => {
    const email = 'Support@valens.app';
    const subject = t('settings.helpEmailSubject');
    const body = t('settings.helpEmailBody');

    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(t('settings.error'), t('settings.noMailApp'));
    });
  };

  const handlePrivacyCentrePress = () => {
    Alert.alert(t('settings.privacyCentre'), t('settings.navigatePrivacyCentre'));
  };

  const handleAccountStatusPress = () => {
    Alert.alert(t('settings.accountStatus'), t('settings.navigateAccountStatus'));
  };

  const handleAboutPress = () => {
    Alert.alert(t('settings.about'), t('settings.appVersion'));
  };

  const handleWhatsAppPress = () => {
    Alert.alert(t('settings.whatsApp'), t('settings.navigateWhatsApp'));
  };

  const handleEditsPress = () => {
    Alert.alert(t('settings.edits'), t('settings.navigateEdits'));
  };

  const handleThreadsPress = () => {
    Alert.alert(t('settings.threads'), t('settings.navigateThreads'));
  };

  const handleFacebookPress = () => {
    Alert.alert(t('settings.facebook'), t('settings.navigateFacebook'));
  };

  const handleMessengerPress = () => {
    Alert.alert(t('settings.messenger'), t('settings.navigateMessenger'));
  };

  const handleMetaAIPress = () => {
    Alert.alert(t('settings.metaAI'), t('settings.navigateMetaAI'));
  };

  const handleRayBanPress = () => {
    Alert.alert(t('settings.rayBanMeta'), t('settings.navigateRayBan'));
  };

  const moveToLoginForAddingAccount = async () => {
    await AsyncStorage.setItem(ADDING_ACCOUNT_FLAG_KEY, 'true');
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
          t('settings.switchSessionExpired'),
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
        showToastMessage(toast, 'success', t('settings.switchedAccount'), 1500);
        return;
      }
    } catch (e) {
      console.warn('switchAccount', e);
      showToastMessage(toast, 'danger', e?.message || t('settings.switchFailed'));
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
      let accountCount = 0;
      try {
        const apiRes = await fetchDeviceAccounts();
        const accounts = apiRes?.data?.accounts || [];
        accountCount = accounts.length;
      } catch (e) {
        console.warn('fetchDeviceAccounts in remove check failed:', e?.message);
      }

      if (accountCount <= 1) {
        showToastMessage(
          toast,
          'danger',
          t('settings.cannotRemoveOnlyAccount'),
          3000,
        );
        return;
      }

      const res = await removeDeviceAccountRequest({ userId });
      const ok = res?.statusCode === 200 || res?.statusCode === 201;
      if (ok) {
        await removeSavedAccount(userId);
        setSwitchableAccounts(prev =>
          prev.filter(a => String(resolveAccountUserId(a)) !== String(userId)),
        );
        showToastMessage(toast, 'success', t('settings.accountRemovedFromDevice'), 2000);
      } else {
        showToastMessage(toast, 'danger', res?.message || t('settings.couldNotRemoveAccount'));
      }
    } catch (err) {
      showToastMessage(toast, 'danger', err?.message || t('settings.removeFailed'));
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
      Alert.alert(t('settings.error'), t('settings.unableToOpenAccountSwitcher'));
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(t('settings.logOut'), t('settings.logOutConfirmMessage'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logOut'),
        style: 'destructive',
        onPress: () => {
          (async () => {
            dispatch(setUserProfile('normal'));
            dispatch(showLoader());

            const currentUserId = await AsyncStorage.getItem('userId');

            let otherAccounts = [];
            try {
              const apiRes = await fetchDeviceAccounts();
              otherAccounts = extractAccountsFromDeviceAccountsResponse(apiRes);
              console.log('otherAccounts fetched BEFORE logout:', otherAccounts);
            } catch (e) {
              console.warn('fetchDeviceAccounts before logout failed:', e?.message);
            }

            try {
              const token = await AsyncStorage.getItem('token');
              const refreshToken = await AsyncStorage.getItem('refreshToken');
              await logout({ token, refreshToken });
            } catch (e) {
              // Ignore logout API failure; proceed with local logout.
            }

            let switchSuccess = false;
            try {
              if (otherAccounts && otherAccounts.length > 1) {
                const topAccount = otherAccounts[1];
                const targetUserId = resolveAccountUserId(topAccount);
                console.log('Switching to account:', targetUserId, topAccount);

                if (targetUserId) {
                  const switchRes = await switchAccountRequest({ targetUserId });
                  console.log('switchRes from logout:', switchRes);
                  const ok = switchRes?.statusCode === 200 || switchRes?.statusCode === 201;

                  if (ok) {
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

                    showToastMessage(
                      toast,
                      'success',
                      `${t('settings.switchedTo')} ${topAccount.displayName || t('settings.anotherAccount')}`,
                      2000,
                    );
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

            if (switchSuccess && currentUserId) {
              try {
                await removeDeviceAccountRequest({ userId: currentUserId });
                console.log('Removed old account from device after successful switch');
              } catch (e) {
                console.warn('removeDeviceAccountRequest failed (non-fatal after switch):', e?.message);
              }
              return;
            }

            if (currentUserId) {
              try {
                await removeDeviceAccountRequest({ userId: currentUserId });
                console.log('Removed current account from device on full logout');
              } catch (e) {
                console.warn('removeDeviceAccountRequest on full logout failed (non-fatal):', e?.message);
              }
            }

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
            showToastMessage(toast, 'success', t('settings.loggedOut'), 1500);
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
      t('settings.logOutAllAccounts'),
      t('settings.logOutAllConfirmMessage'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.logOutAll'),
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
        <Text style={styles.headerTitle}>{t('settings.headerTitle')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Your account section */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>{t('settings.yourAccount')}</Text>
          </View>

          <SettingsItem
            icon="subscriptions"
            title={t('settings.subscription')}
            onPress={handleSubscription}
          />

          <Text style={styles.sectionDescription}>
            {t('settings.accountSectionDescription')}
          </Text>
        </View>

        {/* How you use Instagram section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.usingValens')} />

          <SettingsItem
            icon="bookmark"
            title={t('settings.saved')}
            onPress={handleSavedPress}
          />
          <SettingsItem
            icon="archive"
            title={t('settings.archive')}
            onPress={handleArchivePress}
          />
        </View>

        {/* Who can see your content section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.whoCanSeeContent')} />

          <SettingsItem
            icon="privacy-tip"
            title={t('settings.accountPrivacy')}
            rightText={t('settings.private')}
          />
          <SettingsItem
            icon="visibility-off"
            title={t('settings.hidePosts')}
            onPress={handleHideStoryPress}
          />
        </View>

        {/* More info and support section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.moreInfoSupport')} />

          <SettingsItem
            icon="help-outline"
            title={t('settings.help')}
            onPress={handleHelpPress}
          />
          <SettingsItem
            icon="info"
            title={t('settings.about')}
            onPress={handleAboutPress}
          />
        </View>

        {/* Login section */}
        <View style={styles.section}>
          <SectionHeader title={t('settings.loginSection')} />
          <ActionItem
            title={loadingAccounts ? t('settings.loadingAccounts') : t('settings.addAccounts')}
            onPress={handleAddAccountPress}
            isDestructive={true}
          />
          <ActionItem
            title={t('settings.logOut')}
            onPress={handleLogoutPress}
            isDestructive={true}
          />
        </View>

        <RBSheet
          ref={refRBSheet}
          draggable
          customModalProps={{
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

      {/* Account Switcher Modal */}
      <Modal
        visible={accountSwitcherVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountSwitcherVisible(false)}
      >
        <View style={switcherStyles.overlay}>
          <View style={[switcherStyles.card, { backgroundColor: card }]}>
            <Text style={[switcherStyles.title, { color: text }]}>{t('settings.switchAccount')}</Text>
            <Text style={[switcherStyles.subtitle, { color: text }]}>
              {t('settings.switchAccountSubtitle')}
            </Text>

            {switchInFlight ? (
              <View style={switcherStyles.inlineLoading}>
                <ActivityIndicator style={switcherStyles.inlineSpinner} color={text} />
                <Text style={[switcherStyles.inlineLoadingText, { color: text }]}>
                  {t('settings.switching')}
                </Text>
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
                    `${t('settings.account')} ${account.id}`;

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
                          setAccountSwitcherVisible(false);
                          setTimeout(() => {
                            openRemoveAccountConfirm(account);
                          }, 300);
                        }}
                        disabled={switchInFlight}
                        style={switcherStyles.removeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={t('settings.removeAccountFromDevice')}
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
              <Text style={switcherStyles.addBtnText}>{t('settings.addAnotherAccount')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[switcherStyles.cancelBtn, { borderColor: text }]}
              onPress={() => setAccountSwitcherVisible(false)}
            >
              <Text style={[switcherStyles.cancelBtnText, { color: text }]}>{t('settings.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Remove Account Confirm Modal */}
      <Modal
        visible={!!removeAccountConfirm}
        transparent
        animationType="fade"
        onRequestClose={closeRemoveAccountConfirm}
      >
        <View style={switcherStyles.overlay}>
          <View style={[switcherStyles.card, { backgroundColor: card }]}>
            <Text style={[switcherStyles.title, { color: text }]}>{t('settings.logOut')}</Text>
            <Text style={[switcherStyles.confirmBody, { color: text }]}>
              {t('settings.logoutFromDeviceConfirm')}
            </Text>
            <TouchableOpacity
              style={[switcherStyles.addBtn, { backgroundColor: text }]}
              onPress={confirmRemoveAccountFromDevice}
              disabled={switchInFlight}
            >
              <Text style={switcherStyles.addBtnText}>{t('settings.logout')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[switcherStyles.cancelBtn, { borderColor: text }]}
              onPress={closeRemoveAccountConfirm}
              disabled={switchInFlight}
            >
              <Text style={[switcherStyles.cancelBtnText, { color: text }]}>{t('settings.cancel')}</Text>
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
