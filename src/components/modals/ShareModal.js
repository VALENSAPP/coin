// src/components/ShareModal.js
import React, { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { following as apiFollowing } from '../../services/profile';
import { sharePost } from '../../services/post';

const { width, height: screenHeight } = Dimensions.get('window');
const COLS = 3;
const CELL_W = Math.floor(width / COLS);
const AVATAR_SIZE = 64;
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const ShareModal = forwardRef(( post, ref) => {
  const [selfUserId, setSelfUserId] = useState(null);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      setSelfUserId(id ? String(id) : null);
    })();
  }, []);

  const shapeUser = useCallback(u => ({
    id: String(u?.id ?? u?._id ?? u?.userId ?? ''),
    username: u?.displayName || u?.userName || u?.username || 'unknown',
    avatar: u?.image || u?.avatar || DEFAULT_AVATAR,
  }), []);

  const loadFollowing = useCallback(async () => {
    if (!selfUserId) return;
    setLoading(true);
    try {
      const res = await apiFollowing(selfUserId);
      const rows = res?.data?.data ?? res?.data ?? [];
      const users = rows
        .map(rel => rel?.following || rel?.user || rel || null)
        .filter(Boolean)
        .map(shapeUser);
      setFollowing(users);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to load following list');
    } finally {
      setLoading(false);
    }
  }, [selfUserId, shapeUser]);

  // Load the list when the sheet opens
  const onOpen = () => {
    setSelectedUsers([]);
    setSearch('');
    loadFollowing();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return following;
    return following.filter(
      u => u.username.toLowerCase().includes(q)
    );
  }, [following, search]);

  const toggleSelectUser = (id) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSend = async () => {
    console.log("checkToken",post.post.id)
    if (!post) {
        Alert.alert('Missing post', 'No postId provided to ShareModal.');
        return;
    }
    console.log("checkToken11")
    if (!selfUserId) {
        Alert.alert('Not logged in', 'Please log in again.');
        return;
    }
    console.log("checkToken1222")
    if (selectedUsers.length === 0) return;

    setSending(true);
    try {
      const results = await Promise.allSettled(
        selectedUsers.map(receiverId =>
          sharePost({
            postId: String(post.post.id),
            sharedUserId: String(selfUserId),
            receiverUserId: String(receiverId),
          })
        )
      );
       console.log(results,'check Result')
      const ok = results.filter(r => r.status === 'fulfilled').length;
      const fail = results.length - ok;

    //   if (ok > 0) {
    //     Alert.alert('Shared', `Post sent to ${ok} user${ok > 1 ? 's' : ''}${fail ? ` (${fail} failed)` : ''}.`);
    //   } else {
    //     Alert.alert('Failed', 'Could not share the post.');
    //   }

      // Close and reset
      setSelectedUsers([]);
      if (ref?.current) ref.current.close();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Share failed.');
    } finally {
      setSending(false);
    }
  };

  const renderUserCell = ({ item }) => {
    const isSelected = selectedUsers.includes(item.id);
    return (
      <TouchableOpacity
        style={styles.cell}
        activeOpacity={0.8}
        onPress={() => toggleSelectUser(item.id)}
      >
        <View style={styles.avatarWrap}>
          <Image source={{ uri: item.avatar || DEFAULT_AVATAR }} style={styles.avatar} />
          {isSelected && (
            <View style={styles.tickOverlay}>
              <Ionicons name="checkmark-circle" size={26} color="#4CAF50" />
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.usernameText}>
            {item.username}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <RBSheet
      ref={ref}
      height={screenHeight * 0.7}
      draggable
      dragOnContent
      onOpen={onOpen}
      customModalProps={{ statusBarTranslucent: true }}
      customStyles={{
        wrapper: { backgroundColor: 'rgba(0,0,0,0.35)' },
        draggableIcon: {
          backgroundColor: '#cfcfcf',
          width: 50, height: 5, borderRadius: 3, marginTop: 6,
        },
        container: {
          backgroundColor: '#fff',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingTop: 6,
          paddingBottom: 0,
        },
      }}
    >
      {/* Search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 }}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9a9a9a" />
          <TextInput
            placeholder="Search"
            placeholderTextColor="#9a9a9a"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.7}>
          <Ionicons name="people-outline" size={18} color="#444" />
        </TouchableOpacity>
      </View>

      {/* Grid list */}
      <View style={styles.gridArea}>
        {loading ? (
          <View style={{ paddingTop: 24, alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(it) => it.id}
            renderItem={renderUserCell}
            numColumns={COLS}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', paddingTop: 24 }}>
                <Text style={{ color: '#777' }}>No following users found</Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Bottom actions */}
      {selectedUsers.length > 0 ? (
        <View style={styles.sendBar}>
          <TouchableOpacity
            style={[styles.sendButton, sending && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send ({selectedUsers.length})</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <Action icon="share-social-outline" label="Share to" />
          <Action icon="copy-outline" label="Copy link" />
          <Action icon="logo-whatsapp" label="WhatsApp" />
        </View>
      )}
    </RBSheet>
  );
});

const Action = ({ icon, label }) => (
  <TouchableOpacity style={styles.actionItem} activeOpacity={0.85}>
    <Ionicons name={icon} size={22} color="#222" />
    <Text numberOfLines={1} style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    width: '90%',
    borderRadius: 10,
    backgroundColor: '#f3f3f4',
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
  smallIconBtn: {
    width: 30, height: 40, borderRadius: 10,
    backgroundColor: '#ededed', alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },

  gridArea: { flex: 1 },
  cell: { width: CELL_W, alignItems: 'center', paddingVertical: 12 },
  avatarWrap: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden', position: 'relative', backgroundColor: '#eee',
  },
  avatar: { width: '100%', height: '100%' },
  nameRow: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', maxWidth: CELL_W - 18,
  },
  usernameText: { color: '#111', fontSize: 13 },

  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e9e9e9',
    backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 6,
    flexDirection: 'row', justifyContent: 'space-around',
  },
  actionItem: { alignItems: 'center', width: 70 },
  actionLabel: { marginTop: 6, fontSize: 11, color: '#222' },

  tickOverlay: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'white', borderRadius: 13 },

  sendBar: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e9e9e9',
    backgroundColor: '#fff', padding: 12, alignItems: 'center',
  },
  sendButton: {
    backgroundColor: '#4c2a88ab', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, width: '100%',
  },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center' },
});

export default ShareModal;
