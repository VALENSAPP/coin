import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme/useApptheme';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import HexAvatar from '../../../components/home/story.js/HexAvatar';
import {
  addPrivateCircleMembers,
  getPrivateCircleDashboard,
  isPrivateCircleApiSuccess,
  parsePrivateCircleDashboard,
  shapePrivateCircleMember,
} from '../../../services/privatecircle';
import { continuePrivateMint } from './privateCircleFlow';

const MEMBER_HEX_SIZE = 40;

export default function PrivateCircleReview() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { t } = useLanguage();
  const [profileType, setProfileType] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const mode = route.params?.mode === 'mint' ? 'mint' : 'setup';

  const routeSelectedIds = useMemo(
    () =>
      Array.isArray(route.params?.selectedIds) ? route.params.selectedIds.map(String) : [],
    [route.params?.selectedIds],
  );
  const routeSelectedMembers = useMemo(
    () => (Array.isArray(route.params?.selectedMembers) ? route.params.selectedMembers : []),
    [route.params?.selectedMembers],
  );
  const routeCircleMembers = useMemo(
    () => (Array.isArray(route.params?.members) ? route.params.members : []),
    [route.params?.members],
  );
  const routePersistedIds = useMemo(
    () =>
      Array.isArray(route.params?.persistedIds)
        ? route.params.persistedIds.map(String)
        : routeCircleMembers.map((member) => String(member.id)),
    [route.params?.persistedIds, routeCircleMembers],
  );

  // Local state so focus refresh / navigation params both stay in sync.
  const [selectedIds, setSelectedIds] = useState(routeSelectedIds);
  const [selectedMembers, setSelectedMembers] = useState(routeSelectedMembers);
  const [circleMembers, setCircleMembers] = useState(routeCircleMembers);
  const [persistedIds, setPersistedIds] = useState(routePersistedIds);

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  // Keep local state aligned when Continue updates route params.
  useEffect(() => {
    if (routeSelectedIds.length > 0) {
      setSelectedIds(routeSelectedIds);
    }
    if (routeSelectedMembers.length > 0) {
      setSelectedMembers(routeSelectedMembers);
    }
    if (routeCircleMembers.length > 0) {
      setCircleMembers(routeCircleMembers);
    }
    if (routePersistedIds.length > 0) {
      setPersistedIds(routePersistedIds);
    }
  }, [routeSelectedIds, routeSelectedMembers, routeCircleMembers, routePersistedIds]);

  const applyMembersFromApi = useCallback((membersRaw) => {
    const members = (Array.isArray(membersRaw) ? membersRaw : [])
      .map(shapePrivateCircleMember)
      .filter((member) => member.id);
    const ids = members.map((member) => String(member.id));

    setCircleMembers(members);
    setSelectedIds(ids);
    setSelectedMembers(members);
    setPersistedIds(ids);

    return { members, ids };
  }, []);

  // Fetch once per focus — do not setParams here (that retriggered focus work).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const refreshMembersFromApi = async () => {
        setLoadingMembers(true);
        try {
          const response = await getPrivateCircleDashboard();
          if (cancelled || !isPrivateCircleApiSuccess(response)) return;
          const { members } = parsePrivateCircleDashboard(response);
          applyMembersFromApi(members);
        } catch {
          // Keep whatever is already on screen if refresh fails.
        } finally {
          if (!cancelled) setLoadingMembers(false);
        }
      };

      refreshMembersFromApi();

      return () => {
        cancelled = true;
      };
    }, [applyMembersFromApi]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const actionType = event.data.action?.type;
      if (actionType === 'POP' || actionType === 'GO_BACK') {
        event.preventDefault();
        navigation.replace('PrivateCircleSelectMembers', {
          mode,
          members: circleMembers,
          selectedIds,
          selectedMembers,
          persistedIds,
          returnToReview: false,
        });
      }
    });

    return unsubscribe;
  }, [navigation, mode, circleMembers, selectedIds, selectedMembers, persistedIds]);

  const isCompanyProfile = profileType === 'company';
  const profileActionGradient = isCompanyProfile
    ? ['#C9A15a', '#C9A15a']
    : ['#513189bd', '#e54ba0'];
  const headingColor = isCompanyProfile ? '#B8954F' : '#513189';
  const { text } = useAppTheme(profileType);

  const memberCount = selectedIds.length;
  const existingMemberIdSet = useMemo(() => new Set(persistedIds), [persistedIds]);

  const openMemberPicker = () => {
    navigation.navigate({
      name: 'PrivateCircleSelectMembers',
      params: {
        mode,
        members: circleMembers,
        selectedIds,
        selectedMembers,
        persistedIds,
        returnToReview: true,
      },
      merge: true,
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
            style={styles.summaryHeader}
            activeOpacity={0.85}
            onPress={openMemberPicker}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: headingColor }]}>
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.rowTitle, { color: headingColor }]} numberOfLines={1}>
                {t('privateCircleMint.reviewMembersTitle')}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {t('privateCircleMint.reviewMembersCount', { count: memberCount })}
              </Text>
            </View>
            {loadingMembers ? (
              <ActivityIndicator size="small" color={headingColor} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            )}
          </TouchableOpacity>

          {selectedMembers.length > 0 ? (
            <View style={styles.memberList}>
              {selectedMembers.map((member, index) => (
                <View
                  key={member.id}
                  style={[
                    styles.memberRow,
                    index < selectedMembers.length - 1 && styles.memberRowDivider,
                  ]}
                >
                  <HexAvatar
                    uri={member.avatar}
                    size={MEMBER_HEX_SIZE}
                    borderWidth={2}
                    borderColor="#E5E7EB"
                  />
                  <Text style={[styles.memberName, { color: headingColor }]} numberOfLines={1}>
                    {member.username || member.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
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
  summaryHeader: {
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
  memberList: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  memberRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
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
