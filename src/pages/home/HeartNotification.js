import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';

const { width } = Dimensions.get('window');

export default function Notifications() {
  const [activeTab, setActiveTab] = useState('all');
  const scrollViewRef = useRef(null);
  const tabScrollRef = useRef(null);

  // Track horizontal paging position
  const scrollX = useRef(new Animated.Value(0)).current;
  const currentIndexRef = useRef(0);
  const { bgStyle, textStyle, text } = useAppTheme();

  const [notifications, setNotifications] = useState([
    {
      id: '1',
      type: 'mint',
      title: 'New mint from artist you follow',
      message: 'ethereum.jpeg minted "Digital Dreams #142"',
      time: '2m',
      avatar: 'https://picsum.photos/40/40?random=1',
      isRead: false,
      image: 'https://picsum.photos/60/60?random=10',
      price: '0.001 ETH'
    },
    {
      id: '2',
      type: 'sale',
      title: 'Your NFT was purchased',
      message: 'cryptoart.eth bought "Neon Nights #7" for 0.05 ETH',
      time: '15m',
      avatar: 'https://picsum.photos/40/40?random=2',
      isRead: false,
      image: 'https://picsum.photos/60/60?random=11',
      price: '0.05 ETH'
    },
    {
      id: '3',
      type: 'follow',
      title: 'New follower',
      message: "artist_collective started following you",
      time: '1h',
      avatar: 'https://picsum.photos/40/40?random=3',
      isRead: true,
      image: null,
      price: null
    },
    {
      id: '4',
      type: 'comment',
      title: 'New comment on your post',
      message: 'web3_artist: "Beautiful work! Love the colors 🎨"',
      time: '2h',
      avatar: 'https://picsum.photos/40/40?random=7',
      isRead: false,
      image: 'https://picsum.photos/60/60?random=15',
      price: null
    },
    {
      id: '5',
      type: 'bid',
      title: 'New bid on your NFT',
      message: 'collector_pro placed a bid of 0.12 ETH on "Abstract Flow"',
      time: '4h',
      avatar: 'https://picsum.photos/40/40?random=8',
      isRead: false,
      image: 'https://picsum.photos/60/60?random=16',
      price: '0.12 ETH'
    },
    {
      id: '6',
      type: 'trade',
      title: 'Trade completed',
      message: 'Your trade with collector.eth was successful',
      time: '6h',
      avatar: 'https://picsum.photos/40/40?random=4',
      isRead: true,
      image: 'https://picsum.photos/60/60?random=12',
      price: '0.08 ETH'
    },
    {
      id: '7',
      type: 'like',
      title: 'Your post was liked',
      message: 'crypto_enthusiast and 5 others liked your post',
      time: '8h',
      avatar: 'https://picsum.photos/40/40?random=9',
      isRead: true,
      image: 'https://picsum.photos/60/60?random=17',
      price: null
    }
  ]);

  const navigation = useNavigation();

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'trades', label: 'Trades' },
    { key: 'comments', label: 'Comments' },
    { key: 'follows', label: 'Follows' }
  ];

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'trades') return notifications.filter(n => ['sale', 'bid', 'trade'].includes(n.type));
    if (activeTab === 'comments') return notifications.filter(n => n.type === 'comment');
    if (activeTab === 'follows') return notifications.filter(n => n.type === 'follow');
    return notifications;
  }, [activeTab, notifications]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'mint': return '🎨';
      case 'sale': return '💰';
      case 'trade': return '🔄';
      case 'bid': return '🏷️';
      case 'follow': return '👥';
      case 'like': return '❤️';
      case 'comment': return '💬';
      default: return '🔔';
    }
  };

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, isRead: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const switchToTab = useCallback((tabKey) => {
    const newIndex = tabs.findIndex(tab => tab.key === tabKey);
    if (newIndex < 0) return;

    setActiveTab(tabKey);

    // Snap the content ScrollView
    const targetScrollX = newIndex * width;
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: targetScrollX,
        animated: true,
      });
    }

    // Keep the tab in view
    if (tabScrollRef.current) {
      const tabPosition = newIndex * 90; // approx tab width
      tabScrollRef.current.scrollTo({
        x: Math.max(0, tabPosition - width / 2 + 45),
        animated: true,
      });
    }
  }, [tabs]);

  // Update active tab while swiping (no lag)
  useEffect(() => {
    const sub = scrollX.addListener(({ value }) => {
      const index = Math.round(value / width);
      if (index !== currentIndexRef.current && index >= 0 && index < tabs.length) {
        currentIndexRef.current = index;
        const newKey = tabs[index].key;

        setActiveTab((prev) => (prev === newKey ? prev : newKey));

        // Auto-scroll the tab bar to keep the active tab centered
        if (tabScrollRef.current) {
          const tabPosition = index * 90;
          tabScrollRef.current.scrollTo({
            x: Math.max(0, tabPosition - width / 2 + 45),
            animated: true,
          });
        }
      }
    });

    return () => {
      scrollX.removeListener(sub);
    };
  }, [scrollX, tabs]);

  const EmptyState = ({ tabType }) => {
    const getEmptyStateContent = () => {
      switch (tabType) {
        case 'trades':
          return {
            icon: '🔄',
            title: 'No trades yet',
            subtitle: 'Your trading activity will appear here',
            showCreatePost: false
          };
        case 'comments':
          return {
            icon: '💬',
            title: 'No comments yet',
            subtitle: 'Share your work to start getting comments',
            showCreatePost: true
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
            style={[styles.createPostButton, {backgroundColor: text, shadowColor: text}]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Add')}
          >
            <Text style={styles.createPostText}>Create your first post</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderTabContent = (tabData) => {
    const renderItem = ({ item, index }) => (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && bgStyle]}
        onPress={() => markAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.notificationContent, {shadowColor: text}]}>
          <View style={styles.leftSection}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
              <View style={[styles.iconBadge, bgStyle]}>
                <Text style={styles.iconEmoji}>{getNotificationIcon(item.type)}</Text>
              </View>
            </View>

            <View style={styles.textContent}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
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
            {!item.isRead && <View style={[styles.unreadDot, {backgroundColor: text}]} />}
          </View>
        </View>

        {index < tabData.length - 1 && (
          <View style={styles.separator} />
        )}
      </TouchableOpacity>
    );

    return (
      <View style={styles.tabContentContainer}>
        {tabData.length === 0 ? (
          <EmptyState tabType={activeTab} />
        ) : (
          <FlatList
            data={tabData}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
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
      <View style={[styles.header, bgStyle, {shadowColor: text}]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, textStyle]}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={[styles.markAllButton, {shadowColor: text}]}>
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
                activeTab === tab.key && {backgroundColor: text},
                {shadowColor: text}
              ]}
              onPress={() => switchToTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
                textStyle
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
        {/* If you later want an underline indicator, you can add it here */}
      </View>

      {/* Swipeable Content Area */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        style={styles.horizontalScrollView}
      >
        {tabs.map((tab) => {
          const tabData = (() => {
            if (tab.key === 'all') return notifications;
            if (tab.key === 'trades') return notifications.filter(n => ['sale', 'bid', 'trade'].includes(n.type));
            if (tab.key === 'comments') return notifications.filter(n => n.type === 'comment');
            if (tab.key === 'follows') return notifications.filter(n => n.type === 'follow');
            return notifications;
          })();

          return (
            <View key={tab.key} style={styles.tabPage}>
              {renderTabContent(tabData)}
            </View>
          );
        })}
      </Animated.ScrollView>
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
  tabIndicatorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: 'transparent',
  },
  tabIndicatorBar: {
    width: 80,
    height: 2,
    backgroundColor: '#ff1493',
    borderRadius: 1,
  },
  contentContainer: {
    flex: 1,
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
  },
  listContent: {
    flexGrow: 1,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
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
});
