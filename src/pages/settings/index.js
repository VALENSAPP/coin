import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  TextInput,
  Linking,
} from 'react-native';
import { loggedOut } from '../../redux/actions/LoginAction';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import RBSheet from 'react-native-raw-bottom-sheet';
import createStyles from './Style';
import data from '../../list.json';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/useApptheme';
import { setUserProfile } from '../../redux/actions/UserProfileAction';

const Settings = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const styles = createStyles();
  const refRBSheet = useRef();
  const { bgStyle, textStyle, bg } = useAppTheme();

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
    Alert.alert('Archive', 'Navigate to Archive');
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

  const handleAddAccountPress = async () => {
    await AsyncStorage.setItem('isLoggedIn', 'false');
    dispatch(loggedOut());
  };

  const handleLogoutPress = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          dispatch(setUserProfile('normal'))
          AsyncStorage.setItem('isLoggedIn', 'false');
          AsyncStorage.removeItem('token');
          AsyncStorage.removeItem('firebaseToken');
          AsyncStorage.removeItem('userId');
          AsyncStorage.removeItem('username');
          AsyncStorage.removeItem('email');
          AsyncStorage.removeItem('walletAddress');
          AsyncStorage.removeItem('walletPrivateKey');
          AsyncStorage.removeItem('walletMnemonic');
          AsyncStorage.removeItem('profile');
          AsyncStorage.removeItem('stripeCustomerId');
          dispatch(loggedOut());
        },
      },
    ]);
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
            dispatch(setUserProfile('normal'))
            AsyncStorage.setItem('isLoggedIn', 'false');
            AsyncStorage.removeItem('profile');
            AsyncStorage.removeItem('stripeCustomerId');
            dispatch(loggedOut());
          },
        },
      ],
    );
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
            title="Log out"
            onPress={handleLogoutPress}
            isDestructive={true}
          />
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
                  onPress={() => refScrollable.current.close()}
                  style={styles.gridButtonContainer}
                >
                  <Text style={styles.gridLabel}>{grid.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </RBSheet>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Settings;
