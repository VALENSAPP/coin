import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppTheme } from '../../theme/useApptheme';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useLanguage } from '../../i18n';

const { width } = Dimensions.get('window');

export default function InviteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { bgStyle } = useAppTheme();
  const { t } = useLanguage();

  const userReferralCode = route?.params?.referralCode;

  const copyReferralCode = () => {
    Clipboard.setString(userReferralCode);
    Alert.alert(t('invite.copiedTitle'), t('invite.copiedReferralMessage'));
  };

  const deepLinkQr = `https://api.valens.app/callback`;
  const deepLinkUrl = 'https://api.valens.app/callback';

  const avatar = route?.params?.avatar;

  const qrSize = Math.min(width * 0.72, 320);
  const innerPadding = 14;
  const innerSize = qrSize + innerPadding;
  const avatarSize = 56;
  const avatarPos = (innerSize / 2) - (avatarSize / 2);

  const onShare = async () => {
    try {
      await Share.share({
        message: `${t('invite.shareMessage')} ${userReferralCode}\n\n${deepLinkUrl}`,
        title: t('invite.shareTitle'),
      });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

const onCopyLink = () => {
  const inviteMessage = `${t('invite.shareMessage')} ${userReferralCode}\n\n${deepLinkUrl}`;

  Clipboard.setString(inviteMessage);

  Alert.alert(
    t('invite.copiedTitle'),
    t('invite.copiedReferralMessage')
  );
};

  return (
    <SafeAreaView style={[styles.safe, bgStyle]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('invite.headerTitle')}</Text>
          <View style={{ width: 26 }} />
        </View>

        <Text style={styles.subtitle}>
          {t('invite.subtitle')}{' '}
          <Text style={{ fontWeight: '700' }}>{t('invite.learnMore')}</Text>
        </Text>

        {/* QR with pastel gradient border */}
        <View style={{ height: 18 }} />

        <LinearGradient
          colors={['#FAD9B6', '#C6F6D9', '#BEE8FF', '#F1C9F2']}
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
                borderColor="#5a2d82"
              />
            </View>
          </View>
        </LinearGradient>

        {/* Share row */}
        <View style={{ height: 22 }} />
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareButton} onPress={onShare} activeOpacity={0.85}>
            <Text style={styles.shareText}>{t('invite.shareYourLink')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, bgStyle]} onPress={onCopyLink} activeOpacity={0.85}>
            <Ionicons name="link-outline" size={22} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Bottom section */}
        <View style={{ height: 28 }} />
        <Text style={styles.sectionTitle}>{t('invite.yourInvites')}</Text>
        <Text style={styles.sectionSubtitle}>{t('invite.yourInvitesSubtitle')}</Text>

        {/* Referral code box */}
        <View style={styles.debugBox}>
          <View style={styles.referralRow}>
            <Text style={styles.debugText}>
              {t('invite.referralCodeLabel')} {userReferralCode}
            </Text>
            <TouchableOpacity onPress={copyReferralCode}>
              <Ionicons name="copy-outline" size={18} color="#333" />
            </TouchableOpacity>
          </View>
          {/* <Text style={styles.debugText}>{t('invite.deepLinkLabel')} {deepLinkUrl}</Text> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safe: { flex: 1, marginTop: 20 },
    container: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
    },

    backBtn: {
        position: 'absolute',
        // left: 16,
        // top: 27,
        zIndex: 10,
    },

    title: {
        // marginTop: 6,
        fontSize: 26,
        fontWeight: '700',
        textAlign: 'center',
        width: '85%',
        left: 10,
        color: '#111',
    },
    subtitle: {
        marginTop: 10,
        textAlign: 'center',
        color: '#666',
        lineHeight: 22,
        paddingHorizontal: 6,
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
        backgroundColor: '#111',
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
        color: '#111',
    },
    sectionSubtitle: {
        alignSelf: 'flex-start',
        color: '#777',
        marginTop: 6,
        lineHeight: 22,
    },

    debugBox: {
        marginTop: 20,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        width: '100%',
    },
    debugText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
});
