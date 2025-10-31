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
} from 'react-native';
import { loggedOut } from '../../redux/actions/LoginAction';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import RBSheet from 'react-native-raw-bottom-sheet';
import createStyles from './Style';
import data from '../../list.json';
import { SafeAreaView } from 'react-native-safe-area-context';

const Settings = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const styles = createStyles();
  const refRBSheet = useRef();

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
    Alert.alert('Help', 'Navigate to Help Center');
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

  const handleAddAccountPress = () => {
    Alert.alert('Add account', 'Navigate to Add account');
  };

  const handleLogoutPress = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          AsyncStorage.setItem('isLoggedIn', 'false');
          AsyncStorage.removeItem('token');
          AsyncStorage.removeItem('firebaseToken');
          AsyncStorage.removeItem('userId');
          AsyncStorage.removeItem('username');
          AsyncStorage.removeItem('email');
          AsyncStorage.removeItem('walletAddress');
          AsyncStorage.removeItem('walletPrivateKey');
          AsyncStorage.removeItem('walletMnemonic');
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
            AsyncStorage.setItem('isLoggedIn', 'false');
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
      <StatusBar barStyle="dark-content" backgroundColor="#f8f2fd" />

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

          <SettingsItem
            icon="account-circle"
            title="Accounts Center"
            subtitle="Password, security, personal details, ad preferences"
            onPress={handleAccountsCentrePress}
          />
          <SettingsItem
            icon="account-circle"
            title="KYC Verification"
            onPress={handleKYCVerificationPress}
          />
          {/* <SettingsItem
            icon="offline-bolt"
            title="Quick Buy"
            onPress={handleQuickBuy}
          />
          <SettingsItem
            icon="currency-exchange"
            title="Cash Out"
            onPress={handleCashOut}
          /> */}

          <SettingsItem
            icon="subscriptions"
            title="Subscription"
            onPress={handleSubscription}
          />

          <Text style={styles.sectionDescription}>
            Manage your connected experiences and account settings across Meta
            technologies.
            <Text style={styles.learnMore}> Learn more</Text>
          </Text>
        </View>

        {/* How you use Instagram section */}
        <View style={styles.section}>
          <SectionHeader title="How you use Instagram" />

          <SettingsItem
            icon="bookmark"
            title="Saved"
            onPress={handleSavedPress}
          />

          <SettingsItem
            icon="delete-outline"
            title="Archive"
            onPress={handleArchivePress}
          />

          <SettingsItem
            icon="bug-report"
            title="Your activity"
            onPress={handleActivityPress}
          />

          <SettingsItem
            icon="notifications-active"
            title="Notifications"
            onPress={handleNotificationsPress}
          />

          <SettingsItem
            icon="schema"
            title="Time management"
            onPress={handleTimeManagementPress}
          />
        </View>

        {/* Who can see your content section */}
        <View style={styles.section}>
          <SectionHeader title="Who can see your content" />

          <SettingsItem
            icon="privacy-tip"
            title="Account privacy"
            rightText="Private"
            onPress={handleAccountPrivacyPress}
          />

          <SettingsItem
            icon="star"
            title="Top Valens"
            rightText="0"
            onPress={handleCloseFriendsPress}
          />

          <SettingsItem
            icon="add-box"
            title="Crossposting"
            onPress={handleCrosspostingPress}
          />

          <SettingsItem
            icon="block"
            title="Blocked"
            rightText="18"
            onPress={handleBlockedPress}
          />

          <SettingsItem
            icon="visibility-off"
            title="Hide Posts"
            onPress={handleHideStoryPress}
          />
        </View>

        {/* How others can interact with you section */}
        <View style={styles.section}>
          <SectionHeader title="How others can interact with you" />

          <SettingsItem
            icon="message"
            title="Messages and story replies"
            onPress={handleMessagesPress}
          />

          <SettingsItem
            icon="alternate-email"
            title="Tags and mentions"
            onPress={handleTagsPress}
          />

          <SettingsItem
            icon="comment"
            title="Comments"
            onPress={handleCommentsPress}
          />

          <SettingsItem
            icon="share"
            title="Sharing"
            onPress={handleSharingPress}
          />

          <SettingsItem
            icon="do-not-disturb"
            title="Restricted"
            rightText="4"
            onPress={handleRestrictedPress}
          />

          <SettingsItem
            icon="pause-circle-outline"
            title="Limit interactions"
            rightText="Off"
            onPress={handleLimitInteractionsPress}
          />

          <SettingsItem
            icon="text-fields"
            title="Hidden words"
            onPress={handleHiddenWordsPress}
          />

          <SettingsItem
            icon="person-add"
            title="Follow and invite friends"
            onPress={handleFollowInvitePress}
          />
        </View>

        {/* What you see section */}
        <View style={styles.section}>
          <SectionHeader title="What you see" />

          <SettingsItem
            icon="star-border"
            title="Favourites"
            rightText="0"
            onPress={handleFavouritesPress}
          />

          <SettingsItem
            icon="volume-off"
            title="Muted accounts"
            rightText="0"
            onPress={handleMutedAccountsPress}
          />

          <SettingsItem
            icon="settings"
            title="Content preferences"
            onPress={handleContentPreferencesPress}
          />

          <SettingsItem
            icon="favorite-border"
            title="Like and share counts"
            onPress={handleLikeShareCountsPress}
          />

          <SettingsItem
            icon="subscriptions"
            title="Subscriptions"
            onPress={handleSubscriptionsPress}
          />
        </View>

        {/* Your app and media section */}
        <View style={styles.section}>
          <SectionHeader title="Your app and media" />

          <SettingsItem
            icon="smartphone"
            title="Device permissions"
            onPress={handleDevicePermissionsPress}
          />

          <SettingsItem
            icon="cloud-download"
            title="Archiving and downloading"
            onPress={handleArchivingDownloadingPress}
          />

          <SettingsItem
            icon="accessibility"
            title="Accessibility"
            onPress={handleAccessibilityPress}
          />

          <SettingsItem
            icon="language"
            title="Language and translations"
            onPress={handleLanguagePress}
          />

          <SettingsItem
            icon="data-usage"
            title="Data usage and media quality"
            onPress={handleDataUsagePress}
          />

          <SettingsItem
            icon="web"
            title="App website permissions"
            onPress={handleAppWebsitePress}
          />

          <SettingsItem
            icon="new-releases"
            title="Early access to features"
            onPress={handleEarlyAccessPress}
          />
        </View>

        {/* For professionals section */}
        <View style={styles.section}>
          <SectionHeader title="For professionals" />

          <SettingsItem
            icon="work"
            title="Account type and tools"
            onPress={handleAccountTypePress}
          />

          {/* <SettingsItem
            icon="verified"
            title="Certified"
            // rightText="Not subscribed"
            onPress={handleMetaVerifiedPress}
          /> */}
        </View>

        {/* Your orders and fundraisers section */}
        {/* <View style={styles.section}>
          <SectionHeader title="Your orders and fundraisers" />

          <SettingsItem
            icon="shopping-bag"
            title="Orders and payments"
            onPress={handleOrdersPaymentsPress}
          />
        </View> */}

        {/* More info and support section */}
        <View style={styles.section}>
          <SectionHeader title="More info and support" />

          <SettingsItem
            icon="help-outline"
            title="Help"
            onPress={handleHelpPress}
          />

          <SettingsItem
            icon="privacy-tip"
            title="Privacy Center"
            onPress={handlePrivacyCentrePress}
          />

          <SettingsItem
            icon="account-circle"
            title="Account Status"
            onPress={handleAccountStatusPress}
          />

          <SettingsItem icon="info" title="About" onPress={handleAboutPress} />
        </View>

        {/* Login section */}
        <View style={styles.section}>
          <SectionHeader title="Login" />

          <ActionItem
            title="Add account"
            onPress={handleAddAccountPress}
            isBlue={true}
          />

          <ActionItem
            title="Log out"
            onPress={handleLogoutPress}
            isDestructive={true}
          />

          <ActionItem
            title="Log out of all accounts"
            onPress={handleLogoutAllPress}
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
