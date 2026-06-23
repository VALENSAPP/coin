import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme/useApptheme';
import { useThemeContext } from '../../../theme/ThemeContext';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import PrivateCircleHexMember from './PrivateCircleHexMember';
import { goToPrivateCircleReview } from './privateCircleFlow';

const HEX_SIZE = 72;
const HEX_GAP = 5;
const HEX_ROW_GAP = 5;

/** Demo faces for the intro screen only — not used for real member data. */
const STATIC_HEX_AVATARS = [
  'https://i.pravatar.cc/200?img=12',
  'https://i.pravatar.cc/200?img=32',
  'https://i.pravatar.cc/200?img=47',
  'https://i.pravatar.cc/200?img=68',
  'https://i.pravatar.cc/200?img=15',
];

export default function PrivateCircleSelectAccess() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { t } = useLanguage();
  const [profileType, setProfileType] = useState('');

  const mode = route.params?.mode === 'mint' ? 'mint' : 'setup';
  const circleMembers = Array.isArray(route.params?.members) ? route.params.members : [];

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  const isCompanyProfile = profileType === 'company';
  const { bgStyle, textStyle, accent, mutedText, icon } = useAppTheme(profileType);
  const { isDarkMode } = useThemeContext();
  const profileActionGradient = isCompanyProfile
    ? ['#C9A15a', '#C9A15a']
    : ['#513189bd', '#e54ba0'];
  const headingColor = isDarkMode ? accent : (isCompanyProfile ? '#B8954F' : '#513189');
  const bodyTextColor = mutedText;

  const goToReview = () => {
    goToPrivateCircleReview(navigation, {
      mode,
      members: circleMembers,
      selectedIds: [],
      selectedMembers: [],
    });
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>
          {t('privateCircleMint.welcomeTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        <View style={styles.contentInner}>
          <View style={styles.hexCluster}>
            <View style={styles.hexRow}>
              {STATIC_HEX_AVATARS.slice(0, 3).map((uri, index) => (
                <View key={`static-top-${index}`} style={styles.hexSlot}>
                  <PrivateCircleHexMember
                    member={{ id: String(index), avatar: uri }}
                    size={HEX_SIZE}
                    selected
                    accentColor={headingColor}
                  />
                </View>
              ))}
            </View>
            <View style={[styles.hexRow, styles.hexRowBottom]}>
              {STATIC_HEX_AVATARS.slice(3, 5).map((uri, index) => (
                <View key={`static-bottom-${index}`} style={styles.hexSlot}>
                  <PrivateCircleHexMember
                    member={{ id: String(index + 3), avatar: uri }}
                    size={HEX_SIZE}
                    selected
                    accentColor={headingColor}
                  />
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.accessHeading, { color: headingColor }]}>
            {t('privateCircleMint.selectAccessPrefix')}
            <Text style={[styles.accessHeadingEmphasis, { color: headingColor }]}>{t('privateCircleMint.selectAccessWho')}</Text>
            {t('privateCircleMint.selectAccessSuffix')}
          </Text>

          <Text style={[styles.accessBody, { color: bodyTextColor }]}>
            {t('privateCircleMint.selectAccessBody')}
          </Text>

          <Text style={[styles.accessFootnote, { color: bodyTextColor }]}>
            {t('privateCircleMint.selectAccessFootnote')}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={goToReview}
          style={styles.primaryBtnWrap}
        >
          <LinearGradient
            colors={profileActionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>{t('privateCircleMint.selectPeopleButton')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.85}
          onPress={() => {
            showToastMessage(toast, 'info', t('privateCircleMint.importContactsSoon'));
          }}
        >
          <Text style={[styles.secondaryBtnText, { color: headingColor }]}>
            {t('privateCircleMint.importContactsButton')}
          </Text>
        </TouchableOpacity> */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentInner: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  hexCluster: {
    alignItems: 'center',
    marginBottom: 32,
  },
  hexRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: HEX_GAP,
  },
  hexRowBottom: {
    marginTop: HEX_ROW_GAP,
    gap: HEX_GAP + 12,
    paddingHorizontal: HEX_SIZE * 0.55,
  },
  hexSlot: {
    marginHorizontal: 6,
  },
  accessHeading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  accessHeadingEmphasis: {
    fontWeight: '700',
  },
  accessBody: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  accessFootnote: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.75,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    gap: 10,
  },
  primaryBtnWrap: {
    overflow: 'hidden',
    borderRadius: 18,
  },
  primaryBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
