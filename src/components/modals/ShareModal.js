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
import Share from 'react-native-share';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppTheme } from '../../theme/useApptheme';
import { getSocket, initializeSocket } from '../../services/socket';
import { useLanguage } from '../../i18n';

const { width, height: screenHeight } = Dimensions.get('window');
const COLS = 3;
const CELL_W = Math.floor(width / COLS);
const AVATAR_SIZE = 64;
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const cleanStoryId = value => String(value || '').replace(/_\d+$/, '');

const ShareModal = forwardRef(({ post, postId, reel, reelId, story, onClose, onShare }, ref) => {
  const [selfUserId, setSelfUserId] = useState(null);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState('');
  const { bg, text, card, border, mutedText, accent, icon, bgStyle } = useAppTheme();
  const { t } = useLanguage();

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
      Alert.alert(
        t('shareModal.shareErrorTitle'),
        e?.response?.data?.message || t('shareModal.loadFollowingError'),
      );
    } finally {
      setLoading(false);
    }
  }, [selfUserId, shapeUser, t]);

  const onOpen = () => {
    setSelectedUsers([]);
    setSearch('');
    loadFollowing();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return following;
    return following.filter(u => u.username.toLowerCase().includes(q));
  }, [following, search]);

  const toggleSelectUser = (user) => {
    const userId = String(user.id);
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId],
    );
  };

  const resolvePostId = () => {
    if (postId) return String(postId);
    if (reelId) return String(reelId);

    if (story) {
      if (typeof story === 'string' || typeof story === 'number') return String(story);
      if (story.id) return String(story.id);
      if (story._id) return String(story._id);
    }

    if (post) {
      if (typeof post === 'string' || typeof post === 'number') return String(post);
      if (post.id) return String(post.id);
      if (post.post?.id) return String(post.post.id);
    }

    if (reel) {
      if (typeof reel === 'string' || typeof reel === 'number') return String(reel);
      if (reel.id) return String(reel.id);
      if (reel.reel?.id) return String(reel.reel.id);
    }

    return null;
  };

  const resolveStoryId = () => {
    if (!story) return null;
    if (typeof story === 'string' || typeof story === 'number') return cleanStoryId(story);
    return cleanStoryId(
      story.storyId || story.id || story._id || story.story?.id || story.story?._id || '',
    ) || null;
  };

  const resolveStoryLinkId = () => {
    if (!story) return null;
    if (typeof story === 'string' || typeof story === 'number') return cleanStoryId(story);
    const raw = story.storyId || story.id || story._id || story.story?.id || story.story?._id || '';
    return cleanStoryId(raw) || null;
  };

  const directSendToInbox = useCallback(async (sharedContent) => {
    try {
      let mediaType, mediaId;
      if (sharedContent.post) {
        mediaType = 'POST';
        mediaId = sharedContent.postId;
      } else if (sharedContent.reel) {
        mediaType = 'REEL';
        mediaId = sharedContent.reelId;
      } else if (sharedContent.story) {
        mediaType = 'STORY';
        mediaId = sharedContent.storyId;
        if (mediaId) mediaId = String(mediaId).replace(/_\d+$/, '');
      }

      if (mediaType && mediaId) {
        await sharePost({
          mediaId,
          mediaType,
          conversationType: 'MEDIA',
          sharedUserId: String(selfUserId),
          receiverUserId: selectedUsers,
        });
      }

      let socket = getSocket();
      if (!socket?.connected) {
        try {
          socket = await initializeSocket(String(selfUserId));
        } catch (_) {
          socket = getSocket();
        }
      }

      const messageType = sharedContent.post ? 'POST_SHARE'
        : sharedContent.reel ? 'REEL_SHARE'
          : sharedContent.story ? 'STORY_SHARE'
            : 'MEDIA';

      for (let i = 0; i < selectedUsers.length; i++) {
        const receiverId = String(selectedUsers[i]);
        const messageData = {
          senderId: String(selfUserId),
          receiverId,
          type: messageType,
        };

        if (sharedContent.postId) messageData.postId = sharedContent.postId;
        if (sharedContent.reelId) messageData.reelId = sharedContent.reelId;
        if (sharedContent.storyId) {
          messageData.storyId = String(sharedContent.storyId).replace(/_\d+$/, '');
        }

        if (socket?.connected) socket.emit('sendMessage', messageData);
      }
    } catch (e) {
      Alert.alert(
        t('shareModal.shareErrorTitle'),
        e?.response?.data?.message || t('shareModal.shareErrorMessage'),
      );
    }
  }, [selfUserId, selectedUsers, t]);

  const handleSend = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert(t('shareModal.noSelectionTitle'), t('shareModal.noSelectionMessage'));
      return;
    }

    if (!selfUserId) {
      Alert.alert(t('shareModal.notLoggedInTitle'), t('shareModal.notLoggedInMessage'));
      return;
    }

    setSending(true);

    try {
      const sharedContent = {
        post,
        postId: resolvePostId(),
        reel,
        reelId,
        story,
        storyId: resolveStoryId(),
      };

      if (ref?.current) ref.current.close();
      setSelectedUsers([]);
      directSendToInbox(sharedContent);
    } catch (e) {
      Alert.alert(
        t('shareModal.shareErrorTitle'),
        e?.response?.data?.message || t('shareModal.shareErrorMessage'),
      );
    } finally {
      setSending(false);
    }
  };

  const generateShareLink = () => {
    const id = story ? resolveStoryLinkId() : resolvePostId();
    if (!id) return null;

    if (story) {
      return `https://api.valens.app/storyshare/${encodeURIComponent(String(id))}`;
    }
    if (reel || reelId) {
      return `https://api.valens.app/reelshare/${encodeURIComponent(String(id))}`;
    }
    return `https://api.valens.app/postshare/${encodeURIComponent(String(id))}`;
  };

  const generateShareText = () => {
    const link = generateShareLink();
    if (!link) return null;

    if (story || reel || reelId) return link;

    const sharedPost = post?.post || post;
    const parsedGoal = Number(sharedPost?.raiseAmount);
    const isMissionPost = Number.isFinite(parsedGoal) && parsedGoal > 0;

    if (!isMissionPost) return t('postView.copyPostText', { link });

    const username = sharedPost?.userName ?? sharedPost?.username ?? '';
    return t('postView.copyMissionText', { username, link });
  };

  const shareToWhatsApp = async () => {
    const message = generateShareText();
    if (!message) return Alert.alert(t('shareModal.invalidLinkTitle'), t('shareModal.invalidLinkMessage'));
    try {
      await Share.open({ message, social: Share.Social.WHATSAPP });
    } catch (err) {
      console.log('WhatsApp share error:', err);
    }
  };

  const copyToClipboard = () => {
    const message = generateShareText();
    if (!message) return;
    Clipboard.setString(message);
    Alert.alert(t('shareModal.copiedTitle'), t('shareModal.copiedMessage'));
  };

  const shareToSystem = async () => {
    const message = generateShareText();
    if (!message) return Alert.alert(t('shareModal.invalidLinkTitle'), t('shareModal.invalidLinkMessage'));
    try {
      await Share.open({ message });
    } catch (err) {
      console.log('System share error:', err);
    }
  };

  const renderUserCell = ({ item }) => {
    const isSelected = selectedUsers.includes(String(item.id));
    return (
      <TouchableOpacity
        style={styles.cell}
        activeOpacity={0.8}
        onPress={() => toggleSelectUser(item)}
      >
        <View style={styles.avatarWrap}>
          <Image source={{ uri: item.avatar || DEFAULT_AVATAR }} style={styles.avatar} />
          {isSelected && (
            <View style={styles.tickOverlay}>
              <Ionicons name="checkmark-circle" size={28} color={text} />
            </View>
          )}
        </View>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.usernameText, { color: text }]}>
            {item.username}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const sendCount = selectedUsers.length;

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
          backgroundColor: mutedText,
          width: 50, height: 5, borderRadius: 3, marginTop: 6,
        },
        container: {
          backgroundColor: bg,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingTop: 6,
          paddingBottom: 0,
        },
      }}
    >
      {/* Search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 }}>
        <View style={[styles.searchBar, { backgroundColor: card, borderWidth: 1, borderColor: border }]}>
          <Ionicons name="search" size={18} color={mutedText} />
          <TextInput
            placeholder={t('shareModal.searchPlaceholder')}
            placeholderTextColor={mutedText}
            style={[styles.searchInput, { color: text }]}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={[styles.smallIconBtn, { backgroundColor: card, borderColor: border, borderWidth: 1 }]} activeOpacity={0.7}>
          <Ionicons name="people-outline" size={18} color={icon} />
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
            keyExtractor={it => it.id}
            renderItem={renderUserCell}
            numColumns={COLS}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', paddingTop: 24 }}>
                <Text style={{ color: mutedText }}>
                  {t('shareModal.noFollowingFound')}
                </Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Bottom actions */}
      {sendCount > 0 ? (
        <View style={[styles.sendBar, bgStyle, { borderTopColor: border }]}>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: accent }, sending && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleSend}
            disabled={sending || sendCount === 0}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>
                {sendCount > 1
                  ? t('shareModal.sendButton_other', { count: sendCount })
                  : t('shareModal.sendButton_one', { count: sendCount })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.bottomBar, bgStyle, { borderTopColor: border }]}>
          <Action icon="share-social-outline" label={t('shareModal.shareToLabel')} onPress={shareToSystem} iconColor={icon} labelColor={text} />
          <Action icon="copy-outline" label={t('shareModal.copyLinkLabel')} onPress={copyToClipboard} iconColor={icon} labelColor={text} />
          {/* <Action icon="logo-whatsapp" label={t('shareModal.whatsappLabel')} onPress={shareToWhatsApp} iconColor={icon} labelColor={text} /> */}
        </View>
      )}
    </RBSheet>
  );
});

const Action = ({ icon, onPress, label, iconColor = '#222', labelColor = '#222' }) => (
  <TouchableOpacity style={styles.actionItem} activeOpacity={0.85} onPress={onPress}>
    <Ionicons name={icon} size={22} color={iconColor} />
    <Text numberOfLines={1} style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    width: '90%',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
  smallIconBtn: {
    width: 30, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },

  gridArea: { flex: 1 },
  cell: { width: CELL_W, alignItems: 'center', paddingVertical: 12 },
  avatarWrap: {
    width: AVATAR_SIZE + 16,
    height: AVATAR_SIZE + 16,
    borderRadius: (AVATAR_SIZE + 16) / 2,
    overflow: 'visible',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
  },
  nameRow: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', maxWidth: CELL_W - 18,
  },
  usernameText: { fontSize: 13 },

  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10, paddingHorizontal: 6,
    flexDirection: 'row', justifyContent: 'space-around',
  },
  actionItem: { alignItems: 'center', width: 70 },
  actionLabel: { marginTop: 6, fontSize: 11 },

  tickOverlay: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  sendBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12, alignItems: 'center',
  },
  sendButton: {
    borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10, width: '90%',
    bottom: 5
  },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center' },
});

export default ShareModal;
