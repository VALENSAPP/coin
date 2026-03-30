import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Modal,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { getAllNotifactions, readNotification } from '../../services/notifications';
import { useDispatch } from 'react-redux';
const { width } = Dimensions.get('window');

const normalizeNotificationType = (type) => String(type || '').toLowerCase().trim();

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
};

const extractPostIdFromNotification = (item) => {
  const data = item?.data || {};
  return pickFirstString(
    data.postId,
    data.post_id,
    data.postID,
    data.post?.id,
    data.post?._id,
    data.post?.postId,
    item?.postId,
    item?.post_id,
    item?.postID
  );
};

const extractPostImageFromNotification = (item) => {
  const data = item?.data || {};
  const post = data.post || item?.post || {};
  const images = Array.isArray(post.images) ? post.images : [];
  const firstImage = images[0];
  const firstImageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;

  return pickFirstString(
    data.postImage,
    data.post_image,
    data.thumbnail,
    data.postThumbnail,
    data.postPreview,
    post.thumbnail,
    post.previewImage,
    post.image,
    post.mediaUrl,
    post.mediaURL,
    firstImageUrl
  );
};

const extractAvatarFromNotification = (item) => {
  const data = item?.data || {};
  return pickFirstString(
    item?.avatar,
    item?.profileImage,
    data.avatar,
    data.userAvatar,
    data.followerAvatar,
    data.actorAvatar,
    data.sender?.avatar,
    data.sender?.profileImage,
    data.user?.avatar,
    data.user?.profileImage
  );
};

const isFollowType = (type) => normalizeNotificationType(type).includes('follow');
const isCommentType = (type) => normalizeNotificationType(type).includes('comment');
const isLikeType = (type) => normalizeNotificationType(type).includes('like');
const isPostActivityType = (type) => isLikeType(type) || isCommentType(type);

export default function Notifications() {
  const [activeTab, setActiveTab] = useState('all');
  const scrollViewRef = useRef(null);
  const tabScrollRef = useRef(null);
  const dispatch = useDispatch();

  const currentIndexRef = useRef(0);
  const { bgStyle, textStyle, text } = useAppTheme();

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Track loading state
  const [popupVisible, setPopupVisible] = useState(false);
  const [SelectedNotification, setSelectedNotification] = useState(null);

  const navigation = useNavigation();

  const tabs = [
    { key: 'all', label: 'All' },
    // { key: 'trades', label: 'Trades' },
    // { key: 'comments', label: 'Comments' },
    // { key: 'follows', label: 'Follows' }
  ];

  const getNotificationIcon = (type) => {
    const normalizedType = normalizeNotificationType(type);
    if (normalizedType.includes('follow')) return '👥';
    if (normalizedType.includes('comment')) return '💬';
    if (normalizedType.includes('like')) return '❤️';
    switch (normalizedType) {
      case 'mint': return '🎨';
      case 'sale': return '💰';
      case 'trade': return '🔄';
      case 'bid': return '🏷️';
      case 'token_purchase': return '💎';
      default: return '🔔';
    }
  };

  useFocusEffect(
    useCallback(() => {
      getNotification();
    }, [])
  );

  const getNotification = async () => {
    try {
      setIsLoading(true);
      const response = await getAllNotifactions();
      console.log(response, 'notification is working');
      const rawPayload =
        response?.notifications ??
        response?.data?.notifications ??
        response?.data ??
        response ??
        [];
      const raw = Array.isArray(rawPayload) ? rawPayload : [];

      const formatRelativeTime = (iso) => {
        if (!iso) return '';
        const then = new Date(iso).getTime();
        const now = Date.now();
        const diff = Math.floor((now - then) / 1000); // seconds
        if (diff < 60) return `${diff}s`;
        const mins = Math.floor(diff / 60);
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        const date = new Date(iso);
        return date.toLocaleDateString();
      };

      const mapped = raw.map(item => {
        const data = item?.data || {};
        const type = data?.type ?? item?.type ?? 'notification';
        const postId = extractPostIdFromNotification(item);
        const postImage = extractPostImageFromNotification(item);
        const avatar = extractAvatarFromNotification(item);

        return {
          id: item.id,
          type,
          title: item.title ?? '',
          message: item.body ?? '',
          time: formatRelativeTime(item.createdAt ?? item.updatedAt),
          avatar,
          image: postImage,
          price: null,
          isRead: !!item.isRead,
          postId,
          raw: item,
        };
      });

      setNotifications(mapped);

    } catch (err) {
      console.log(err, 'error getting notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const read = async (notificationIds) => {
    console.log(notificationIds, 'notification IDs to mark as read');
    try {
      const idsArray = Array.isArray(notificationIds) ? notificationIds : [notificationIds];

      const payload = {
        notificationIds: idsArray
      };

      console.log(payload, 'payload being sent');
      const response = await readNotification(payload);

      console.log(response, 'response received');

      const ok =
        response?.status === 200 ||
        response?.statusCode === 200 ||
        response?.success === true;

      // Many APIs return 200 with only a message body (no status field); still treat as success.
      const notExplicitError = response?.error !== true;

      if (ok || notExplicitError) {
        console.log('Notifications marked as read');
        await getNotification();
        DeviceEventEmitter.emit('NOTIFICATION_BADGE_REFRESH');
      }
    } catch (err) {
      console.log(err, 'error marking notifications as read');
    }
  };

  const markAsRead = async (id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );

    await read(id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter(n => !n.isRead)
      .map(n => n.id);

    if (unreadIds.length > 0) {
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );

      await read(unreadIds);
    }
  };

  const popupOpen = (item) => {
    console.log(item, 'selected notification');
    const selected = notifications.find(n => n.id === item.id);
    setSelectedNotification(selected);
    setPopupVisible(true);
  };

  const splitNotificationMessage = useCallback((message) => {
    const safeMessage = String(message || '');
    const actionRegex =
      /\b(?:unfollow(?:ed|ing|s)?|follow(?:ed|ing|s)?|started|buy(?:ing|s)?|bought|purchase(?:d|s|ing)?|subscribe(?:d|s|ing)?|subscribed)\b/i;

    const match = safeMessage.match(actionRegex);
    const splitIndex = match?.index ?? -1;
    const usernameText = splitIndex > 0 ? safeMessage.slice(0, splitIndex).trimEnd() : '';
    const restText = splitIndex >= 0 ? safeMessage.slice(splitIndex).trimStart() : safeMessage;

    return { usernameText, restText };
  }, []);

  const getNotificationTargetUserId = useCallback((notification) => {
    const data = notification?.raw?.data ?? {};

    const directCandidates = [
      data.followerId,
      data.followedById,
      data.followingId,
      data.unfollowerId,
      data.unfollowedById,
      data.fromUserId,
      data.senderId,
      data.actorId,
      data.initiatorId,
      data.byUserId,
      data.buyerId,
      data.purchasedById,
      data.payerId,
      data.subscriberId,
      data.subscriberUserId,
      data.subscribedById,
      data.subscribedUserId,
      data.fanId,
      data.fanUserId,
      data.customerId,
    ];

    const direct = directCandidates.find(Boolean);
    if (direct) return direct;

    return (
      data.user?.id ||
      data.sender?.id ||
      data.actor?.id ||
      data.fromUser?.id ||
      notification?.raw?.userId ||
      notification?.raw?.senderId ||
      null
    );
  }, []);

  const navigateToPost = useCallback((notification) => {
    const postId = notification?.postId;
    if (!postId) return;

    const postPayload = notification?.raw?.data?.post && typeof notification?.raw?.data?.post === 'object'
      ? notification.raw.data.post
      : { id: postId };

    navigation.navigate('ProfileMain', {
      screen: 'PostView',
      params: {
        postData: postPayload,
        userChat: true,
        fromScreen: 'Notifications',
        hideTabBar: true,
      },
    });
  }, [navigation]);

  const handlePopupNavigateToProfile = useCallback(() => {
    const targetUserId = getNotificationTargetUserId(SelectedNotification);
    if (!targetUserId) return;

    setPopupVisible(false);
    navigation.navigate('UsersProfile', { userId: targetUserId });
  }, [SelectedNotification, getNotificationTargetUserId, navigation]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const scrollTabsToIndex = useCallback((index, animated = true) => {
    if (!tabScrollRef.current) return;
    const tabPosition = index * 90;
    tabScrollRef.current.scrollTo({
      x: Math.max(0, tabPosition - width / 2 + 45),
      animated,
    });
  }, []);

  const switchToTab = useCallback((tabKey) => {
    const newIndex = tabs.findIndex(tab => tab.key === tabKey);
    if (newIndex < 0) return;

    setActiveTab(tabKey);
    currentIndexRef.current = newIndex;

    const targetScrollX = newIndex * width;
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: targetScrollX,
        animated: true,
      });
    }

    scrollTabsToIndex(newIndex);
  }, [tabs, scrollTabsToIndex]);

  const tabDataMap = useMemo(() => ({
    all: notifications,
    comments: notifications.filter(n => isPostActivityType(n.type)),
    follows: notifications.filter(n => isFollowType(n.type)),
  }), [notifications]);

  const handleMomentumScrollEnd = useCallback((event) => {
    const x = event?.nativeEvent?.contentOffset?.x ?? 0;
    const index = Math.round(x / width);
    if (index < 0 || index >= tabs.length) return;

    currentIndexRef.current = index;
    const newKey = tabs[index].key;
    setActiveTab((prev) => (prev === newKey ? prev : newKey));
    scrollTabsToIndex(index);
  }, [tabs, scrollTabsToIndex]);

  const EmptyState = ({ tabType }) => {
    const getEmptyStateContent = () => {
      switch (tabType) {
        case 'comments':
          return {
            icon: '💬',
            title: 'No post activity yet',
            subtitle: 'Likes and comments will show up here',
            showCreatePost: false
          };
        case 'follows':
          return {
            icon: '👥',
            title: 'No new follows',
            subtitle: 'When people follow you, you\'ll see it here',
            showCreatePost: false
          };
        default:
          return {
            icon: '🔔',
            title: 'No notifications yet',
            subtitle: 'When you get notifications, they\'ll show up here',
            showCreatePost: true
          };
      }
    };

    const content = getEmptyStateContent();

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>{content.icon}</Text>
        <Text style={[styles.emptyTitle, textStyle]}>{content.title}</Text>
        <Text style={styles.emptyMessage}>{content.subtitle}</Text>

        {content.showCreatePost && (
          <TouchableOpacity
            style={[styles.createPostButton, { backgroundColor: text, shadowColor: text }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Add')}
          >
            <Text style={styles.createPostText}>Create your first post</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderPopup = () => {
    const targetUserId = getNotificationTargetUserId(SelectedNotification);
    const message = SelectedNotification?.message ?? '';
    const { usernameText, restText } = splitNotificationMessage(message);
    return (
      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopupVisible(false)}
      >
        <View style={styles.popupOverlay}>

          <View style={styles.popupContainer}>
            <View style={styles.popupBell}>
              <Text style={styles.popupBellIcon}>🔔</Text>
            </View>
            <View style={styles.popupTextContainer}>
              <Text style={styles.popupTitle}>{SelectedNotification?.title}</Text>
              <Text style={[styles.popupMessage, { color: text }]}>
                {!!usernameText && (targetUserId ? (
                  <Text
                    suppressHighlighting
                    style={styles.popupMessageHighlight}
                    onPress={handlePopupNavigateToProfile}
                  >
                    {`${usernameText} `}
                  </Text>
                ) : (
                  <Text>{`${usernameText} `}</Text>
                ))}
                <Text>{restText}</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.popupCloseButton}
              onPress={() => setPopupVisible(false)}
            >
              <Text style={styles.popupCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTabContent = (tabData, tabKey) => {
    const renderItem = ({ item, index }) => {
      const message = item.message || '';
      const { usernameText, restText } = splitNotificationMessage(message);

      const handlePress = () => {
        markAsRead(item.id);

        if ((isPostActivityType(item.type) || item.image) && item.postId) {
          navigateToPost(item);
          return;
        }

        popupOpen(item);
      };

      return (
        <TouchableOpacity
          style={[styles.notificationItem, !item.isRead && bgStyle]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={[styles.notificationContent, { shadowColor: text }]}>
            <View style={styles.leftSection}>
              <View style={styles.avatarContainer}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, bgStyle]}>
                    <Text style={styles.avatarPlaceholderText}>🔔</Text>
                  </View>
                )}
                <View style={[styles.iconBadge, bgStyle]}>
                  <Text style={styles.iconEmoji}>{getNotificationIcon(item.type)}</Text>
                </View>
              </View>

              <View style={styles.textContent}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationMessage}>
                  {!!usernameText && (
                    <Text style={styles.notificationMessageHighlight}>
                      {`${usernameText} `}
                    </Text>
                  )}
                  <Text>{restText}</Text>
                </Text>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
            </View>

            <View style={styles.rightSection}>
              {item.image && (
                <Image source={{ uri: item.image }} style={[styles.nftImage, bgStyle]} />
              )}
              {item.price && (
                <Text style={[styles.priceText, textStyle]}>{item.price}</Text>
              )}
              {/* {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: text }]} />} */}
            </View>
          </View>

          {index < tabData.length - 1 && (
            <View style={styles.separator} />
          )}
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.tabContentContainer}>
        {!isLoading && tabData.length === 0 ? (
          <EmptyState tabType={tabKey} />
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, textStyle]}>Loading notifications...</Text>
          </View>
        ) : (
          <FlatList
            data={tabData}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* Header */}
      <View style={[styles.header, bgStyle, { shadowColor: text }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, textStyle]}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={[styles.markAllButton, { shadowColor: text }]}>
            <Text style={[styles.markAllText, textStyle]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && { backgroundColor: text },
                { shadowColor: text }
              ]}
              onPress={() => switchToTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}>
                {tab.label}
              </Text>
              {tab.key === 'all' && unreadCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Swipeable Content Area */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.horizontalScrollView}
      >
        {tabs.map((tab) => {
          const tabData = tabDataMap[tab.key] || notifications;

          return (
            <View key={tab.key} style={styles.tabPage}>
              {renderTabContent(tabData, tab.key)}
            </View>
          );
        })}
      </ScrollView>
      {renderPopup()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabContainer: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    position: 'relative',
    width: '100%'
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    marginRight: 8,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#fff',
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#ff1493',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  horizontalScrollView: {
    flex: 1,
  },
  tabPage: {
    width: width,
    flex: 1,
  },
  tabContentContainer: {
    flex: 1,
    marginTop: 15,
  },
  listContent: {
    flexGrow: 1,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 0,
    marginBottom: '-1%'
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 10,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#f3f0f7',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 18,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  iconEmoji: {
    fontSize: 10,
  },
  textContent: {
    flex: 1,
    paddingRight: 12,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 20,
    marginBottom: 6,
  },
  // notificationMessageHighlight: {
  //   color: '#3c0fdd',
  //   fontWeight: '700',
  // },
  timeText: {
    fontSize: 11,
    color: '#555555',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  nftImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 4,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  separator: {
    height: 10,
    backgroundColor: 'transparent',
    marginTop: 8,
    marginHorizontal: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#fff'
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createPostButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 3,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  createPostText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,

  },
  popupMessage: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
  },
  popupMessageHighlight: {
    textDecorationLine: 'underline',
    textDecorationColor: '#3c0fdd',
    color: '#3c0fdd',
    fontWeight: '700',
  },
  popupCloseButton: {
    backgroundColor: '#5a2d82',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  popupCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  popupTextContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },

  popupBell: {
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginBottom: 20,
  },

  popupBellIcon: {
    fontSize: 30,
  },

});
