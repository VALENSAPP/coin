import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Svg, {
  Defs,
  ClipPath,
  Polygon,
  Image as SvgImage,
  Text as SvgText,
} from 'react-native-svg';
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
const PRESET_AMOUNTS = [100, 200, 500, 1000];

const formatPts = value => `${(Number(value) || 0).toLocaleString('en-US')} pts`;

function extractUserArray(res) {
  if (!res) return [];
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.users)) return payload.data.users;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.data?.users)) return payload.data.data.users;
  if (Array.isArray(payload?.result?.users)) return payload.result.users;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const HexagonAvatar = ({
  uri,
  name,
  size = 40,
  borderColor = 'rgba(0,0,0,0.15)',
  bg = '#e0e0e0',
  textColor = '#333',
}) => {
  const [imgErr, setImgErr] = useState(false);
  const points = `${size / 2},0 ${size},${size / 4} ${size},${(size * 3) / 4} ${size / 2},${size} 0,${(size * 3) / 4} 0,${size / 4}`;
  const clipId = useMemo(
    () => `hex-avatar-${size}-${Math.random().toString(36).slice(2, 8)}`,
    [size],
  );
  const initial = (name || 'U')[0].toUpperCase();

  const validUri = useMemo(() => {
    if (!uri) return null;
    const str = typeof uri === 'object' && uri?.uri ? uri.uri : (typeof uri === 'string' ? uri : '');
    const trimmed = String(str || '').trim();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('file://')
    ) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) return `https://api.valens.app${trimmed}`;
    return `https://api.valens.app/${trimmed}`;
  }, [uri]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>

        {validUri && !imgErr ? (
          <SvgImage
            x="0"
            y="0"
            width={size}
            height={size}
            href={{ uri: validUri }}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            onError={() => setImgErr(true)}
          />
        ) : (
          <>
            <Polygon points={points} fill={bg} />
            <SvgText
              x={size / 2}
              y={size / 2 + size * 0.12}
              textAnchor="middle"
              fontSize={size * 0.4}
              fontWeight="700"
              fill={textColor}
            >
              {initial}
            </SvgText>
          </>
        )}
        <Polygon
          points={points}
          fill="none"
          stroke={borderColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

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
    raw?.image ||
    raw?.image_url ||
    raw?.profile_image ||
    raw?.profilePic ||
    raw?.profilePicture ||
    raw?.user_image ||
    raw?.picture ||
    item?.profileImage ||
    item?.avatar ||
    item?.image ||
    item?.image_url ||
    item?.profile_image ||
    item?.profilePic ||
    item?.profilePicture ||
    item?.user_image ||
    item?.picture ||
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
      const rows = extractUserArray(res);
      const list = rows
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

  // Search users dynamically when on 'all' tab
  useEffect(() => {
    if (activeTab !== 'all') return;

    let cancelled = false;
    const search = searchQuery.trim();

    const delayDebounce = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        let res;
        if (search) {
          res = await searchUsers(search);
        } else {
          res = await getAllUser({ limit: 50 });
        }
        if (cancelled) return;
        const rows = extractUserArray(res);
        const list = rows
          .map(shapeUser)
          .filter(u => u && u.id && u.id !== String(selfUserId));
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
    const search = searchQuery.trim().toLowerCase();
    if (activeTab === 'following') {
      if (!search) return followingList;
      return followingList.filter(u => {
        const name = (u.displayName || '').toLowerCase();
        const uname = (u.userName || '').toLowerCase();
        return name.includes(search) || uname.includes(search);
      });
    }
    return searchResults;
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

    if (!numericAmount || numericAmount < 100) {
      showToastMessage(
        toast,
        'danger',
        t('sendPointsScreen.minPointsRequired', 'Minimum 100 points required per transfer'),
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
          <HexagonAvatar
            uri={item.profileImage}
            name={item.displayName || item.userName}
            size={42}
            borderColor={softBorder}
            bg={softBg}
            textColor={text}
          />
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

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 50}
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
              <HexagonAvatar
                uri={selectedUser.profileImage}
                name={selectedUser.displayName || selectedUser.userName}
                size={46}
                borderColor={accent || softBorder}
                bg={softBg}
                textColor={text}
              />
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
                  activeTab === 'following' && [styles.tabBtnActive, { borderBottomColor: text }],
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'following' ? text : muted },
                  ]}
                >
                  {t('sendPointsScreen.followingTab', 'Following')} ({followingList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('all')}
                style={[
                  styles.tabBtn,
                  activeTab === 'all' && [styles.tabBtnActive, { borderBottomColor: text }],
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'all' ? text : muted },
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

        <Text style={[styles.hintText, { color: muted }]}>
          {t('sendPointsScreen.sendPointsHint', 'Min. 100 pts per transfer')}
        </Text>

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
          disabled={submitting || !selectedUser || numericAmount < 100 || numericAmount > totalPoints}
          style={[
            styles.ctaButton,
            { backgroundColor: cta.backgroundColor },
            (!selectedUser || numericAmount < 100 || numericAmount > totalPoints) && styles.disabledCta,
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
      </KeyboardAwareScrollView>
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
  hintText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
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
