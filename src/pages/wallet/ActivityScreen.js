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

export const ActivityScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [activeFilter, setActiveFilter] = useState('All');
  const [activities, setActivities] = useState([]);
  const filters = ['All', 'Supporters', 'Follows'];

  const formatTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} second${diffInSeconds === 1 ? '' : 's'} ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
  };

  const fetchActivities = async (type) => {
    try {
      dispatch(showLoader());
      const response = await getRecentActivities(type);
      if (response?.statusCode === 200) {
        const formattedActivities = [];
        let activityId = 1;

        const data = response.data.activities;

        // Purchase activities
        if (data.purchase?.length) {
          data.purchase.forEach(purchase => {
            formattedActivities.push({
              id: activityId++,
              action: `@${purchase.username || 'Unknown'} bought ${purchase.tokensReceived || 0} tokens`,
              time: formatTime(purchase.createdAt),
              type: 'buy',
              createdAt: new Date(purchase.createdAt).getTime(),
            });
          });
        }

        // Sell activities
        if (data.sell?.length) {
          data.sell.forEach(sell => {
            formattedActivities.push({
              id: activityId++,
              action: `@${sell.username || 'Unknown'} sold ${sell.amountTokens || 0} tokens`,
              time: formatTime(sell.createdAt),
              type: 'sell',
              createdAt: new Date(sell.createdAt).getTime(),
            });
          });
        }

        // Following activities
        if (data.following?.length) {
          data.following.forEach(follow => {
            formattedActivities.push({
              id: activityId++,
              action: `${follow.followerName || 'Someone'} followed you`,
              time: formatTime(follow.createdAt),
              type: 'follow',
              createdAt: new Date(follow.createdAt).getTime(),
            });
          });
        }

        // Sort by most recent
        formattedActivities.sort((a, b) => b.createdAt - a.createdAt);
        setActivities(formattedActivities); // show latest 6
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

      if (activeFilter === 'Supporters') {
        // Fetch purchase and sell separately
        const [purchaseRes, sellRes] = await Promise.all([
          getRecentActivities('purchase'),
          getRecentActivities('sell'),
        ]);

        const purchaseData = purchaseRes?.data?.activities?.purchase || [];
        const sellData = sellRes?.data?.activities?.sell || [];

        const formattedActivities = [];
        let activityId = 1;

        // Format purchase activities
        purchaseData.forEach((purchase) => {
          formattedActivities.push({
            id: activityId++,
            action: `@${purchase.username || 'Unknown'} bought ${purchase.tokensReceived || 0} tokens`,
            time: formatTime(purchase.createdAt),
            type: 'buy',
            createdAt: new Date(purchase.createdAt).getTime(),
          });
        });

        // Format sell activities
        sellData.forEach((sell) => {
          formattedActivities.push({
            id: activityId++,
            action: `@${sell.username || 'Unknown'} sold ${sell.amountTokens || 0} tokens`,
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

      // Other filters
      const typeMap = {
        All: null,
        Follows: 'following',
      };

      await fetchActivities(typeMap[activeFilter]);
    };

    fetchByFilter();
  }, [activeFilter]);



  const renderActivity = ({ item }) => (
    <View style={styles.activityDetailItem}>
      <View style={[styles.activityIcon, {
        backgroundColor: item.type === 'buy' ? '#10b981' :
          item.type === 'sell' ? '#ef4444' :
            item.type === 'follow' ? '#3b82f6' : '#8b5cf6'
      }]} >
        <Ionicons
          name={item.type === 'buy' ? 'add' :
            item.type === 'sell' ? 'remove' :
              item.type === 'follow' ? 'people' : 'flash'}
          size={20} color="#fff"
        />
      </View>
      <View style={styles.activityDetailContent}>
        <Text style={styles.activityDetailAction}>{item.action}</Text>
        <Text style={styles.activityDetailTime}>{item.time}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* <View style={styles.header}>
          <Text style={styles.headerTitle}>Activity</Text>
          <Text style={styles.headerSubtitle}>Your complete transaction history</Text>
        </View> */}

        <View style={styles.filtersContainer}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterButton, activeFilter === filter && styles.filterButtonActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
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
    backgroundColor: '#f8f2fd',
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
    color: '#5a2d82',
    marginBottom: 12,
  },

  // Activity Detail
  activityDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#5a2d82',
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
    color: '#111',
    marginBottom: 4,
  },
  activityDetailTime: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#5a2d82',
    borderColor: '#5a2d82',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
});

export default ActivityScreen;