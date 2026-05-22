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
import { useLanguage } from '../../i18n';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useAppTheme } from '../../theme/useApptheme';
import { normalizeProfileType } from '../../utils/supportEligibility';

const ShareProfile = ({ navigation }) => {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const routeParams = useRoute().params || {};
  const { userData, targetUserId } = routeParams;
  const viewShotRef = useRef(null);
  const profile = useMemo(() => {
    if (!userData) return {};
    // handle both { user: {...} } and flat object
    return userData?.user && typeof userData.user === 'object'
      ? userData.user
      : userData;
  }, [userData]);
  console.log('[ShareProfile] debug', {
  resolvedUsername,
  resolvedUserId,
  primaryShareUrl,
  qrShareUrl,
});
  const [username, setUsername] = useState('');
  const ownProfileImage = useSelector(state => state.profileImage?.profileImg);
  const currentUser = useSelector(state => state.user?.profile || state.auth?.user);

  const qrSize = 180;
  const qrAvatarSize = 56;
  const qrAvatarPos = (qrSize / 2) - (qrAvatarSize / 2);

  const resolvedProfileType = useMemo(() => normalizeProfileType(
    profile?.profile ??
    profile?.accountType ??
    userData?.profile ??
    routeParams?.profile
  ), [profile?.accountType, profile?.profile, routeParams?.profile, userData?.profile]);

  const { text } = useAppTheme(resolvedProfileType);
  const profileActionGradient =
    resolvedProfileType === 'company'
      ? ['#D3B683', '#e0e0c7']
      : ['#513189bd', '#e54ba0'];

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
        Alert.alert(t('shareProfile.permissionDenied'));
        return;
      }

      if (!viewShotRef.current) {
        Alert.alert(t('shareProfile.errorTitle'), t('shareProfile.qrNotReady'));
        return;
      }

      const uri = await viewShotRef.current.capture();

      if (!uri) {
        Alert.alert(t('shareProfile.errorTitle'), t('shareProfile.captureFailed'));
        return;
      }

      const sourcePath = normalizeFilePath(uri);

      let saveUri = uri;

      if (Platform.OS === 'android') {
        const newPath = `${RNFS.PicturesDirectoryPath}/qr_${Date.now()}.png`;
        await RNFS.moveFile(sourcePath, newPath);
        saveUri = `file://${newPath}`;
      } else {
        saveUri = uri.startsWith('file://') ? uri : `file://${sourcePath}`;
      }

      await CameraRoll.save(saveUri, {
        type: 'photo',
        album: 'Valens',
      });

      showToastMessage(toast, 'success', t('shareProfile.qrSavedToGallery'));

    } catch (error) {
      console.log('FINAL ERROR:', error);
      Alert.alert(t('shareProfile.errorTitle'), error?.message || t('shareProfile.captureFailed'));
    }
  };

  const toBold = (str) =>
    String(str)
      .split('')
      .map((c) => {
        const code = c.codePointAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(code + 0x1D400 - 65);
        if (code >= 97 && code <= 122) return String.fromCodePoint(code + 0x1D41A - 97);
        if (code >= 48 && code <= 57) return String.fromCodePoint(code + 0x1D7CE - 48);
        return c;
      })
      .join('');

  const resolvedUsername = useMemo(() => String(
    profile?.userName ||
    profile?.username ||
    profile?.displayName ||
    ''
  ).trim(), [profile]);

  const resolvedUserId = useMemo(() => String(
    profile?.id ||
    profile?.userId ||
    profile?._id ||
    targetUserId ||
    ''
  ).trim(), [profile, targetUserId]);

  const currentUserId = useMemo(() => (
    String(
      currentUser?.id ||
      currentUser?.userId ||
      currentUser?._id ||
      '',
    ).trim()
  ), [currentUser]);

  const isOwnProfile = Boolean(resolvedUserId && currentUserId && resolvedUserId === currentUserId);

  const resolvedAvatarUri = useMemo(() => (
    profile?.image ||
    profile?.profileImage ||
    (isOwnProfile ? ownProfileImage : null) ||
    'https://cdn-icons-png.flaticon.com/512/149/149071.png'
  ), [isOwnProfile, ownProfileImage, profile?.image, profile?.profileImage]);


    const primaryShareUrl = useMemo(() => {
    const slug = resolvedUsername || resolvedUserId;
    if (!slug) return null;
    return `https://api.valens.app/u/${slug}`;
  }, [resolvedUsername, resolvedUserId]);

  const qrShareUrl = primaryShareUrl || 'https://api.valens.app';

  const shareMessage = useMemo(() => {
    if (!resolvedUsername && !resolvedUserId) return '';
    return `Check out @${resolvedUsername || resolvedUserId} on Valens\n${primaryShareUrl}`;
  }, [resolvedUsername, resolvedUserId, primaryShareUrl]);


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
      Alert.alert(t('shareProfile.errorTitle'), t('shareProfile.noLinkToCopy'));
      return;
    }

    Clipboard.setString(primaryShareUrl);
    showToastMessage(toast, 'success', t('shareProfile.profileLinkCopied'));
  };

  const onShare = async () => {
  try {
    if (!primaryShareUrl) {
      Alert.alert(t('shareProfile.profileNotAvailable'), t('shareProfile.profileNotAvailableMessage'));
      return;
    }

    await Share.share({
      // ✅ URL must be in message for Android — WhatsApp, Teams ignore the url field
      message: `Check out @${resolvedUsername || 'valens'} on Valens\n${primaryShareUrl}`,
      url: primaryShareUrl,   // iOS only
      title: 'Valens Profile',
    });
  } catch (error) {
    Alert.alert(t('shareProfile.shareErrorTitle'), error.message);
  }
};

  const actionButtons = [
    {
      id: 'copy',
      icon: 'link',
      iconFamily: 'Feather',
      onPress: copyToClipboard,
      label: t('shareProfile.copyLink'),
    },
    {
      id: 'download',
      icon: 'download-outline',
      iconFamily: 'Ionicons',
      onPress: downloadQRCode,
      label: t('shareProfile.save'),
    },
    {
      id: 'share',
      icon: 'share-outline',
      iconFamily: 'Ionicons',
      onPress: onShare,
      label: t('shareProfile.share'),
    },
  ];

  const hasShareUrl = Boolean(primaryShareUrl);

  return (
    <LinearGradient
      colors={profileActionGradient}
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
          <Text style={styles.headerTitle}>{t('shareProfile.headerTitle')}</Text>
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
              <HexAvatar
                uri={resolvedAvatarUri}
                size={54}
                borderWidth={2}
                borderColor="rgba(255,255,255,0.35)"
              />
              <View style={styles.profileText}>
                <Text style={styles.brandText}>{t('shareProfile.brandName')}</Text>
                <Text style={styles.handleText} numberOfLines={1}>
                  @{resolvedUsername || 'valens'}
                </Text>
                <Text style={styles.subtitle}>{t('shareProfile.scanOrShare')}</Text>
              </View>
            </View>

            <View style={styles.qrContainer}>
              <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
                <View style={styles.qrCard}>
                  <View style={[styles.qrCodeWrapper, { width: qrSize, height: qrSize }]}>
                    <QRCode
                      value={qrShareUrl}
                      size={qrSize}
                      color="#111"
                      backgroundColor="#ffffff"
                    />

                    <View style={[
                      styles.qrAvatarWrapper,
                      {
                        width: qrAvatarSize,
                        height: qrAvatarSize,
                        top: qrAvatarPos,
                        left: qrAvatarPos,
                      },
                    ]}>
                      <HexAvatar
                        uri={resolvedAvatarUri}
                        size={qrAvatarSize}
                        borderWidth={2.5}
                        borderColor={text}
                      />
                    </View>
                  </View>
                </View>
              </ViewShot>
            </View>
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
  qrCodeWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrAvatarWrapper: {
    position: 'absolute',
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
