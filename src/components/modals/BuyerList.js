import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import { getUserCredentials } from '../../services/post';
import { getAllUser } from '../../services/users';
import { normalizeProfileType } from '../../utils/supportEligibility';
import { useLanguage } from '../../i18n';

const normalizeString = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const normalizeUsername = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^@+/, '');

const getAccentColorForProfileType = (value) =>
  normalizeProfileType(value) === 'user' ? '#5a2d82' : '#D3B683';

export default function BuyersListModal({
  visible,
  onClose,
  buyers = [],
  users,
  profileType,
  onUserPress,
  title,
  enableSearch = true,
  searchPlaceholder,
  emptyTitle,
  emptyText,
  showChevron = true,
}) {
  const sheetRef = useRef(null);
  const navigation = useNavigation();
  const { bgStyle, textStyle, cardStyle } = useAppTheme();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const listUsers = users || buyers;
  const userCacheRef = useRef(new Map());
  const pendingUserLookupRef = useRef(new Set());
  const [, forceRefresh] = useState(0);

  // fall back to translated placeholder if none passed as prop
  const resolvedSearchPlaceholder = searchPlaceholder || t('buyersList.searchPlaceholder');

  const getCacheKeys = useCallback((item) => {
    const idCandidate =
      item?.id ??
      item?.userId ??
      item?.UserId ??
      item?._id ??
      item?.user?.id ??
      item?.user?._id;
    const usernameCandidate = normalizeUsername(
      item?.username ?? item?.userName ?? item?.user?.username ?? item?.user?.userName,
    );

    return {
      idKey: idCandidate ? `id:${String(idCandidate).trim()}` : null,
      usernameKey: usernameCandidate ? `username:${usernameCandidate.toLowerCase()}` : null,
    };
  }, []);

  const readCachedUser = useCallback((item) => {
    const { idKey, usernameKey } = getCacheKeys(item);
    return (
      (idKey ? userCacheRef.current.get(idKey) : null) ||
      (usernameKey ? userCacheRef.current.get(usernameKey) : null) ||
      null
    );
  }, [getCacheKeys]);

  const writeCachedUser = useCallback((item) => {
    const { idKey, usernameKey } = getCacheKeys(item);
    const cachedUser = {
      id:
        item?.id ??
        item?.userId ??
        item?.UserId ??
        item?._id ??
        item?.user?.id ??
        item?.user?._id,
      username:
        item?.userName ||
        item?.username ||
        item?.user?.userName ||
        item?.user?.username ||
        '',
      fullName:
        item?.fullName ||
        item?.name ||
        item?.displayName ||
        item?.user?.fullName ||
        item?.user?.name ||
        '',
      avatar:
        item?.image ||
        item?.avatar ||
        item?.userImage ||
        item?.profilePicture ||
        item?.user?.image ||
        item?.user?.avatar ||
        null,
      profile: item?.profile || item?.user?.profile || 'user',
    };

    if (idKey) {
      userCacheRef.current.set(idKey, cachedUser);
    }
    if (usernameKey) {
      userCacheRef.current.set(usernameKey, cachedUser);
    }
  }, [getCacheKeys]);

  const resolveUserId = useCallback((item) => {
    const idCandidate =
      item?.id ??
      item?.userId ??
      item?.UserId ??
      item?._id ??
      item?.user?.id ??
      item?.user?._id;

    if (idCandidate === undefined || idCandidate === null) return null;
    const asString = String(idCandidate).trim();
    if (asString.startsWith('tagged-')) return null;
    return asString ? asString : null;
  }, []);

  const resolveProfileUserIdFromUsername = useCallback(async (incomingUsername) => {
    const cleanUsername = normalizeUsername(incomingUsername);
    if (!cleanUsername) return null;

    const normalizedUsername = cleanUsername.toLowerCase();
    const cacheKey = `username:${normalizedUsername}`;
    const cached = userCacheRef.current.get(cacheKey);
    if (cached?.id) return String(cached.id);

    try {
      const response = await getAllUser({ userName: cleanUsername });
      const usersPayload = response?.data?.users ?? [];
      const exactMatch = usersPayload.find((candidateUser) =>
        String(candidateUser?.userName || candidateUser?.username || '').toLowerCase() === normalizedUsername
      );
      const matchedUser = exactMatch || usersPayload[0];
      const resolvedId = matchedUser?.id || matchedUser?._id || matchedUser?.userId || null;

      if (resolvedId) {
        writeCachedUser({
          ...matchedUser,
          id: String(resolvedId),
          username: matchedUser?.userName || matchedUser?.username || cleanUsername,
        });
        forceRefresh((tick) => tick + 1);
      }

      return resolvedId ? String(resolvedId) : null;
    } catch (e) {
      return null;
    }
  }, [writeCachedUser]);

  useEffect(() => {
    if (!visible) return;

    (listUsers || []).forEach(async (entry) => {
      const cached = readCachedUser(entry);
      if (cached?.profile && cached?.avatar && cached?.fullName) return;

      const resolvedUserId =
        resolveUserId(entry) || await resolveProfileUserIdFromUsername(entry?.username);
      if (!resolvedUserId) return;

      const pendingKey = `profile:${resolvedUserId}`;
      if (pendingUserLookupRef.current.has(pendingKey)) return;
      pendingUserLookupRef.current.add(pendingKey);

      try {
        const res = await getUserCredentials(String(resolvedUserId));
        const resolvedUser = res?.data?.user || res?.data?.data?.user || res?.data || entry;
        writeCachedUser({
          ...resolvedUser,
          id: String(resolvedUserId),
          username: resolvedUser?.userName || resolvedUser?.username || entry?.username,
        });
        forceRefresh((tick) => tick + 1);
      } catch (e) {
        // ignore and keep fallback row data
      } finally {
        pendingUserLookupRef.current.delete(pendingKey);
      }
    });
  }, [listUsers, readCachedUser, resolveProfileUserIdFromUsername, resolveUserId, visible, writeCachedUser]);

  const handleDefaultNavigateToProfile = useCallback(async (item) => {
    const initialUserId = resolveUserId(item);
    const resolvedUserId = initialUserId || await resolveProfileUserIdFromUsername(item?.username);
    if (!resolvedUserId) return;

    sheetRef.current?.close();
    onClose?.();

    let resolvedUser = item;
    try {
      const res = await getUserCredentials(String(resolvedUserId));
      resolvedUser = res?.data?.user || res?.data?.data?.user || res?.data || item;
    } catch (e) {
      resolvedUser = item;
    }

    const cacheKey = normalizeUsername(item?.username || resolvedUser?.userName || resolvedUser?.username);
    if (cacheKey) {
      writeCachedUser({
        ...resolvedUser,
        id: String(resolvedUserId),
        username: resolvedUser?.userName || resolvedUser?.username || cacheKey,
      });
      forceRefresh((tick) => tick + 1);
    }

    const params = {
      userId: String(resolvedUserId),
      user: resolvedUser,
    };

    setTimeout(() => {
      const parent = navigation.getParent?.();
      if (parent) {
        parent.navigate('HomeMain', {
          screen: 'UsersProfile',
          params,
        });
        return;
      }
      navigation.navigate('UsersProfile', params);
    }, 150);
  }, [navigation, onClose, resolveProfileUserIdFromUsername, resolveUserId, writeCachedUser]);

  useEffect(() => {
    if (visible) sheetRef.current?.open();
    else sheetRef.current?.close();
  }, [visible]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const normalizedProfileType = useMemo(
    () => normalizeProfileType(profileType),
    [profileType],
  );

  const accentColor = normalizedProfileType === 'user' ? '#5a2d82' : '#D3B683';

  const resolvedTitle =
    title ||
    (normalizedProfileType === 'user'
      ? t('buyersList.followedBy')
      : t('buyersList.supportedBy'));

  const filteredUsers = useMemo(() => {
    const q = normalizeString(query);
    if (!q || !enableSearch) return listUsers;

    return listUsers.filter((user) => {
      const username = normalizeString(user?.username);
      const fullName = normalizeString(user?.fullName);
      return username.includes(q) || fullName.includes(q);
    });
  }, [enableSearch, listUsers, query]);

  const renderItem = ({ item }) => {
    const cleanUsername = normalizeUsername(item?.username);
    const cached = readCachedUser(item);
    const enrichedItem = cached ? { ...item, ...cached } : item;

    const username = enrichedItem?.username || '—';
    const fullName = enrichedItem?.fullName || '';
    const avatarUri = enrichedItem?.avatar;
    const itemAccentColor = getAccentColorForProfileType(
      enrichedItem?.profile || item?.profile || profileType,
    );
    const userId = resolveUserId(enrichedItem);
    const canPress = onUserPress
      ? !!(enrichedItem?.id || enrichedItem?.username || userId)
      : !!(userId || cleanUsername);

    return (
      <Pressable
        style={({ pressed }) => [styles.row, canPress && pressed && styles.rowPressed]}
        onPress={() => {
          if (!canPress) return;
          if (onUserPress) {
            onUserPress(enrichedItem?.id || enrichedItem?.username || userId, enrichedItem);
            return;
          }
          handleDefaultNavigateToProfile(enrichedItem);
        }}
        disabled={!canPress}
      >
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {String(username).trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: itemAccentColor }]} numberOfLines={1}>
            {username}
          </Text>
          {!!fullName && (
            <Text style={styles.subText} numberOfLines={1}>
              {fullName}
            </Text>
          )}
        </View>

        {showChevron && canPress ? (
          <Feather name="chevron-right" size={18} color="#9ca3af" />
        ) : null}
      </Pressable>
    );
  };

  return (
    <RBSheet
      ref={sheetRef}
      draggable
      height={520}
      onClose={onClose}
      closeOnPressMask
      closeOnPressBack
      customModalProps={{ statusBarTranslucent: true }}
      customStyles={{
        container: [styles.sheetContainer, bgStyle],
        wrapper: styles.wrapper,
        draggableIcon: styles.draggableIcon,
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: accentColor }]}>{resolvedTitle}</Text>
          <Text style={styles.countText}>
            {filteredUsers.length}{' '}
            {filteredUsers.length === 1
              ? t('buyersList.userSingular')
              : t('buyersList.userPlural')}
          </Text>

          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Feather name="x" size={20} color="#9ca3af" />
          </Pressable>
        </View>

        {enableSearch ? (
          <View style={[styles.searchWrap, cardStyle]}>
            <Feather name="search" size={16} color="#9ca3af" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={resolvedSearchPlaceholder}
              placeholderTextColor="#9ca3af"
              style={[styles.searchInput, textStyle]}
              returnKeyType="search"
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearBtn}>
                <Feather name="x-circle" size={18} color="#9ca3af" />
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.divider} />

        <FlatList
          data={filteredUsers}
          keyExtractor={(item, index) => String(item?.id ?? item?.username ?? index)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, textStyle]}>
                {query
                  ? t('buyersList.noMatches')
                  : (emptyTitle || t('buyersList.noUsersYet'))}
              </Text>
              <Text style={styles.emptyText}>
                {query
                  ? t('buyersList.tryDifferentSearch')
                  : (emptyText || t('buyersList.beFirst'))}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={renderItem}
        />
      </View>
    </RBSheet>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetContainer: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -6 },
      },
      android: {
        elevation: 18,
      },
    }),
  },
  draggableIcon: {
    width: 56,
    backgroundColor: '#d1d5db',
  },
  container: {
    flex: 1,
    paddingTop: 6,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  countText: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    right: 12,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156,163,175,0.12)',
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(156,163,175,0.25)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(229,231,235,0.9)',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.65,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(229,231,235,0.7)',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#eef2ff',
    marginRight: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '800',
    // color: '#111827',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
  },
  subText: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
