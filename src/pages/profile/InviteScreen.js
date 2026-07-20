import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../theme/ThemeContext';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useLanguage } from '../../i18n';
import { BASE_URL } from '../../config/urls';

const { width } = Dimensions.get('window');

const withAlpha = (hex, alpha = 0.18) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(90,45,130,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function InviteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    bgStyle,
    text,
    accent,
    card,
    border,
    mutedText,
    icon,
    bg,
  } = useBusinessProfileTheme();
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();

  // Dark mode: readable white titles from the top; brand accent stays on CTAs / links.
  const titleColor = isDarkMode ? '#FFFFFF' : text;

  const userReferralCode = route?.params?.referralCode;
  const avatar = route?.params?.avatar;

  const qrGradientColors = useMemo(
    () =>
      isDarkMode
        ? [withAlpha(accent, 0.55), withAlpha(accent, 0.25), withAlpha(accent, 0.45)]
        : ['#FAD9B6', '#C6F6D9', '#BEE8FF', '#F1C9F2'],
    [accent, isDarkMode],
  );

  const copyReferralCode = () => {
    Clipboard.setString(userReferralCode);
    Alert.alert(t('invite.copiedTitle'), t('invite.copiedReferralMessage'));
  };

  const deepLinkQr = `${BASE_URL}/callback`;
  const deepLinkUrl = `${BASE_URL}/callback`;

  const qrSize = Math.min(width * 0.72, 320);
  const innerPadding = 14;
  const innerSize = qrSize + innerPadding;
  const avatarSize = 56;
  const avatarPos = (innerSize / 2) - (avatarSize / 2);

  const onShare = async () => {
    try {
      const inviteMessage = `${t('invite.shareMessage')}
${deepLinkUrl}

Referral Code: ${userReferralCode}`;

      await Share.share({
        message: inviteMessage,
        title: t('invite.shareTitle'),
      });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  const onCopyLink = () => {
    const inviteMessage = `${t('invite.shareMessage')}
${deepLinkUrl}

Referral Code: ${userReferralCode}`;

    Clipboard.setString(inviteMessage);

    Alert.alert(
      t('invite.copiedTitle'),
      t('invite.copiedReferralMessage')
    );
  };

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={icon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
            {t('invite.headerTitle')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.subtitle, { color: mutedText }]}>
          {t('invite.subtitle')}{' '}
          <Text style={[styles.learnMore, { color: accent }]}>
            {t('invite.learnMore')}
          </Text>
        </Text>

        {/* QR with themed gradient border */}
        <View style={{ height: 18 }} />

        <LinearGradient
          colors={qrGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.qrGradient, { width: innerSize + 16, height: innerSize + 16, borderRadius: 18 }]}
        >
          <View style={[styles.qrInner, { width: innerSize, height: innerSize, borderRadius: 14 }]}>
            <View style={{ width: qrSize, height: qrSize, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
              <QRCode value={deepLinkQr} size={qrSize * 0.94} />
            </View>
            <View style={[styles.avatarWrapper, {
              width: avatarSize,
              height: avatarSize,
              top: avatarPos,
              left: avatarPos,
            }]}>
              <HexAvatar
                uri={avatar}
                size={avatarSize}
                borderWidth={2.5}
                borderColor={accent}
              />
            </View>
          </View>
        </LinearGradient>

        {/* Share row */}
        <View style={{ height: 22 }} />
        <View style={styles.shareRow}>
          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: accent }]}
            onPress={onShare}
            activeOpacity={0.85}
          >
            <Text style={styles.shareText}>{t('invite.shareYourLink')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: card,
                borderColor: border,
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}
            onPress={onCopyLink}
            activeOpacity={0.85}
          >
            <Ionicons name="link-outline" size={22} color={icon} />
          </TouchableOpacity>
        </View>

        {/* Bottom section */}
        <View style={{ height: 28 }} />
        <Text style={[styles.sectionTitle, { color: titleColor }]}>
          {t('invite.yourInvites')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: mutedText }]}>
          {t('invite.yourInvitesSubtitle')}
        </Text>

        {/* Referral code box */}
        <View
          style={[
            styles.debugBox,
            {
              backgroundColor: card,
              borderColor: border,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View style={styles.referralRow}>
            <Text style={[styles.debugText, { color: mutedText }]}>
              {t('invite.referralCodeLabel')} {userReferralCode}
            </Text>
            <TouchableOpacity onPress={copyReferralCode} hitSlop={10}>
              <Ionicons name="copy-outline" size={18} color={icon} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 44,
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 6,
  },
  learnMore: {
    fontWeight: '700',
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qrGradient: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  qrInner: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
  },
  avatarWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  shareButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shareText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionSubtitle: {
    alignSelf: 'flex-start',
    marginTop: 6,
    lineHeight: 22,
  },
  debugBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  debugText: {
    fontSize: 12,
    marginBottom: 4,
  },
});
