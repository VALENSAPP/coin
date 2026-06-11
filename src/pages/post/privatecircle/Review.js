import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme/useApptheme';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
// import PrivateCircleStepper from './PrivateCircleStepper';
import HexAvatar from '../../../components/home/story.js/HexAvatar';
import { addPrivateCircleMembers, isPrivateCircleApiSuccess } from '../../../services/privatecircle';
import { continuePrivateMint } from './privateCircleFlow';

const PREVIEW_HEX_SIZE = 34;
const PREVIEW_HEX_LIMIT = 5;

export default function PrivateCircleReview() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { t } = useLanguage();
  const [profileType, setProfileType] = useState('');
  const [saving, setSaving] = useState(false);

  const mode = route.params?.mode === 'mint' ? 'mint' : 'setup';
  const circleMembers = Array.isArray(route.params?.members) ? route.params.members : [];
  const selectedIds = Array.isArray(route.params?.selectedIds)
    ? route.params.selectedIds.map(String)
    : [];
  const selectedMembers = Array.isArray(route.params?.selectedMembers)
    ? route.params.selectedMembers
    : [];
  const persistedIds = Array.isArray(route.params?.persistedIds)
    ? route.params.persistedIds.map(String)
    : circleMembers.map((member) => String(member.id));

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  const isCompanyProfile = profileType === 'company';
  const profileActionGradient = isCompanyProfile
    ? ['#D3B683', '#D3B683']
    : ['#513189bd', '#e54ba0'];
  const headingColor = isCompanyProfile ? '#B8954F' : '#513189';
  const { text } = useAppTheme(profileType);

  const memberCount = selectedIds.length;
  const previewMembers = useMemo(
    () => selectedMembers.slice(0, PREVIEW_HEX_LIMIT),
    [selectedMembers],
  );
  const extraMemberCount = Math.max(0, memberCount - PREVIEW_HEX_LIMIT);
  const existingMemberIdSet = useMemo(() => new Set(persistedIds), [persistedIds]);

  const openMemberPicker = () => {
    navigation.navigate('PrivateCircleSelectMembers', {
      mode,
      members: circleMembers,
      selectedIds,
      selectedMembers,
      persistedIds,
      returnToReview: true,
    });
  };

  const handleLooksGood = async () => {
    if (memberCount === 0) {
      showToastMessage(toast, 'danger', t('privateCircleMint.selectAtLeastOne'));
      openMemberPicker();
      return;
    }

    if (mode === 'mint') {
      setSaving(true);
      try {
        const additionalIds = selectedIds.filter((id) => !existingMemberIdSet.has(String(id)));
        if (additionalIds.length > 0) {
          const response = await addPrivateCircleMembers(additionalIds);
          if (!isPrivateCircleApiSuccess(response)) {
            showToastMessage(
              toast,
              'danger',
              response?.message || t('privateCircleMint.saveMembersError'),
            );
            return;
          }
        }
        continuePrivateMint(navigation, selectedIds);
      } catch (e) {
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || e?.message || t('privateCircleMint.saveMembersError'),
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    navigation.replace('PrivateCircleCreating', {
      mode,
      selectedIds,
      membersAlreadySaved: route.params?.membersAlreadySaved === true,
    });
  };

  const memberHexPreview = (
    <View style={styles.hexPreviewRow}>
      {previewMembers.map((member, index) => (
        <View
          key={member.id}
          style={[styles.hexPreviewSlot, index > 0 && styles.hexPreviewOverlap]}
        >
          <HexAvatar
            uri={member.avatar}
            size={PREVIEW_HEX_SIZE}
            borderWidth={2}
            borderColor="#FFFFFF"
          />
        </View>
      ))}
      {extraMemberCount > 0 && (
        <Text style={[styles.hexPreviewMore, { color: headingColor }]}>
          {t('privateCircleMint.reviewMembersMore', { count: extraMemberCount })}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={headingColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: headingColor }]}>
          {t('privateCircleMint.welcomeTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* <PrivateCircleStepper currentStep={3} accentColor={headingColor} /> */}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: headingColor }]}>
          {t('privateCircleMint.reviewSummaryTitle')}
        </Text>

        <View style={styles.summaryCard}>
          <TouchableOpacity
            style={styles.summaryRow}
            activeOpacity={0.85}
            onPress={openMemberPicker}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: headingColor }]}>
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.rowTitle, { color: headingColor }]}>
                {t('privateCircleMint.reviewMembersTitle')}
              </Text>
              <Text style={styles.rowSubtitle}>
                {t('privateCircleMint.reviewMembersCount', { count: memberCount })}
              </Text>
            </View>
            {memberCount > 0 ? memberHexPreview : null}
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={saving}
          onPress={handleLooksGood}
          style={[
            styles.primaryBtnWrap,
            { backgroundColor: text || headingColor, opacity: saving ? 0.75 : 1 },
          ]}
        >
          <LinearGradient
            colors={profileActionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'mint'
                  ? t('privateCircleMint.reviewContinue')
                  : t('privateCircleMint.reviewLooksGood')}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  hexPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: 130,
  },
  hexPreviewSlot: {
    zIndex: 1,
  },
  hexPreviewOverlap: {
    marginLeft: -10,
  },
  hexPreviewMore: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
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
});
