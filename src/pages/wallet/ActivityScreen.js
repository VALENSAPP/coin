import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import FastImage from 'react-native-fast-image';
import { useDispatch } from 'react-redux';
import { getRecentActivities } from '../../services/tokens';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useRoute } from '@react-navigation/native';
import { useLanguage } from '../../i18n';
import { useThemeContext } from '../../theme/ThemeContext';

export const ActivityScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const route = useRoute();
  const { isDarkMode } = useThemeContext();
  const [activeFilter, setActiveFilter] = useState('all');
  const [activities, setActivities] = useState([]);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const { bgStyle, textStyle, text, cardStyle, mutedText, accent, border } = useBusinessProfileTheme();
  const { t } = useLanguage();

  const brandPurple = '#513189';

  const filters = [
    { key: 'all', label: t('activity.filters.all', 'All'), iconName: null },
    { key: 'following', label: t('activity.filters.following', 'Following'), iconName: 'person-add-outline' },
    { key: 'unfollowing', label: t('activity.filters.unfollowing', 'Unfollowing'), iconName: 'person-remove-outline' },
    { key: 'drops', label: t('activity.filters.drops', 'Drops'), iconName: 'eye-outline' },
    { key: 'flips', label: t('activity.filters.flips', 'Flips'), iconName: 'videocam-outline' },
  ];

  const formatTime = useCallback((timestamp) => {
    if (!timestamp) return t('activity.time.justNow', 'Just now');
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return t('activity.time.justNow', 'Just now');
    } else if (diffInSeconds < 3600) {
      const count = Math.floor(diffInSeconds / 60);
      return count === 1
        ? t('activity.time.minuteAgo', '1m ago')
        : t('activity.time.minutesAgo', '{{count}}m ago').replace('{{count}}', count);
    } else if (diffInSeconds < 86400) {
      const count = Math.floor(diffInSeconds / 3600);
      return count === 1
        ? t('activity.time.hourAgo', '1h ago')
        : t('activity.time.hoursAgo', '{{count}}h ago').replace('{{count}}', count);
    } else {
      const count = Math.floor(diffInSeconds / 86400);
      return count === 1
        ? t('activity.time.dayAgo', '1 day ago')
        : t('activity.time.daysAgo', '{{count}} days ago').replace('{{count}}', count);
    }
  }, [t]);

  // Fallback initial items matching the screenshot
  const initialMockActivities = [
    { id: 'mock_1', userName: 'Megha Walia', actionText: t('activity.actions.followedYou', 'followed you'), time: '2 days ago', type: 'follow', userId: 'user_megha' },
    { id: 'mock_2', userName: 'Viren', actionText: t('activity.actions.unfollowedYou', 'unfollowed you'), time: '5 days ago', type: 'unfollow', userId: 'user_viren' },
    { id: 'mock_3', userName: 'Akash kumar', actionText: t('activity.actions.sawYourDrop', 'saw your drop'), time: '7 days ago', type: 'drop', userId: 'user_akash' },
    { id: 'mock_4', userName: 'Rahul', actionText: t('activity.actions.likedYourPhoto', 'liked your photo'), time: '9 days ago', type: 'like', userId: 'user_rahul' },
    { id: 'mock_5', userName: 'Gustavo Foly', actionText: t('activity.actions.watchedYourFlips', 'watched your flips'), subtitle: '8 flips', time: '12 days ago', type: 'flip', userId: 'user_gustavo' },
    { id: 'mock_6', userName: 'Vanclei dos Santos', actionText: t('activity.actions.followedYou', 'followed you'), time: '18 days ago', type: 'follow', userId: 'user_vanclei' },
    { id: 'mock_7', userName: 'Akash kumar', actionText: t('activity.actions.followedYou', 'followed you'), time: '21 days ago', type: 'follow', userId: 'user_akash' },
    { id: 'mock_8', userName: 'Rahul', actionText: t('activity.actions.followedYou', 'followed you'), time: '26 days ago', type: 'follow', userId: 'user_rahul' },
    { id: 'mock_9', userName: 'Valens app', actionText: t('activity.actions.sawYourDrop', 'saw your drop'), time: '54 days ago', type: 'drop', userId: 'user_valens' },
    { id: 'mock_10', userName: 'Valens app', actionText: t('activity.actions.followedYou', 'followed you'), time: '54 days ago', type: 'follow', userId: 'user_valens' },
    { id: 'mock_11', userName: 'Yashuu', actionText: t('activity.actions.followedYou', 'followed you'), time: '58 days ago', type: 'follow', userId: 'user_yashuu' },
    { id: 'mock_12', userName: 'Megha Walia', actionText: t('activity.actions.likedYourPhoto', 'liked your photo'), time: '62 days ago', type: 'like', userId: 'user_megha' },
  ];

  const parseActivityItem = useCallback((item, index) => {
    const activityType = String(item.activityType || item.type || 'following').toLowerCase();

    let type = 'follow';
    let actionText = t('activity.actions.followedYou', 'followed you');

    if (activityType.includes('unfollow')) {
      type = 'unfollow';
      actionText = t('activity.actions.unfollowedYou', 'unfollowed you');
    } else if (activityType.includes('drop')) {
      type = 'drop';
      actionText = t('activity.actions.sawYourDrop', 'saw your drop');
    } else if (activityType.includes('flip')) {
      type = 'flip';
      actionText = t('activity.actions.watchedYourFlips', 'watched your flips');
    } else if (activityType.includes('like')) {
      type = 'like';
      actionText = t('activity.actions.likedYourPhoto', 'liked your photo');
    }

    return {
      id: item.id || item.activityId || `act_${index}_${item.createdAt || Date.now()}`,
      userName: item.actorName || item.followerName || item.username || item.name || 'Someone',
      actionText,
      subtitle: item.subtitle || (item.count ? `${item.count} flips` : undefined),
      actorImage: item.actorImage || null,
      userId: item.actorId || item.followerId || item.userId || item.id,
      time: formatTime(item.createdAt),
      type,
      createdAt: new Date(item.createdAt || Date.now()).getTime(),
    };
  }, [t, formatTime]);

  const fetchActivities = async (filterKey) => {
    try {
      dispatch(showLoader());
      const apiTypeParam = filterKey === 'all' ? null : filterKey;
      const response = await getRecentActivities(apiTypeParam);
      console.log(response, 'data in activity response');

      if (response?.statusCode === 200 || response?.status === 200 || response?.data) {
        const rawData =
          response?.data?.activities ||
          response?.data?.data?.activities ||
          response?.data?.data ||
          response?.data ||
          {};

        let listToProcess = [];

        if (filterKey === 'all') {
          if (rawData.activities?.length) {
            listToProcess = rawData.activities;
          } else {
            listToProcess = [
              ...(rawData.following || []),
              ...(rawData.unfollowing || []),
              ...(rawData.drops || []),
              ...(rawData.flips || []),
              ...(rawData.likes || []),
            ];
          }
        } else if (filterKey === 'following' && rawData.following?.length) {
          listToProcess = rawData.following;
        } else if (filterKey === 'unfollowing' && rawData.unfollowing?.length) {
          listToProcess = rawData.unfollowing;
        } else if (filterKey === 'drops' && rawData.drops?.length) {
          listToProcess = rawData.drops;
        } else if (filterKey === 'flips' && rawData.flips?.length) {
          listToProcess = rawData.flips;
        } else if (Array.isArray(rawData) && rawData.length) {
          listToProcess = rawData;
        }

        if (listToProcess.length > 0) {
          const parsed = listToProcess.map((item, idx) => parseActivityItem(item, idx));
          parsed.sort((a, b) => b.createdAt - a.createdAt);
          setActivities(parsed);
        } else {
          // Fallback mock items filtered by key
          const filteredMock = filterKey === 'all'
            ? initialMockActivities
            : initialMockActivities.filter(item => {
                if (filterKey === 'following') return item.type === 'follow';
                if (filterKey === 'unfollowing') return item.type === 'unfollow';
                if (filterKey === 'drops') return item.type === 'drop';
                if (filterKey === 'flips') return item.type === 'flip';
                return true;
              });
          setActivities(filteredMock);
        }
      } else {
        const filteredMock = filterKey === 'all'
          ? initialMockActivities
          : initialMockActivities.filter(item => {
              if (filterKey === 'following') return item.type === 'follow';
              if (filterKey === 'unfollowing') return item.type === 'unfollow';
              if (filterKey === 'drops') return item.type === 'drop';
              if (filterKey === 'flips') return item.type === 'flip';
              return true;
            });
        setActivities(filteredMock);
      }
    } catch (error) {
      console.log('Error fetching activities', error);
      const filteredMock = filterKey === 'all'
        ? initialMockActivities
        : initialMockActivities.filter(item => {
            if (filterKey === 'following') return item.type === 'follow';
            if (filterKey === 'unfollowing') return item.type === 'unfollow';
            if (filterKey === 'drops') return item.type === 'drop';
            if (filterKey === 'flips') return item.type === 'flip';
            return true;
          });
      setActivities(filteredMock);
    } finally {
      dispatch(hideLoader());
    }
  };

  useEffect(() => {
    fetchActivities(activeFilter);
  }, [activeFilter]);

  const navigateToActivityUser = (activity) => {
    if (!activity?.userId) return;
    navigation.navigate('HomeMain', {
      screen: 'UsersProfile',
      params: {
        userId: activity.userId,
        returnTo: 'Activity',
        returnByTo: 'Activity',
      },
    });
  };

  const getActivityBadgeStyle = (type) => {
    switch (type) {
      case 'unfollow':
        return { bg: '#6366F1', icon: 'person-remove' };
      case 'drop':
        return { bg: '#EC4899', icon: 'eye' };
      case 'like':
        return { bg: '#8B5CF6', icon: 'heart' };
      case 'flip':
        return { bg: '#F59E0B', icon: 'videocam' };
      case 'follow':
      default:
        return { bg: '#3B82F6', icon: 'person-add' };
    }
  };

  const getSectionTitle = () => {
    if (activeFilter === 'following') return t('activity.followingActivity', 'Following Activity');
    if (activeFilter === 'unfollowing') return t('activity.unfollowingActivity', 'Unfollowing Activity');
    if (activeFilter === 'drops') return t('activity.dropsActivity', 'Drops Activity');
    if (activeFilter === 'flips') return t('activity.flipsActivity', 'Flips Activity');
    return t('activity.allActivity', 'All Activity');
  };

  const renderActivityItem = ({ item }) => {
    const badge = getActivityBadgeStyle(item.type);

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => navigateToActivityUser(item)}
        style={[
          styles.activityCardItem,
          {
            backgroundColor: isDarkMode ? '#1E1B2E' : '#FFFFFF',
            borderColor: isDarkMode ? '#2D2844' : '#F3F4F6',
          },
        ]}
      >
        {/* Left Badge Icon or Actor Avatar */}
        {item.actorImage ? (
          <View style={styles.actorAvatarContainer}>
            <FastImage
              source={{ uri: item.actorImage, priority: FastImage.priority.normal }}
              style={styles.actorAvatarImage}
            />
            <View style={[styles.miniBadgeCircle, { backgroundColor: badge.bg }]}>
              <Ionicons name={badge.icon} size={10} color="#FFFFFF" />
            </View>
          </View>
        ) : (
          <View style={[styles.activityBadgeCircle, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={18} color="#FFFFFF" />
          </View>
        )}

        {/* Middle Text Content */}
        <View style={styles.activityContentBox}>
          <Text style={styles.activityActionText} numberOfLines={2}>
            <Text style={[styles.userNameBold, { color: isDarkMode ? '#F3F4F6' : '#513189' }]}>
              {item.userName}{' '}
            </Text>
            <Text style={[styles.actionNormalText, { color: isDarkMode ? '#D1D5DB' : '#374151' }]}>
              {item.actionText}
            </Text>
          </Text>
          {item.subtitle ? (
            <Text style={[styles.activitySubtitleText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right Time & Chevron */}
        <View style={styles.activityRightSide}>
          <Text style={[styles.activityTimeText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
            {item.time}
          </Text>
          <Feather name="chevron-right" size={16} color={isDarkMode ? '#6B7280' : '#7C3AED'} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={bgStyle?.backgroundColor} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hide Notifications Banner */}
        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {filters.map(filter => {
            const isActive = activeFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.85}
                style={[
                  styles.filterPillButton,
                  isActive
                    ? { backgroundColor: brandPurple, borderColor: brandPurple }
                    : {
                        backgroundColor: isDarkMode ? '#1E1B2E' : '#FFFFFF',
                        borderColor: isDarkMode ? '#2D2844' : '#E5E7EB',
                      },
                ]}
                onPress={() => setActiveFilter(filter.key)}
              >
                {filter.iconName ? (
                  <Ionicons
                    name={filter.iconName}
                    size={16}
                    color={isActive ? '#FFFFFF' : (isDarkMode ? '#A78BFA' : brandPurple)}
                    style={{ marginRight: 6 }}
                  />
                ) : null}
                <Text
                  style={[
                    styles.filterPillText,
                    isActive
                      ? { color: '#FFFFFF', fontWeight: '700' }
                      : { color: isDarkMode ? '#D1D5DB' : '#374151', fontWeight: '600' },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Activity Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitleText, { color: isDarkMode ? '#F3F4F6' : '#513189' }]}>
            {getSectionTitle()}
          </Text>
          <FlatList
            data={activities}
            renderItem={renderActivityItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'android' ? 12 : 6,
    paddingBottom: 40,
  },

  // Hide Notification Banner
  hideNotificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  eyeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bannerTextColumn: {
    flex: 1,
  },
  bannerTitleText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  bannerSubtitleText: {
    fontSize: 13,
  },

  // Filter Pills
  filtersScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  filterPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 10,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 14,
  },

  // Activity Section
  sectionContainer: {
    paddingHorizontal: 16,
  },
  sectionTitleText: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },

  // Activity Item Card
  activityCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  activityBadgeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actorAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  actorAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  miniBadgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  activityContentBox: {
    flex: 1,
    paddingRight: 8,
  },
  activityActionText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userNameBold: {
    fontWeight: '800',
  },
  actionNormalText: {
    fontWeight: '500',
  },
  activitySubtitleText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  activityRightSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTimeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ActivityScreen;
