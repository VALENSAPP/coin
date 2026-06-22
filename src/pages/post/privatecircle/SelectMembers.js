import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { following as apiFollowing } from '../../../services/profile';
import {
  addPrivateCircleMembers,
  getPrivateCircleDashboard,
  parsePrivateCircleDashboard,
  privateSetup,
  removePrivateCircleMember,
  shapePrivateCircleMember,
  isPrivateCircleApiSuccess,
} from '../../../services/privatecircle';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useAppTheme } from '../../../theme/useApptheme';
import { useThemeContext } from '../../../theme/ThemeContext';
import { useLanguage } from '../../../i18n';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import HexAvatar from '../../../components/home/story.js/HexAvatar';
import { buildSelectedMembers } from './privateCircleFlow';

const mergeMembersById = (lists) =>
  lists.flat().reduce((acc, user) => {
    if (!user?.id) return acc;
    if (!acc.some((u) => String(u.id) === String(user.id))) {
      acc.push(user);
    }
    return acc;
  }, []);

export default function PrivateCircleSelectMembers() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const toast = useToast();
  const [profileType, setProfileType] = useState('');

  const rawMode = route.params?.mode;
  const mode = rawMode === 'mint' || rawMode === 'manage' ? rawMode : 'setup';
  const returnToReview = route.params?.returnToReview === true;
  const returnToWalletPrivateCircle = route.params?.returnToWalletPrivateCircle === true;
  const initialMembers = useMemo(
    () => (Array.isArray(route.params?.members) ? route.params.members : []).map(shapePrivateCircleMember),
    [route.params?.members],
  );
  const circleMembers = initialMembers;

  const [poolMembers, setPoolMembers] = useState(initialMembers);
  const [selectedIds, setSelectedIds] = useState(() => {
    if (Array.isArray(route.params?.selectedIds) && route.params.selectedIds.length > 0) {
      return route.params.selectedIds.map(String);
    }
    return mode === 'mint' || mode === 'manage' ? initialMembers.map((m) => m.id) : [];
  });
  const [search, setSearch] = useState('');
  const [loadingPool, setLoadingPool] = useState(true);
  const [saving, setSaving] = useState(false);
  const routePersistedIds = useMemo(() => {
    if (!Array.isArray(route.params?.persistedIds)) return null;
    return route.params.persistedIds.map(String).filter(Boolean);
  }, [route.params?.persistedIds]);
  const [persistedIds, setPersistedIds] = useState(() => {
    if (routePersistedIds?.length) return routePersistedIds;
    return initialMembers.map((m) => String(m.id));
  });
  const [removingIds, setRemovingIds] = useState([]);
  const [addingIds, setAddingIds] = useState([]);

  const { bgStyle, textStyle, cardStyle, accent, mutedText, border, icon } = useAppTheme(profileType);
  const { isDarkMode } = useThemeContext();
  const { t } = useLanguage();

  const isCompanyProfile = profileType === 'company';
  const profileActionGradient = isCompanyProfile
    ? ['#C9A15a', '#C9A15a']
    : ['#513189bd', '#e54ba0'];
  const headingColor = isDarkMode ? accent : (isCompanyProfile ? '#B8954F' : '#513189');

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  const loadPool = useCallback(async () => {
    setLoadingPool(true);
    try {
      let persistedMembers = initialMembers;
      const shouldSyncFromApi =
        (mode === 'manage' || returnToWalletPrivateCircle) && !returnToReview;

      if (shouldSyncFromApi) {
        const dashRes = await getPrivateCircleDashboard();
        if (isPrivateCircleApiSuccess(dashRes)) {
          const { members } = parsePrivateCircleDashboard(dashRes);
          persistedMembers = (Array.isArray(members) ? members : [])
            .map(shapePrivateCircleMember)
            .filter((member) => member.id);
          const ids = persistedMembers.map((member) => String(member.id));
          setPersistedIds(ids);
          setSelectedIds(ids);
        } else {
          setPersistedIds([]);
          setSelectedIds([]);
          persistedMembers = [];
        }
      } else if (returnToReview) {
        const reviewSelectedIds = Array.isArray(route.params?.selectedIds)
          ? route.params.selectedIds.map(String).filter(Boolean)
          : [];
        if (reviewSelectedIds.length > 0) {
          setSelectedIds(reviewSelectedIds);
        }
        if (routePersistedIds?.length) {
          setPersistedIds(routePersistedIds);
        } else {
          setPersistedIds(initialMembers.map((member) => String(member.id)));
        }
        persistedMembers = initialMembers;
      } else if (routePersistedIds?.length) {
        setPersistedIds(routePersistedIds);
      }

      const selfUserId = await AsyncStorage.getItem('userId');
      let users = [];
      if (selfUserId) {
        const res = await apiFollowing(selfUserId);
        const rows = res?.data?.data ?? res?.data ?? [];
        users = rows
          .map((rel) => rel?.following || rel?.user || rel || null)
          .filter(Boolean)
          .map(shapePrivateCircleMember)
          .filter((u) => u.id);
      }

      setPoolMembers(mergeMembersById([persistedMembers, initialMembers, users]));
    } catch {
      showToastMessage(toast, 'danger', t('privateCircleMint.loadMembersError'));
      setPoolMembers(initialMembers);
    } finally {
      setLoadingPool(false);
    }
  }, [
    initialMembers,
    mode,
    returnToReview,
    returnToWalletPrivateCircle,
    route.params?.selectedIds,
    routePersistedIds,
    t,
    toast,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadPool();
    }, [loadPool]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return poolMembers;
    return poolMembers.filter((m) => m.username.toLowerCase().includes(q));
  }, [poolMembers, search]);

  const persistedMemberIdSet = useMemo(() => new Set(persistedIds), [persistedIds]);

  const goBackToWalletPrivateCircle = useCallback(() => {
    const parentNavigation = navigation.getParent?.() || navigation;
    parentNavigation.navigate('wallet', {
      screen: 'Privatecircle',
      params: {
        skipPrivateCircleApi: true,
        privateCircleRefreshAt: Date.now(),
      },
    });
  }, [navigation]);

  const goBackToReview = useCallback(() => {
    navigation.replace('PrivateCircleReview', {
      mode,
      members: circleMembers,
      selectedIds,
      selectedMembers: buildSelectedMembers(selectedIds, poolMembers),
      persistedIds,
      returnToReview: true,
    });
  }, [navigation, mode, circleMembers, selectedIds, poolMembers, persistedIds]);

  useEffect(() => {
    if (!returnToReview) return;

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const actionType = event.data.action?.type;
      if (actionType === 'POP' || actionType === 'GO_BACK') {
        event.preventDefault();
        goBackToReview();
      }
    });

    return unsubscribe;
  }, [navigation, returnToReview, goBackToReview]);

  const toggleMember = async (id) => {
    const normalized = String(id);
    const isSelected = selectedIds.includes(normalized);

    if (!isSelected) {
      if ((returnToReview || returnToWalletPrivateCircle) && !persistedMemberIdSet.has(normalized)) {
        if (addingIds.includes(normalized)) return;
        setAddingIds((prev) => [...prev, normalized]);
        try {
          const response = await addPrivateCircleMembers([normalized]);
          if (!isPrivateCircleApiSuccess(response)) {
            showToastMessage(
              toast,
              'danger',
              response?.message || t('privateCircleMint.saveMembersError'),
            );
            return;
          }
          setPersistedIds((prev) => [...prev, normalized]);
          setSelectedIds((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
        } catch (e) {
          showToastMessage(
            toast,
            'danger',
            e?.response?.data?.message || e?.message || t('privateCircleMint.saveMembersError'),
          );
        } finally {
          setAddingIds((prev) => prev.filter((x) => x !== normalized));
        }
        return;
      }
      setSelectedIds((prev) => [...prev, normalized]);
      return;
    }

    const isPersistedMember = persistedMemberIdSet.has(normalized);
    if (!isPersistedMember) {
      setSelectedIds((prev) => prev.filter((x) => x !== normalized));
      return;
    }

    if (removingIds.includes(normalized)) return;

    setRemovingIds((prev) => [...prev, normalized]);
    try {
      const response = await removePrivateCircleMember(normalized);
      console.log(response, "remove member response=>>>>>>>>>>>>>>");
      if (!isPrivateCircleApiSuccess(response)) {
        showToastMessage(
          toast,
          'danger',
          response?.data?.message || t('privateCircleMint.saveMembersError'),
        );
        return;
      }
      setSelectedIds((prev) => prev.filter((x) => x !== normalized));
      setPersistedIds((prev) => prev.filter((x) => x !== normalized));
    } catch (e) {
      showToastMessage(
        toast,
        'danger',
        e?.response?.data?.message || e?.message || t('privateCircleMint.saveMembersError'),
      );
    } finally {
      setRemovingIds((prev) => prev.filter((x) => x !== normalized));
    }
  };

  const goToReview = (ids, membersAlreadySaved = false) => {
    navigation.replace('PrivateCircleReview', {
      mode,
      members: circleMembers,
      selectedIds: ids,
      selectedMembers: buildSelectedMembers(ids, poolMembers),
      persistedIds,
      membersAlreadySaved,
    });
  };

  const handleContinue = async () => {
    if (selectedIds.length === 0) {
      showToastMessage(toast, 'danger', t('privateCircleMint.selectAtLeastOne'));
      return;
    }

    if (returnToReview) {
      goToReview(selectedIds);
      return;
    }

    if (returnToWalletPrivateCircle) {
      goBackToWalletPrivateCircle();
      return;
    }

    if (mode === 'setup') {
      setSaving(true);
      dispatch(showLoader());
      try {
        const setupRes = await privateSetup();
        if (!isPrivateCircleApiSuccess(setupRes)) {
          showToastMessage(
            toast,
            'danger',
            setupRes?.data?.message || t('privateCircleMint.setupError'),
          );
          return;
        }

        const response = await addPrivateCircleMembers(selectedIds);
        console.log(response, "add members response=>>>>>>>>>>>>>>");
        if (!isPrivateCircleApiSuccess(response)) {
          showToastMessage(
            toast,
            'danger',
            response?.data?.message || t('privateCircleMint.saveMembersError'),
          );
          return;
        }
        goToReview(selectedIds, true);
      } catch (e) {
        showToastMessage(
          toast,
          'danger',
          e?.response?.data?.message || e?.message || t('privateCircleMint.saveMembersError'),
        );
      } finally {
        setSaving(false);
        dispatch(hideLoader());
      }
      return;
    }

    goToReview(selectedIds);
  };

  const renderRow = ({ item }) => {
    const normalizedId = String(item.id);
    const isSelected = selectedIds.includes(normalizedId);
    const isRemoving = removingIds.includes(normalizedId);
    const isAdding = addingIds.includes(normalizedId);
    const isBusy = isRemoving || isAdding;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() => toggleMember(normalizedId)}
        disabled={isBusy}
      >
        <HexAvatar uri={item.avatar} size={52} borderWidth={2} borderColor={border} />
        <Text style={[styles.rowName, textStyle]} numberOfLines={1}>
          {item.username}
        </Text>
        <View style={[styles.rowCheck, { borderColor: border }, isSelected && { backgroundColor: accent, borderColor: accent }]}>
          {isBusy ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            isSelected && <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (returnToWalletPrivateCircle) {
              goBackToWalletPrivateCircle();
              return;
            }
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>
          {t('privateCircleMint.pickerTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.searchWrap, cardStyle, { borderColor: border }]}>
        <Ionicons name="search" size={18} color={mutedText} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('privateCircleMint.searchPlaceholder')}
          placeholderTextColor={mutedText}
          style={[styles.searchInput, textStyle]}
        />
      </View>

      {loadingPool ? (
        <ActivityIndicator style={styles.loader} size="large" color={accent} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: mutedText }]}>
              {t('privateCircleMint.noMembersFound')}
            </Text>
          }
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={saving || selectedIds.length === 0}
          onPress={handleContinue}
          style={[
            styles.primaryBtnWrap,
            { opacity: selectedIds.length === 0 ? 0.5 : 1 },
          ]}
        >
          <LinearGradient
            colors={profileActionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {t('privateCircleMint.continueButton', { count: selectedIds.length })}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  rowCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
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
