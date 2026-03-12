import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAppTheme } from '../../theme/useApptheme';

const normalizeString = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export default function BuyersListModal({
  visible,
  onClose,
  buyers = [],
  users,
  profileType = 'user',
  onUserPress,
  title,
  enableSearch = true,
  searchPlaceholder = 'Search buyers',
  emptyTitle,
  emptyText,
  showChevron = true,
}) {
  const sheetRef = useRef(null);
  const { bgStyle, textStyle, cardStyle } = useAppTheme();
  const [query, setQuery] = useState('');
  const listUsers = users || buyers;

  useEffect(() => {
    if (visible) sheetRef.current?.open();
    else sheetRef.current?.close();
  }, [visible]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const resolvedTitle = title || (profileType === 'user' ? 'Followed by' : 'Supported by');

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
    const username = item?.username || '—';
    const fullName = item?.fullName || '';
    const avatarUri = item?.avatar;
    const canPress = !!onUserPress && !!(item?.id || item?.username);

    return (
      <Pressable
        style={({ pressed }) => [styles.row, canPress && pressed && styles.rowPressed]}
        onPress={() => {
          if (!canPress) return;
          onUserPress(item?.id || item?.username, item);
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
          <Text style={[styles.username, textStyle]} numberOfLines={1}>
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
          <Text style={[styles.title, textStyle]}>{resolvedTitle}</Text>
          <Text style={styles.countText}>
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
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
              placeholder={searchPlaceholder}
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
                {query ? 'No matches' : (emptyTitle || 'No users yet')}
              </Text>
              <Text style={styles.emptyText}>
                {query ? 'Try a different search.' : (emptyText || 'Be the first to support this post.')}
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
    color: '#111827',
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
