import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  PermissionsAndroid,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { buildProfileSharePayload } from '../../utils/profileShare';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ShareProfile = ({ navigation }) => {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const routeParams = useRoute().params || {};
  const { userData, targetUserId } = routeParams;
  const viewShotRef = useRef(null);
  const profile = useMemo(() => (
    userData?.user && typeof userData.user === 'object'
      ? userData.user
      : (userData || {})
  ), [userData]);
  const [username, setUsername] = useState('');
  const ownProfileImage = useSelector(state => state.profileImage?.profileImg);

  const requestPermission = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const normalizeFilePath = (path) => (
    typeof path === 'string' && path.startsWith('file://')
      ? path.replace('file://', '')
      : path
  );

  const downloadQRCode = async () => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied');
        return;
      }

      if (!viewShotRef.current) {
        Alert.alert('Error', 'QR not ready');
        return;
      }

      // Capture QR
      const uri = await viewShotRef.current.capture();

      if (!uri) {
        Alert.alert('Error', 'Capture failed');
        return;
      }

      const sourcePath = normalizeFilePath(uri);

      let saveUri = uri;

      if (Platform.OS === 'android') {
        // Create new file path
        const newPath = `${RNFS.PicturesDirectoryPath}/qr_${Date.now()}.png`;

        // Move file from cache → pictures
        await RNFS.moveFile(sourcePath, newPath);

        // Save to gallery
        saveUri = `file://${newPath}`;
      } else {
        // iOS: save directly from the temp file returned by view-shot
        saveUri = uri.startsWith('file://') ? uri : `file://${sourcePath}`;
      }

      await CameraRoll.save(saveUri, {
        type: 'photo',
        album: 'Valens',
      });

      showToastMessage(toast, 'success', 'QR saved to gallery ✅');

    } catch (error) {
      console.log('FINAL ERROR:', error);
      Alert.alert('Error', error?.message || 'Failed to save QR');
    }
  };

  const toBold = (str) =>
    String(str)
      .split('')
      .map((c) => {
        const code = c.codePointAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(code + 0x1D400 - 65);  // A–Z
        if (code >= 97 && code <= 122) return String.fromCodePoint(code + 0x1D41A - 97);  // a–z
        if (code >= 48 && code <= 57) return String.fromCodePoint(code + 0x1D7CE - 48);  // 0–9
        return c; // keep @, ., :, / etc. as-is
      })
    .join('');

  const resolvedUsername = useMemo(() => (
    String(
      username ||
      profile?.userName ||
      profile?.username ||
      profile?.displayName ||
      '',
    ).trim()
  ), [profile, username]);

  const resolvedUserId = useMemo(() => (
    String(
      profile?.id ||
      profile?.userId ||
      profile?._id ||
      userData?.id ||
      userData?.userId ||
      userData?._id ||
      targetUserId ||
      '',
    ).trim()
  ), [profile, targetUserId, userData]);

  const {
    primaryShareUrl,
    shareMessage,
  } = useMemo(() => buildProfileSharePayload({
    username: resolvedUsername,
    userId: resolvedUserId,
  }), [resolvedUsername, resolvedUserId]);

  const qrShareUrl = primaryShareUrl || 'com.valens://profile';

  useFocusEffect(
    useCallback(() => {
      const nextUsername = String(
        profile?.userName ||
        profile?.username ||
        '',
      ).trim();
      setUsername(nextUsername);
    }, [profile])
  );

  const copyToClipboard = () => {
    if (!primaryShareUrl) {
      Alert.alert('Error', 'No link available to copy');
      return;
    }

    Clipboard.setString(primaryShareUrl);

    showToastMessage(toast, 'success', 'Profile link copied ✅');
  };

  const onShare = async () => {
    try {
      if (!resolvedUsername && !resolvedUserId) {
        Alert.alert('Profile not available', 'Unable to share profile right now.');
        return;
      }

      const resolvedUsername = String(username || '').trim();
      const profileLabel = resolvedUsername ? `@${resolvedUsername}` : 'this profile';

     const result = await Share.share({
      url: qrShareUrl,  
      message: `👤 Check out ${toBold(profileLabel)} on Valens!\n\n🔗 Open profile`,
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
    },
    // {
    //   id: 'twitter',
    //   icon: 'logo-twitter',
    //   iconFamily: 'Ionicons',
    //   onPress: () => Linking.openURL('https://x.com/i/flow/signup?lang=en'),
    //   label: 'Twitter',
    //   color: '#1DA1F2',
    // },
    // {
    //   id: 'home',
    //   icon: 'home',
    //   iconFamily: 'Feather',
    //   onPress: () => Linking.openURL('https://valensGoApp.com'),
    //   label: 'Home',
    //   color: '#34C759',
    // },
    {
      id: 'download',
      icon: 'download-outline',
      iconFamily: 'Ionicons',
      onPress: downloadQRCode,
      label: 'Save',
    },
    {
      id: 'share',
      icon: 'share-outline',
      iconFamily: 'Ionicons',
      onPress: onShare,
      label: 'Share',
    },
  ];

  const hasShareUrl = Boolean(primaryShareUrl);

  return (
    <LinearGradient
      colors={['#1F1147', '#6B2F8A', '#E54BA0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <View style={styles.closeButtonBackground}>
              <Ionicons name="close" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 12) + 20 },
          ]}
        >
          <View style={styles.shareCard}>
            <View style={styles.profileRow}>
              <Image
                source={{
                  uri:
                    profile?.image ||
                    profile?.profileImage ||
                    ownProfileImage ||
                    'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                }}
                style={styles.avatar}
              />
              <View style={styles.profileText}>
                <Text style={styles.brandText}>Valens</Text>
                <Text style={styles.handleText} numberOfLines={1}>
                  @{resolvedUsername || 'valens'}
                </Text>
                <Text style={styles.subtitle}>Scan or share the link below</Text>
              </View>
            </View>

            <View style={styles.qrContainer}>
              <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
                <View style={styles.qrCard}>
                  <QRCode
                    value={qrShareUrl}
                    size={180}
                    color="#111"
                    backgroundColor="#ffffff"
                  />
                </View>
              </ViewShot>
            </View>

            {/* <TouchableOpacity
              style={[styles.linkRow, !hasShareUrl && styles.linkRowDisabled]}
              onPress={copyToClipboard}
              activeOpacity={0.85}
              disabled={!hasShareUrl}
            >
              <Feather name="link" size={18} color="#FFFFFF" />
              <Text style={styles.linkText} numberOfLines={1}>
                {primaryShareUrl || 'Link unavailable'}
              </Text>
              <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity> */}
          </View>

          <View style={styles.actionsGrid}>
            {actionButtons.map((button) => (
              <TouchableOpacity
                key={button.id}
                style={[styles.actionTile, !hasShareUrl && styles.actionTileDisabled]}
                onPress={button.onPress}
                activeOpacity={0.85}
                disabled={!hasShareUrl && (button.id === 'copy' || button.id === 'share')}
              >
                <View style={styles.actionIcon}>
                  {button.iconFamily === 'Feather' ? (
                    <Feather name={button.icon} size={20} color="#fff" />
                  ) : (
                    <Ionicons name={button.icon} size={20} color="#fff" />
                  )}
                </View>
                <Text style={styles.actionTileText}>{button.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeButton: {
    zIndex: 1,
  },
  closeButtonBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  shareCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  profileText: {
    flex: 1,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  handleText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 6,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  linkRowDisabled: {
    opacity: 0.6,
  },
  linkText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: "20%",
  },
  actionTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionTileDisabled: {
    opacity: 0.6,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTileText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ShareProfile;
