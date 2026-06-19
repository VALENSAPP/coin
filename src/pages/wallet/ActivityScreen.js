import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { getRecentActivities } from '../../services/tokens';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useAppTheme } from '../../theme/useApptheme';
import { useRoute } from '@react-navigation/native';
import { useLanguage } from '../../i18n';

export const ActivityScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const route = useRoute();
  const [activeFilter, setActiveFilter] = useState('all');
  const [activities, setActivities] = useState([]);
  const { bgStyle, textStyle, text, cardStyle, mutedText, accent, border } = useAppTheme();
  const { t } = useLanguage();

  // Filters use translation keys; filter values are stable internal keys
  const filters = [
    { key: 'all', label: t('activity.filters.all') },
    { key: 'following', label: t('activity.filters.following') },
  ];

  const formatTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      const count = diffInSeconds;
      return count === 1
        ? t('activity.time.secondAgo').replace('{{count}}', count)
        : t('activity.time.secondsAgo').replace('{{count}}', count);
    } else if (diffInSeconds < 3600) {
      const count = Math.floor(diffInSeconds / 60);
      return count === 1
        ? t('activity.time.minuteAgo').replace('{{count}}', count)
        : t('activity.time.minutesAgo').replace('{{count}}', count);
    } else if (diffInSeconds < 86400) {
      const count = Math.floor(diffInSeconds / 3600);
      return count === 1
        ? t('activity.time.hourAgo').replace('{{count}}', count)
        : t('activity.time.hoursAgo').replace('{{count}}', count);
    } else {
      const count = Math.floor(diffInSeconds / 86400);
      return count === 1
        ? t('activity.time.dayAgo').replace('{{count}}', count)
        : t('activity.time.daysAgo').replace('{{count}}', count);
    }
  };

  const fetchActivities = async (type) => {
    try {
      dispatch(showLoader());
      const response = await getRecentActivities(type);
      console.log(response, 'data in activity');
      if (response?.statusCode === 200) {
        const formattedActivities = [];
        let activityId = 1;

        const data = response.data.activities;

        // Following activities
        if (data.following?.length) {
          data.following.forEach(follow => {
            formattedActivities.push({
              id: activityId++,
              action: `${follow.followerName || 'Someone'} ${t('activity.actions.followedYou')}`,
              userId: follow.followerId,
              time: formatTime(follow.createdAt),
              type: 'follow',
              createdAt: new Date(follow.createdAt).getTime(),
            });
          });
        }

        // Sort by most recent
        formattedActivities.sort((a, b) => b.createdAt - a.createdAt);
        setActivities(formattedActivities);
      }
    } catch (error) {
      console.log('Error fetching activities', error);
    } finally {
      dispatch(hideLoader());
    }
  };

  useEffect(() => {
    const fetchByFilter = async () => {
      dispatch(showLoader());

      if (activeFilter === 'supporters') {
        const [purchaseRes, sellRes] = await Promise.all([
          getRecentActivities('purchase'),
          getRecentActivities('sell'),
        ]);

        const purchaseData = purchaseRes?.data?.activities?.purchase || [];
        const sellData = sellRes?.data?.activities?.sell || [];

        const formattedActivities = [];
        let activityId = 1;

        purchaseData.forEach((purchase) => {
          formattedActivities.push({
            id: activityId++,
            action: `@${purchase.username || 'Unknown'} ${t('activity.actions.boughtTokens').replace('{{count}}', purchase.tokensReceived || 0)}`,
            time: formatTime(purchase.createdAt),
            type: 'buy',
            createdAt: new Date(purchase.createdAt).getTime(),
          });
        });

        sellData.forEach((sell) => {
          formattedActivities.push({
            id: activityId++,
            action: `@${sell.username || 'Unknown'} ${t('activity.actions.soldTokens').replace('{{count}}', sell.amountTokens || 0)}`,
            time: formatTime(sell.createdAt),
            type: 'sell',
            createdAt: new Date(sell.createdAt).getTime(),
          });
        });

        formattedActivities.sort((a, b) => b.createdAt - a.createdAt);
        setActivities(formattedActivities);
        dispatch(hideLoader());
        return;
      }

      const typeMap = {
        all: null,
        following: 'following',
      };

      await fetchActivities(typeMap[activeFilter]);
    };

    fetchByFilter();
  }, [activeFilter]);

  const navigateToActivityUser = (activity) => {
    if (activity?.type !== 'follow') return;
    if (!activity?.userId) return;
    navigation.navigate('HomeMain', {
      screen: 'UsersProfile',
      params: { userId: activity.userId, returnTo: route?.name },
    });
  };

  const renderActivity = ({ item }) => (
    <View style={[styles.activityDetailItem, cardStyle, { shadowColor: text, borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigateToActivityUser(item)}
        style={[
          styles.activityIcon,
          {
            backgroundColor:
              item.type === 'buy'
                ? '#10b981'
                : item.type === 'sell'
                ? '#ef4444'
                : item.type === 'follow'
                ? '#3b82f6'
                : '#8b5cf6',
          },
        ]}
      >
        <Ionicons
          name={
            item.type === 'buy'
              ? 'add'
              : item.type === 'sell'
              ? 'remove'
              : item.type === 'follow'
              ? 'people'
              : 'flash'
          }
          size={20}
          color="#fff"
        />
      </TouchableOpacity>
      <View style={styles.activityDetailContent}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigateToActivityUser(item)}>
          <Text style={[styles.activityDetailAction, textStyle]}>{item.action}</Text>
        </TouchableOpacity>
        <Text style={[styles.activityDetailTime, { color: mutedText }]}>{item.time}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.filtersContainer}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                { borderColor: border, backgroundColor: cardStyle?.backgroundColor },
                activeFilter === filter.key && { backgroundColor: accent, borderColor: accent },
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: mutedText },
                  activeFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, textStyle]}>{t('activity.recentActivity')}</Text>
          <FlatList
            data={activities}
            renderItem={renderActivity}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 40,
    marginBottom: Platform.OS == "ios" ? 50 : 0
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  // Activity Detail
  activityDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityDetailContent: {
    flex: 1,
  },
  activityDetailAction: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityDetailTime: {
    fontSize: 14,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Activity Screen Filters
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: Platform.OS == "ios" ? 20 : 0
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
  },
});

export default ActivityScreen;
