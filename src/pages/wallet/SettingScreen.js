import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { getUserCredentials } from '../../services/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile } from '../../services/createProfile';
import { useAppTheme } from '../../theme/useApptheme';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useLanguage } from '../../i18n';

export const SettingsScreen = ({ navigation }) => {
  const [autoInvest, setAutoInvest] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [userData, setUserData] = useState();
  const [profileData, setProfileData] = useState();
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const dispatch = useDispatch();
  const toast = useToast();
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();

  const profilePhotoUri =
    profileImage ||
    userData?.image ||
    'https://cdn-icons-png.flaticon.com/512/149/149071.png';

  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        const id = await AsyncStorage.getItem('userId');
        if (!id) return;

        await Promise.all([
          fetchUserCreds(id),
          fetchProfile(id),
        ]);
      };

      fetchData();
    }, [])
  );

  const fetchUserCreds = async (id) => {
    try {
      dispatch(showLoader());
      const response = await getUserCredentials(id);

      if (response?.statusCode === 200) {
        let userDataToSet;
        if (response.data && response.data.user) {
          userDataToSet = response.data.user;
        } else if (response.data) {
          userDataToSet = response.data;
        } else {
          userDataToSet = response;
        }

        if (userDataToSet?.image) {
          let formattedImageUrl = userDataToSet.image.trim();

          if (formattedImageUrl.startsWith('http://') || formattedImageUrl.startsWith('https://')) {
            console.log('Image URL is already absolute:', formattedImageUrl);
          } else if (formattedImageUrl.startsWith('/')) {
            formattedImageUrl = `http://35.174.167.92:3002${formattedImageUrl}`;
          } else {
            formattedImageUrl = `http://35.174.167.92:3002/${formattedImageUrl}`;
          }

          userDataToSet.image = formattedImageUrl;
        }

        console.log(userDataToSet, 'this is response from getUserDashboard in wallet');
        setUserData(userDataToSet);
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? t('walletSettings.fetchError'),
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const fetchProfile = async (id) => {
    try {
      dispatch(showLoader());
      const response = await getProfile(id);
      if (response.statusCode === 200 && response.data) {
        console.log('response in fetchProfile useFocusEffect:', response);
        setProfileData(response.data);
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (err) {
      console.log('Error in fetchProfile:', err);
    } finally {
      dispatch(hideLoader());
    }
  };

  const settingsSections = [
    {
      title: t('walletSettings.sectionAccount'),
      items: [
        {
          label: t('walletSettings.profileSettings'),
          icon: 'person',
          action: () => {
            navigation.navigate('WalletEditProfile', { userdata: profileData });
          },
        },
        {
          label: t('walletSettings.verificationStatus'),
          icon: 'shield-checkmark',
          action: () => navigation.navigate('VerificationStatus'),
          status: t('walletSettings.verifiedStatus'),
        },
        {
          label: t('walletSettings.privacySettings'),
          icon: 'lock-closed',
          action: () => { navigation.navigate('PrivacySettings'); },
        },
      ],
    },
    {
      title: t('walletSettings.sectionSecurity'),
      items: [
        {
          label: t('walletSettings.twoFactorAuth'),
          icon: 'shield',
          action: () => { navigation.navigate('TwoFactorAuth'); },
          status: t('walletSettings.twoFactorEnabled'),
        },
        {
          label: t('walletSettings.changePassword'),
          icon: 'key',
          action: () => navigation.navigate('ChangePassword'),
        },
        {
          label: t('walletSettings.loginHistory'),
          icon: 'time',
          action: () => { navigation.navigate('LoginHistory'); },
        },
      ],
    },
  ];

  const renderSettingItem = ({ item }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={item.action}
      disabled={item.toggle}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={item.icon} size={20} color={text} />
        <Text style={styles.settingLabel}>{item.label}</Text>
      </View>
      <View style={styles.settingRight}>
        {item.toggle ? (
          <TouchableOpacity
            style={[styles.toggleButton, item.value && { backgroundColor: text }]}
            onPress={() => item.onToggle(!item.value)}
          >
            <View style={[styles.toggleSwitch, item.value && styles.toggleSwitchActive]} />
          </TouchableOpacity>
        ) : (
          <View style={styles.settingValue}>
            {item.value && <Text style={styles.settingText}>{item.value}</Text>}
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section) => (
    <View key={section.title} style={styles.settingsSection}>
      <Text style={[styles.sectionTitle, textStyle]}>{section.title}</Text>
      <View style={[styles.settingsContainer, { shadowColor: text }]}>
        <FlatList
          data={section.items}
          renderItem={renderSettingItem}
          keyExtractor={(item) => item.label}
          scrollEnabled={false}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <View style={[styles.userInfoCard, { shadowColor: text }]}>
          <View style={styles.profileAvatarWrap}>
            <HexAvatar
              uri={profilePhotoUri}
              size={72}
              borderWidth={2.5}
              borderColor={text}
            />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userData?.displayName}</Text>
            <Text style={styles.userUsername}>@{userData?.userName}</Text>
          </View>
        </View>

        {/* Settings Sections */}
        {settingsSections.map(renderSection)}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 40,
    marginBottom: Platform.OS == "ios" ? 70 : 0
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  // User Info Card
  userInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginTop: Platform.OS == "ios" ? 20 : 0
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Settings Sections
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  settingsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#111',
    marginLeft: 12,
  },
  profileAvatarWrap: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingStatus: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    marginRight: 8,
  },
  settingText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },

  // Toggle Switch
  toggleButton: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleSwitchActive: {
    alignSelf: 'flex-end',
  },
});

export default SettingsScreen;
