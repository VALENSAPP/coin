import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Image,
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

export const SettingsScreen = ({ navigation }) => {
  const [autoInvest, setAutoInvest] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [userData, setUserData] = useState();
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const dispatch = useDispatch();
  const toast = useToast();

  useFocusEffect(
    React.useCallback(() => {
      fetchUserCreds();
    }, [])
  );

  const fetchUserCreds = async () => {
    const id = await AsyncStorage.getItem('userId');
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
          let formattedImageUrl = userDataToSet.image;
          formattedImageUrl = formattedImageUrl.trim();

          if (formattedImageUrl.startsWith('http://') || formattedImageUrl.startsWith('https://')) {
            console.log('Image URL is already absolute:', formattedImageUrl);
          } else if (formattedImageUrl.startsWith('/')) {
            formattedImageUrl = `http://35.174.167.92:3002${formattedImageUrl}`;
            console.log('Converted relative URL to absolute:', formattedImageUrl);
          } else {
            formattedImageUrl = `http://35.174.167.92:3002/${formattedImageUrl}`;
            console.log('Converted path to absolute URL:', formattedImageUrl);
          }

          userDataToSet.image = formattedImageUrl;
          console.log('Final formatted image URL:', formattedImageUrl);
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
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { label: 'Profile Settings', icon: 'person', action: () => { } },
        { label: 'Verification Status', icon: 'shield-checkmark', action: () => { }, status: 'Dragonfly Verified' },
        { label: 'Privacy Settings', icon: 'lock-closed', action: () => { } },
      ]
    },
    {
      title: 'Trading',
      items: [
        { label: 'Auto-invest', icon: 'flash', toggle: true, value: autoInvest, onToggle: setAutoInvest },
        { label: 'Price Alerts', icon: 'notifications', toggle: true, value: priceAlerts, onToggle: setPriceAlerts },
        { label: 'Default Buy Amount', icon: 'wallet', action: () => { }, value: '$25' },
      ]
    },
    {
      title: 'Security',
      items: [
        { label: 'Two-Factor Auth', icon: 'shield', action: () => { }, status: 'Enabled' },
        { label: 'Change Password', icon: 'key', action: () => navigation.navigate('ChangePassword') },
        { label: 'Login History', icon: 'time', action: () => { } },
      ]
    }
  ];

  const renderSettingItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.settingItem}
      onPress={item.action}
      disabled={item.toggle}
    >
      <View style={styles.settingLeft}>
        <Ionicons name={item.icon} size={20} color="#5a2d82" />
        <Text style={styles.settingLabel}>{item.label}</Text>
      </View>
      <View style={styles.settingRight}>
        {item.toggle ? (
          <TouchableOpacity
            style={[styles.toggleButton, item.value && styles.toggleButtonActive]}
            onPress={() => item.onToggle(!item.value)}
          >
            <View style={[styles.toggleSwitch, item.value && styles.toggleSwitchActive]} />
          </TouchableOpacity>
        ) : (
          <View style={styles.settingValue}>
            {/* {item.status && <Text style={styles.settingStatus}>{item.status}</Text>} */}
            {item.value && <Text style={styles.settingText}>{item.value}</Text>}
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (section) => (
    <View key={section.title} style={styles.settingsSection}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <View style={styles.settingsContainer}>
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
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your account preferences</Text>
        </View> */}

        {/* User Info Card */}
        <View style={styles.userInfoCard}>
          <Image
            source={{
              uri: profileImage ? profileImage : "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            }}
            style={styles.profileImage}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userData?.displayName}</Text>
            <Text style={styles.userUsername}>@{userData?.userName}</Text>
            {/* <View style={styles.verificationBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#5a2d82" />
              <Text style={styles.verificationText}>Dragonfly Verified</Text>
            </View> */}
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
    backgroundColor: '#f8f2fd',
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
    color: '#5a2d82',
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
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginTop: Platform.OS == "ios" ? 20 : 0
  },
  userAvatar: {
    width: 60,
    height: 60,
    backgroundColor: '#5a2d82',
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
    color: '#5a2d82',
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
    shadowColor: '#5a2d82',
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
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 35,
    borderWidth: 2,
    marginRight: 16,
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
  toggleButtonActive: {
    backgroundColor: '#5a2d82',
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