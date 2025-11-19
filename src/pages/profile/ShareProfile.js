import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import Clipboard from '@react-native-clipboard/clipboard';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../theme/useApptheme';

const { width, height } = Dimensions.get('window');

const ShareProfile = ({ navigation }) => {
  const toast = useToast();
  const { userData } = useRoute().params || {};
  const profile = userData?.user;
  const [username, setUsername] = useState('');
  const profileImage = useSelector(state => state.profileImage?.profileImg);
  const { bgStyle, textStyle } = useAppTheme();

  const copyToClipboard = () => {
    Clipboard.setString(username);
    showToastMessage(toast, 'success', 'Username copied to clipboard ✅');
  };

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      console.log('ShareProfile got:', profile);
      setUsername(profile.userName);
    }, [profile])
  );

  const onShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out @${username} on Valens!\nhttps://valens.app/profile/${username}`,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with activity type:', result.activityType);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      Alert.alert('Error', 'Error sharing content: ' + error.message);
    }
  };

  const actionButtons = [
    {
      id: 'copy',
      icon: 'link',
      iconFamily: 'Feather',
      onPress: copyToClipboard,
      label: 'Copy Link',
      color: '#4A90E2',
    },
    {
      id: 'twitter',
      icon: 'logo-twitter',
      iconFamily: 'Ionicons',
      onPress: () => Linking.openURL('https://x.com/i/flow/signup?lang=en'),
      label: 'Twitter',
      color: '#1DA1F2',
    },
    {
      id: 'home',
      icon: 'home',
      iconFamily: 'Feather',
      onPress: () => Linking.openURL('https://valens.app'),
      label: 'Home',
      color: '#34C759',
    },
    {
      id: 'download',
      icon: 'download-outline',
      iconFamily: 'Ionicons',
      onPress: () => {
        // Add download functionality here
        showToastMessage(toast, 'info', 'Download feature coming soon!');
      },
      label: 'Save',
      color: '#FF9500',
    },
    {
      id: 'share',
      icon: 'share-outline',
      iconFamily: 'Ionicons',
      onPress: onShare,
      label: 'Share',
      color: '#FF3B30',
    },
  ];

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb', '#f5576c']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <View style={styles.closeButtonBackground}>
            <Ionicons name="close" size={22} color="#333" />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Profile Card */}
        <View style={[styles.profileCard, bgStyle]}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{ uri: profileImage || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }}
              style={styles.profileImage}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.imageOverlay}
            />
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.appName}>valens</Text>
            <Text style={styles.username}>@{username}</Text>
            <Text style={styles.subtitle}>Share this profile with friends</Text>
          </View>
        </View>

        {/* QR Code Placeholder */}
        <View style={styles.qrContainer}>
          <View style={[styles.qrPlaceholder, bgStyle]}>
            <Ionicons name="qr-code-outline" size={60} color="#666" />
            <Text style={styles.qrText}>QR Code</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <View style={styles.actionButtons}>
          {actionButtons.map((button) => (
            <TouchableOpacity
              key={button.id}
              style={[styles.actionButton, { backgroundColor: button.color }]}
              onPress={button.onPress}
              activeOpacity={0.8}
            >
              {button.iconFamily === 'Feather' ? (
                <Feather name={button.icon} size={24} color="#fff" />
              ) : (
                <Ionicons name={button.icon} size={24} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.actionLabels}>
          {actionButtons.map((button) => (
            <Text key={`${button.id}-label`} style={styles.actionLabel}>
              {button.label}
            </Text>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  closeButton: {
    zIndex: 1,
  },
  closeButtonBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  profileCard: {
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  profileInfo: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#333',
    marginBottom: 8,
    fontFamily: 'FontsFree-Net-Billabong',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrPlaceholder: {
    borderRadius: 16,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  actionLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
    width: 56,
  },
});

export default ShareProfile;