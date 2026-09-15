import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { showToastMessage } from '../../components/displaytoastmessage';
import { totalPoints as fetchTotalPoints, sendPlatformPoints } from '../../services/wallet';
import { following as apiFollowing } from '../../services/profile';
import { getAllUser, searchUsers } from '../../services/users';
import { parseTotalPlatformPointsPayload } from '../../utils/platformPoints';
import { primaryCtaColors, contrastOn } from '../../utils/ctaContrast';
import { SoftGrayDragonfly } from '../../assets/icons';

const H_PADDING = 16;
const PRESET_AMOUNTS = [50, 100, 200, 500];

const formatPts = value => `${(Number(value) || 0).toLocaleString('en-US')} pts`;

function shapeUser(item) {
  if (!item) return null;
  const raw = item?.following || item?.user || item;
  const id = raw?.id || raw?._id || raw?.userId || item?.id || item?._id || item?.userId || '';
  if (!id) return null;

  const userName =
    raw?.userName ||
    raw?.username ||
    raw?.name ||
    item?.userName ||
    item?.username ||
    item?.name ||
    '';

  const displayName =
    raw?.displayName ||
    raw?.fullName ||
    raw?.name ||
    raw?.userName ||
    raw?.username ||
    item?.displayName ||
    item?.fullName ||
    item?.name ||
    item?.userName ||
    item?.username ||
    'User';

  const profileImage =
    raw?.profileImage ||
    raw?.avatar ||
    raw?.image_url ||
    raw?.profile_image ||
    item?.profileImage ||
    item?.avatar ||
    item?.image_url ||
    item?.profile_image ||
    '';

  return { id: String(id), userName, displayName, profileImage };
}

const SendPointsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const toast = useToast();

  const profileType = String(route?.params?.profileType || '').toLowerCase();
  const { bgStyle, textStyle, text, card, accent } = useAppTheme(
    profileType === 'company' || profileType === 'user' ? profileType : undefined,
  );

  const [totalPoints, setTotalPoints] = useState(
    Number(route?.params?.totalPoints) || 0,
  );
  const [selfUserId, setSelfUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('following'); // 'following' | 'all'
  const [followingList, setFollowingList] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const muted = `${text}99`;
  const softBg = `${text}12`;
  const softBorder = `${text}18`;
  const cta = primaryCtaColors(accent);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => {
      if (id) setSelfUserId(String(id));
    });
  }, []);

  const refreshPoints = useCallback(async () => {
    try {
      const response = await fetchTotalPoints();
      const parsed = parseTotalPlatformPointsPayload(response);
      setTotalPoints(parsed.totalPlatformPoints);
    } catch (error) {
      console.log('SendPointsScreen refreshPoints error:', error);
    }
  }, []);

  const loadFollowingUsers = useCallback(async (currentUserId) => {
    if (!currentUserId) return;
    setLoadingUsers(true);
    try {
      const res = await apiFollowing(currentUserId);
      const rows = res?.data?.data ?? res?.data ?? [];
      const list = (Array.isArray(rows) ? rows : [])
        .map(shapeUser)
        .filter(u => u && u.id && u.id !== String(currentUserId));
      setFollowingList(list);
    } catch (error) {
      console.log('SendPointsScreen loadFollowing error:', error);
      setFollowingList([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPoints();
      if (selfUserId) {
        loadFollowingUsers(selfUserId);
      }
    }, [refreshPoints, selfUserId, loadFollowingUsers]),
  );

  // Search users dynamically when query changes or when on 'all' tab
  useEffect(() => {
    let cancelled = false;
    const search = searchQuery.trim();

    if (!search && activeTab === 'following') {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        let res;
        if (search) {
          res = await searchUsers(search);
        } else {
          res = await getAllUser({ limit: 20 });
        }
        if (cancelled) return;
        const rows = res?.data?.data ?? res?.data ?? [];
        const list = (Array.isArray(rows) ? rows : [])
          .map(shapeUser)
          .filter(u => u && u.id && u.id !== selfUserId);
        setSearchResults(list);
      } catch (err) {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }, search ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(delayDebounce);
    };
  }, [searchQuery, activeTab, selfUserId]);

  const displayUsersList = useMemo(() => {
    if (searchQuery.trim() || activeTab === 'all') {
      return searchResults;
    }
    return followingList;
  }, [searchQuery, activeTab, followingList, searchResults]);

  const handleSelectUser = useCallback((user) => {
    setSelectedUser(user);
  }, []);

  const handlePresetAmount = (val) => {
    setAmount(String(val));
  };

  const handleMaxAmount = () => {
    setAmount(String(totalPoints));
  };

  const numericAmount = Number(amount) || 0;

  const handleSendPoints = async () => {
    if (!selectedUser) {
      showToastMessage(
        toast,
        'danger',
        t('sendPointsScreen.selectUserRequired', 'Please select a recipient user'),
      );
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      showToastMessage(
        toast,
        'danger',
        t('sendPointsScreen.invalidAmount', 'Please enter a valid amount'),
      );
      return;
    }

    if (numericAmount > totalPoints) {
      showToastMessage(
        toast,
        'danger',
        t('sendPointsScreen.insufficientPoints', 'Insufficient platform points balance'),
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        recipientId: selectedUser.id,
        recipientUserName: selectedUser.userName || selectedUser.displayName,
        amount: numericAmount,
        note: note.trim(),
      };

      const res = await sendPlatformPoints(payload);
      console.log('Send points response:', res);

      if (res?.error || res?.success === false || res?.statusCode >= 400) {
        const msg = res?.message || t('sendPointsScreen.failedMessage', 'Failed to send points');
        showToastMessage(toast, 'danger', msg);
      } else {
        showToastMessage(
          toast,
          'success',
          t('sendPointsScreen.successMessage', 'Points sent successfully!'),
        );
        refreshPoints();
        setAmount('');
        setNote('');
        setSelectedUser(null);
        navigation.goBack();
      }
    } catch (error) {
      console.log('sendPlatformPoints error:', error);
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        t('sendPointsScreen.failedMessage', 'Failed to send points');
      showToastMessage(toast, 'danger', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderUserItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        onPress={() => handleSelectUser(item)}
        style={[styles.userRow, { borderBottomColor: softBorder }]}
      >
        <View style={styles.avatarBox}>
          {item.profileImage ? (
            <Image source={{ uri: item.profileImage }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: softBg }]}>
              <Text style={[styles.avatarInitial, { color: text }]}>
                {(item.displayName || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfoCol}>
          <Text style={[styles.userName, textStyle]} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.userName ? (
            <Text style={[styles.userHandle, { color: muted }]} numberOfLines={1}>
              @{item.userName}
            </Text>
          ) : null}
        </View>
        <View style={[styles.selectChip, { backgroundColor: softBg }]}>
          <Text style={[styles.selectChipText, { color: text }]}>
            {t('sendPointsScreen.selectBtn', 'Select')}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [handleSelectUser, softBorder, softBg, text, textStyle, muted, t],
  );

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]} numberOfLines={1}>
          {t('sendPointsScreen.title', 'Send Points')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Available Points Hero Banner */}
        <View style={[styles.heroCard, { backgroundColor: card, shadowColor: text }]}>
          <SoftGrayDragonfly width={44} height={44} style={styles.heroDragonfly} />
          <View style={[styles.heroHex, { borderColor: text }]}>
            <View style={[styles.heroHexInner, { backgroundColor: text }]}>
              <Text style={[styles.heroHexText, { color: contrastOn(text) }]}>P</Text>
            </View>
          </View>
          <View style={styles.heroTextCol}>
            <Text style={[styles.heroLabel, { color: muted }]}>
              {t('useYourPointsScreen.availablePoints', 'Your Available Points')}
            </Text>
            <Text style={[styles.heroValue, { color: text }]}>{formatPts(totalPoints)}</Text>
          </View>
        </View>

        {/* Selected Recipient Pill OR User Picker Section */}
        <Text style={[styles.sectionTitle, textStyle]}>
          {t('sendPointsScreen.recipientLabel', 'Recipient')}
        </Text>

        {selectedUser ? (
          <View style={[styles.selectedUserCard, { backgroundColor: card, borderColor: accent }]}>
            <View style={styles.avatarBox}>
              {selectedUser.profileImage ? (
                <Image source={{ uri: selectedUser.profileImage }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: softBg }]}>
                  <Text style={[styles.avatarInitial, { color: text }]}>
                    {(selectedUser.displayName || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.userInfoCol}>
              <Text style={[styles.userName, textStyle]} numberOfLines={1}>
                {selectedUser.displayName}
              </Text>
              {selectedUser.userName ? (
                <Text style={[styles.userHandle, { color: muted }]} numberOfLines={1}>
                  @{selectedUser.userName}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedUser(null)}
              style={[styles.changeBtn, { backgroundColor: softBg }]}
            >
              <Text style={[styles.changeBtnText, { color: text }]}>
                {t('sendPointsScreen.changeUser', 'Change')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.userPickerContainer, { backgroundColor: card, borderColor: softBorder }]}>
            {/* Search Input */}
            <View style={[styles.searchBar, { backgroundColor: softBg }]}>
              <Ionicons name="search-outline" size={20} color={muted} style={styles.searchIcon} />
              <TextInput
                placeholder={t('sendPointsScreen.searchPlaceholder', 'Search by name or username...')}
                placeholderTextColor={muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: text }]}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('following')}
                style={[
                  styles.tabBtn,
                  activeTab === 'following' && !searchQuery && [styles.tabBtnActive, { borderBottomColor: text }],
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'following' && !searchQuery ? text : muted },
                  ]}
                >
                  {t('sendPointsScreen.followingTab', 'Following')} ({followingList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('all')}
                style={[
                  styles.tabBtn,
                  (activeTab === 'all' || !!searchQuery) && [styles.tabBtnActive, { borderBottomColor: text }],
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'all' || !!searchQuery ? text : muted },
                  ]}
                >
                  {t('sendPointsScreen.allUsersTab', 'All Users')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Users List with FlatList */}
            {loadingUsers ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={accent || text} />
              </View>
            ) : displayUsersList.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyText, { color: muted }]}>
                  {t('sendPointsScreen.noUsersFound', 'No users found')}
                </Text>
              </View>
            ) : (
              <View style={styles.usersFlatListContainer}>
                <FlatList
                  data={displayUsersList}
                  keyExtractor={item => item.id}
                  renderItem={renderUserItem}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  style={styles.usersFlatList}
                />
              </View>
            )}
          </View>
        )}

        {/* Amount Input Section */}
        <Text style={[styles.sectionTitle, textStyle, styles.marginTopSection]}>
          {t('sendPointsScreen.amountLabel', 'Amount (Points)')}
        </Text>

        <View style={[styles.inputCard, { backgroundColor: card, borderColor: softBorder }]}>
          <View style={styles.amountInputRow}>
            <View style={[styles.ptsIconBox, { backgroundColor: text }]}>
              <Text style={[styles.ptsIconText, { color: contrastOn(text) }]}>P</Text>
            </View>
            <TextInput
              placeholder="0"
              placeholderTextColor={muted}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              style={[styles.amountInput, { color: text }]}
            />
            <Text style={[styles.ptsUnit, { color: muted }]}>pts</Text>
          </View>

          {/* Quick Preset Amount Chips */}
          <View style={styles.presetsRow}>
            {PRESET_AMOUNTS.map(preset => (
              <TouchableOpacity
                key={preset}
                onPress={() => handlePresetAmount(preset)}
                style={[
                  styles.presetChip,
                  { backgroundColor: softBg },
                  amount === String(preset) && { backgroundColor: text },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: amount === String(preset) ? contrastOn(text) : text },
                  ]}
                >
                  +{preset}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={handleMaxAmount}
              style={[
                styles.presetChip,
                { backgroundColor: softBg },
                amount === String(totalPoints) && { backgroundColor: text },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  { color: amount === String(totalPoints) ? contrastOn(text) : text },
                ]}
              >
                MAX
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Note Input Section */}
        <Text style={[styles.sectionTitle, textStyle, styles.marginTopSection]}>
          {t('sendPointsScreen.noteLabel', 'Note (Optional)')}
        </Text>

        <View style={[styles.inputCard, { backgroundColor: card, borderColor: softBorder }]}>
          <TextInput
            placeholder={t(
              'sendPointsScreen.notePlaceholder',
              'Thanks for the great content!',
            )}
            placeholderTextColor={muted}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            style={[styles.noteInput, { color: text }]}
          />
        </View>

        {/* Submit CTA Button */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleSendPoints}
          disabled={submitting || !selectedUser || numericAmount <= 0 || numericAmount > totalPoints}
          style={[
            styles.ctaButton,
            { backgroundColor: cta.backgroundColor },
            (!selectedUser || numericAmount <= 0 || numericAmount > totalPoints) && styles.disabledCta,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={cta.color} />
          ) : (
            <>
              <MaterialCommunityIcons
                name="send-outline"
                size={20}
                color={cta.color}
                style={styles.ctaIcon}
              />
              <Text style={[styles.ctaText, { color: cta.color }]}>
                {numericAmount > 0
                  ? `${t('sendPointsScreen.sendCta', 'Send')} ${formatPts(numericAmount)}`
                  : t('sendPointsScreen.sendCta', 'Send Points')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: H_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingBottom: Platform.OS === 'ios' ? 46 : 38,
  },
  heroCard: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  heroDragonfly: {
    position: 'absolute',
    top: 8,
    right: 10,
    opacity: 0.25,
  },
  heroHex: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroHexInner: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHexText: { fontWeight: '800', fontSize: 16 },
  heroTextCol: { flex: 1 },
  heroLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  heroValue: { fontSize: 24, fontWeight: '800' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  marginTopSection: {
    marginTop: 22,
  },
  selectedUserCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userPickerContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
  },
  searchBar: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 10,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 8,
  },
  tabBtnActive: {
    borderBottomWidth: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  usersFlatListContainer: {
    height: 220,
    overflow: 'hidden',
  },
  usersFlatList: {
    flex: 1,
  },
  userRow: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatarBox: {
    marginRight: 12,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
  },
  userInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userHandle: {
    fontSize: 12,
    marginTop: 2,
  },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  selectChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ptsIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ptsIconText: {
    fontWeight: '800',
    fontSize: 14,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    padding: 0,
  },
  ptsUnit: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noteInput: {
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  ctaButton: {
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  disabledCta: {
    opacity: 0.5,
  },
  ctaIcon: {
    marginRight: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default SendPointsScreen;
