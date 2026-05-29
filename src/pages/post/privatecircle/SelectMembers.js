import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { following as apiFollowing } from '../../../services/profile';
import {
  addPrivateCircleMembers,
  PrivateSetup,
  removePrivateCircleMember,
  shapePrivateCircleMember,
  isPrivateCircleApiSuccess,
} from '../../../services/privatecircle';
import { hideLoader, showLoader } from '../../../redux/actions/LoaderAction';
import { useAppTheme } from '../../../theme/useApptheme';
import { useLanguage } from '../../../i18n';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import HexAvatar from '../../../components/home/story.js/HexAvatar';
import { buildSelectedMembers } from './privateCircleFlow';

export default function PrivateCircleSelectMembers() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const toast = useToast();
  const [profileType, setProfileType] = useState('');

  const mode = route.params?.mode === 'mint' ? 'mint' : 'setup';
  const returnToReview = route.params?.returnToReview === true;
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
    return mode === 'mint' ? initialMembers.map((m) => m.id) : [];
  });
  const [search, setSearch] = useState('');
  const [loadingPool, setLoadingPool] = useState(true);
  const [saving, setSaving] = useState(false);
  const [persistedIds, setPersistedIds] = useState(() => initialMembers.map((m) => String(m.id)));
  const [removingIds, setRemovingIds] = useState([]);
  const [addingIds, setAddingIds] = useState([]);

  const { text } = useAppTheme(profileType);
  const { t } = useLanguage();

  const isCompanyProfile = profileType === 'company';
  const profileActionGradient = isCompanyProfile
    ? ['#D3B683', '#D3B683']
    : ['#513189bd', '#e54ba0'];
  const headingColor = isCompanyProfile ? '#B8954F' : '#513189';

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  const loadPool = useCallback(async () => {
    setLoadingPool(true);
    try {
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
      const merged = [...initialMembers, ...users].reduce((acc, user) => {
        if (!user?.id) return acc;
        if (!acc.some((u) => String(u.id) === String(user.id))) {
          acc.push(user);
        }
        return acc;
      }, []);
      setPoolMembers(merged);
    } catch {
      showToastMessage(toast, 'danger', t('privateCircleMint.loadMembersError'));
      setPoolMembers(initialMembers);
    } finally {
      setLoadingPool(false);
    }
  }, [mode, initialMembers, t, toast]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return poolMembers;
    return poolMembers.filter((m) => m.username.toLowerCase().includes(q));
  }, [poolMembers, search]);

  const persistedMemberIdSet = useMemo(() => new Set(persistedIds), [persistedIds]);

  const toggleMember = async (id) => {
    const normalized = String(id);
    const isSelected = selectedIds.includes(normalized);

    if (!isSelected) {
      if (returnToReview && !persistedMemberIdSet.has(normalized)) {
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

    if (mode === 'setup') {
      setSaving(true);
      dispatch(showLoader());
      try {
        const setupRes = await PrivateSetup();
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
        <HexAvatar uri={item.avatar} size={52} borderWidth={2} borderColor="#E5E7EB" />
        <Text style={[styles.rowName, { color: headingColor }]} numberOfLines={1}>
          {item.username}
        </Text>
        <View style={[styles.rowCheck, isSelected && { backgroundColor: text || headingColor }]}>
          {isBusy ? (
            <ActivityIndicator size="small" color={headingColor} />
          ) : (
            isSelected && <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={headingColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: headingColor }]}>
          {t('privateCircleMint.pickerTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.searchWrap, { borderColor: '#E5E7EB' }]}>
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('privateCircleMint.searchPlaceholder')}
          placeholderTextColor="#999"
          style={[styles.searchInput, { color: headingColor }]}
        />
      </View>

      {loadingPool ? (
        <ActivityIndicator style={styles.loader} size="large" color={text} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: headingColor }]}>
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
            { backgroundColor: text || headingColor, opacity: selectedIds.length === 0 ? 0.5 : 1 },
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
    borderColor: '#D1D5DB',
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
