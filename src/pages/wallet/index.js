import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Dimensions,
  RefreshControl,
  Linking,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LineChart } from 'react-native-wagmi-charts';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { getLatestTransactions, getRecentActivities, getTokenHistory, getTopCreators, getTotalTokenPurchase } from '../../services/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { getCreditsLeft } from '../../services/wallet';
import { getUserDashboard } from '../../services/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCheckoutSession } from '../../services/stirpe';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import RBSheet from 'react-native-raw-bottom-sheet';
import TokenPurchaseModal from '../../components/modals/TokenPurchaseModal';
import TokenSellModal from '../../components/modals/TokenSellModal';

const { width } = Dimensions.get('window');

export const WalletDashboardScreen = ({ navigation }) => {
  const [activityPeriod, setActivityPeriod] = useState('Weekly');
  const [walletTransactions, setWalletTransactions] = useState();
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [pendingFollowUserId, setPendingFollowUserId] = useState(null);
  const [tokenAddress, setTokenAddress] = useState(null);
  const [kpiData, setKpiData] = useState([
    { title: 'Portfolio Value', value: '-', icon: 'wallet', color: '#5a2d82' },
    { title: 'My Coin Price', value: '-', icon: 'logo-bitcoin', color: '#10b981' },
    { title: 'Followers', value: '-', icon: 'people', color: '#f59e0b' },
    { title: 'Credits Left', value: '-', icon: 'flash', color: '#ef4444', currentCredits: 5 },
  ]);
  const dispatch = useDispatch();
  const toast = useToast();
  const purchaseSheetRef = useRef(null);
  const sellSheetRef = useRef(null);

  useEffect(() => {
    let timeout;

    const onKeyboardHide = () => {
      timeout = setTimeout(() => {
        // reset layout for both sheets
        purchaseSheetRef.current?.updateLayout?.({ height: 500 });
        commentSheetRef.current?.updateLayout?.({ height: 500 });
      }, 300); // wait until keyboard animation is done
    };

    const hideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);

    return () => {
      hideSub.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
    }, [fetchAllData])
  );

  useEffect(() => {
    fetchActivityOverview();
  }, [activityPeriod]);

  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchAllTransaction(),
      fetchDashboardData(),
      fetchCreditsLeft(),
      fetchFollowers(),
      fetchActivityOverview(),
      fetchTopCreators(),
      fetchActivities(),
    ]);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  const hapticFeedback = (type) => {
    const options = {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    };
    ReactNativeHapticFeedback.trigger(type, options);
  };

  const updatePriceTitle = (point) => {
    if (point && point.value !== undefined) {
      setSelectedPrice(point.value);
    }
  };

  const resetPriceTitle = () => {
    if (priceHistory.length > 0) {
      setSelectedPrice(priceHistory[priceHistory.length - 1].value);
    }
  };

  // Helper function to format activity type
  const getActivityType = (activity) => {
    if (activity.purchase) return 'buy';
    if (activity.sell) return 'sell';
    if (activity.following) return 'follow';
    return 'mint';
  };

  // Helper function to format activity action text
  const formatActivityAction = (activity) => {
    if (activity.purchase && activity.purchase.length > 0) {
      const purchase = activity.purchase[0];
      return `Bought ${purchase.purchaseTokenPrice?.toFixed(2) || 'N/A'} tokens`;
    }
    if (activity.sell && activity.sell.length > 0) {
      const sell = activity.sell[0];
      return `Sold ${sell.purchaseTokenPrice?.toFixed(2) || 'N/A'} tokens`;
    }
    if (activity.following && activity.following.length > 0) {
      return `@${activity.following[0].username || 'user'} followed you`;
    }
    return 'Activity recorded';
  };

  // Helper function to format time
  const formatTime = (timestamp) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now - activityTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const fetchDashboardData = async () => {
    const storedPrice = await AsyncStorage.getItem('priceInUsd');
    try {
      dispatch(showLoader());
      const response = await getTotalTokenPurchase();

      if (response?.statusCode === 200) {
        const totalPortfolioValue = response.data.reduce(
          (sum, item) => sum + (item.totalTokenAmount || 0),
          0
        );

        setKpiData(prevKpiData => {
          const newKpiData = [...prevKpiData];
          newKpiData[0] = {
            ...newKpiData[0],
            value: `$ ${totalPortfolioValue.toFixed(4)}`
          };
          newKpiData[1] = {
            ...newKpiData[1],
            value: `$ ${Number(storedPrice).toFixed(4)}`
          };
          return newKpiData;
        });
      }
      else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const fetchAllTransaction = async () => {
    try {
      dispatch(showLoader());
      const response = await getLatestTransactions();
      if (response?.statusCode === 200) {
        setWalletTransactions(response.data.transactions);
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const fetchCreditsLeft = async () => {
    try {
      dispatch(showLoader());
      const response = await getCreditsLeft();
      if (response?.statusCode === 200) {
        setKpiData(prevKpiData => {
          const newKpiData = [...prevKpiData];
          newKpiData[3] = {
            ...newKpiData[3],
            value: `${response.data.hitLeft} / 5`,
            currentCredits: response.data.hitLeft
          };
          return newKpiData;
        });
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleBuyCredits = () => {
    Alert.alert(
      'Buy Post Credits',
      'Purchase 5 additional post credits?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase', onPress: () => {
            createStripeSubscription()
          }
        }
      ]
    );
  };

  const fetchActivityOverview = async () => {
    const getTokenAddress = await AsyncStorage.getItem('PlatFormToken');

    const periodMap = {
      'Weekly': 'week',
      'Monthly': 'month',
      'Yearly': 'year'
    };

    try {
      dispatch(showLoader());
      const response = await getTokenHistory(getTokenAddress, periodMap[activityPeriod]);

      if (response?.statusCode === 200) {
        if (response.data.history && Array.isArray(response.data.history)) {
          const formattedData = response.data.history.map(item => ({
            timestamp: new Date(item.date || item.timestamp).getTime(),
            value: parseFloat(item.price || item.value || 0)
          })).filter(item => !isNaN(item.value) && !isNaN(item.timestamp));

          formattedData.sort((a, b) => a.timestamp - b.timestamp);

          if (formattedData.length > 0) {
            setPriceHistory(formattedData);
            setSelectedPrice(formattedData[formattedData.length - 1].value);
          } else {
            setPriceHistory([]);
            setSelectedPrice(0);
          }
        } else {
          setPriceHistory([]);
          setSelectedPrice(0);
        }
      } else {
        showToastMessage(toast, 'danger', response.data.message);
        setPriceHistory([]);
        setSelectedPrice(0);
      }
    } catch (error) {
      console.error('Error fetching activity overview:', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
      setPriceHistory([]);
      setSelectedPrice(0);
    } finally {
      dispatch(hideLoader());
    }
  };

  const fetchFollowers = async () => {
    const id = await AsyncStorage.getItem('userId');
    try {
      dispatch(showLoader());
      const response = await getUserDashboard(id);
      if (response?.statusCode === 200) {
        setKpiData(prevKpiData => {
          const newKpiData = [...prevKpiData];
          newKpiData[2] = {
            ...newKpiData[2],
            value: response.data.dashboardData.totalFollowers.toString() || '0'
          };
          return newKpiData;
        });
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const fetchTopCreators = async () => {
    try {
      dispatch(showLoader());
      const response = await getTopCreators();
      if (response?.statusCode === 200) {
        console.log('Top creators', response.data);

        // Transform API data to component format
        const formattedCreators = response.data.map((creator, index) => ({
          id: index + 1,
          name: `@${creator.username || 'unknown'}`,
          vendorId: creator.vendorId,
          price: `$${creator.purchaseTokenPrice || '0.00'}`
        }));

        setTopCreators(formattedCreators.slice(0, 5)); // Limit to top 5
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const fetchActivities = async () => {
    try {
      dispatch(showLoader());
      const response = await getRecentActivities();
      if (response?.statusCode === 200) {
        console.log('Recent activities', response.data);

        // Transform API data to component format
        const formattedActivities = [];
        let activityId = 1;

        // Process activities data
        if (response.data.activities) {
          const activities = response.data.activities;

          // Add purchase activities
          if (activities.purchase && Array.isArray(activities.purchase)) {
            activities.purchase.forEach(purchase => {
              formattedActivities.push({
                id: activityId++,
                action: `@${purchase.username || 'Unknown'} bought ${purchase.tokensReceived || 0} tokens`,
                time: formatTime(purchase.createdAt),
                type: 'buy',
                createdAt: new Date(purchase.createdAt).getTime(),
                rawData: purchase
              });
            });
          }

          // Add sell activities
          if (activities.sell && Array.isArray(activities.sell)) {
            activities.sell.forEach(sell => {
              formattedActivities.push({
                id: activityId++,
                action: `@${sell.username || 'Unknown'} sold ${sell.amountTokens || 0} tokens`,
                time: formatTime(sell.createdAt),
                type: 'sell',
                createdAt: new Date(sell.createdAt).getTime(),
                rawData: sell
              });
            });
          }

          // Add following activities
          if (activities.following && Array.isArray(activities.following)) {
            activities.following.forEach(follow => {
              formattedActivities.push({
                id: activityId++,
                action: `${follow.followerName || 'Someone'} followed you`,
                time: formatTime(follow.createdAt),
                type: 'follow',
                createdAt: new Date(follow.createdAt).getTime(),
                rawData: follow
              });
            });
          }
        }

        // Sort by createdAt timestamp (most recent first)
        formattedActivities.sort((a, b) => b.createdAt - a.createdAt);

        // Update IDs after sorting
        formattedActivities.forEach((activity, index) => {
          activity.id = index + 1;
        });

        // Limit to 15 most recent activities
        setRecentActivities(formattedActivities.slice(0, 6));
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const createStripeSubscription = async () => {
    dispatch(showLoader());
    try {
      const response = await createCheckoutSession();

      if (response?.statusCode === 200 && response?.data?.url) {
        const url = response.data.url;

        if (await InAppBrowser.isAvailable()) {
          await InAppBrowser.open(url, {
            // Customization options
            dismissButtonStyle: 'close',
            preferredBarTintColor: '#ffffff',
            preferredControlTintColor: '#000000',
            readerMode: false,
            animated: true,
            modalPresentationStyle: 'fullScreen',
            modalTransitionStyle: 'coverVertical',
            enableBarCollapsing: false,
            showTitle: true,
            toolbarColor: '#ffffff',
            secondaryToolbarColor: '#f0f0f0',
          });
        } else {
          // Fallback if in-app browser isn’t available
          await Linking.openURL(url);
        }
      } else {
        showToastMessage(
          toast,
          'danger',
          response?.error ||
          response?.message ||
          'Failed to create payment session. Please try again.'
        );
      }
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        'Network error. Please check your internet connection and try again.'
      );
    } finally {
      dispatch(hideLoader());
    }
  }

  const handleTokenModalClose = () => {
    purchaseSheetRef.current?.close?.();
    setPendingFollowUserId(null);
  };

  const handleTokenPurchase = async () => {
    try {
      purchaseSheetRef.current?.close?.();
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || 'Token purchase failed',
      );
    } finally {
      dispatch(hideLoader());
      setPendingFollowUserId(null);
    }
  }

  const handleTokenSell = useCallback(() => {
    sellSheetRef.current?.close();
    showToastMessage(toast, 'success', 'Tokens sold successfully!');
    onRefresh();
  }, []);

  const renderKPICard = ({ item }) => {
    const isCreditsCard = item.title === 'Credits Left';
    const isClickable = isCreditsCard && item.currentCredits < 1;

    return (
      <TouchableOpacity
        style={[
          styles.kpiCard,
          isClickable && styles.kpiCardClickable // Optional: add visual feedback
        ]}
        onPress={isClickable ? handleBuyCredits : null}
        activeOpacity={isClickable ? 0.7 : 1}
        disabled={!isClickable}
      >
        <View style={styles.kpiHeader}>
          <Ionicons name={item.icon} size={24} color={item.color} />
          <Text style={styles.kpiTitle}>{item.title}</Text>
        </View>
        <Text style={styles.kpiValue}>{item.value}</Text>
        {/* {isClickable && (
          <Text style={styles.clickableHint}>Tap to buy more</Text>
        )} */}
      </TouchableOpacity>
    );
  };

  const renderActivity = ({ item }) => (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, {
        backgroundColor: item.type === 'buy' ? '#10b981' :
          item.type === 'sell' ? '#ef4444' :
            item.type === 'follow' ? '#3b82f6' : '#8b5cf6'
      }]}>
        <Ionicons
          name={item.type === 'buy' ? 'add' :
            item.type === 'sell' ? 'remove' :
              item.type === 'follow' ? 'people' : 'flash'}
          size={16}
          color="#fff"
        />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityAction}>{item.action}</Text>
        <Text style={styles.activityTime}>{item.time}</Text>
      </View>
    </View>
  );

  const renderWallet = ({ item }) => (
    <View style={styles.walletItem}>
      <View>
        <Text style={styles.walletChain}>
          {item.forPayment.charAt(0).toUpperCase() + item.forPayment.slice(1)}
        </Text>
        <Text style={styles.walletAddress}>{(item.stripeInvoiceId || '').trim().slice(0, 15) + '...'}
        </Text>
      </View>
      <View style={styles.walletRight}>
        <Text style={styles.walletBalance}>{item.amount}</Text>
        <View style={[styles.kycBadge, {
          backgroundColor: item.status === 'succeeded' ? '#dcfce7' : '#fef3c7'
        }]}>
          <Text style={[styles.kycText, {
            color: item.status === 'succeeded' ? '#166534' : '#92400e'
          }]}>
            {item.status}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderCreator = ({ item }) => (
    <TouchableOpacity style={styles.creatorItem} onPress={() => { setPendingFollowUserId(item.vendorId), setTimeout(() => purchaseSheetRef.current?.open?.(), 0); }}>
      <View style={styles.creatorAvatar}>
        <Text style={styles.avatarText}>{item.name.charAt(1).toUpperCase()}</Text>
      </View>
      <View style={styles.creatorInfo}>
        <View style={styles.creatorNameRow}>
          <Text style={styles.creatorName}>{item.name}</Text>
          {/* {item.verified && <Ionicons name="checkmark-circle" size={14} color="#5a2d82" />} */}
        </View>
        <Text style={styles.creatorPrice}>{item.price}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#5a2d82']}
            tintColor="#5a2d82"
            title="Pull to refresh"
            titleColor="#5a2d82"
          />
        }
      >
        {/* Header */}
        {/* <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Dashboard Overview</Text>
            <Text style={styles.headerSubtitle}>Welcome back! Here's what's happening with your account today.</Text>
          </View>
        </View> */}

        {/* KPI Cards */}
        <View style={styles.section}>
          <FlatList
            data={kpiData}
            renderItem={renderKPICard}
            keyExtractor={(item) => item.title}
            numColumns={2}
            columnWrapperStyle={styles.kpiRow}
            scrollEnabled={false}
          />
        </View>

        {/* Activity Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activity Overview</Text>
          </View>

          <View style={styles.periodSelector}>
            {['Weekly', 'Monthly', 'Yearly'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  activityPeriod === period && styles.periodButtonActive,
                ]}
                onPress={() => setActivityPeriod(period)}
              >
                <Text
                  style={[
                    styles.periodText,
                    activityPeriod === period && styles.periodTextActive,
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart with LineGraph */}
          <View style={styles.chartContainer}>
            <Text style={styles.chartPrice}>${selectedPrice.toFixed(2)}</Text>
            <Text style={styles.chartLabel}>Portfolio Value</Text>

            {priceHistory.length > 0 ? (
              <LineChart.Provider data={priceHistory}>
                <LineChart height={200} width={width - 72}>
                  <LineChart.Path color="#5a2d82" width={3}>
                    <LineChart.Gradient color="#5a2d82" />
                  </LineChart.Path>
                  <LineChart.CursorCrosshair
                    onActivated={() => hapticFeedback('impactLight')}
                    onEnded={() => resetPriceTitle()}
                  >
                    <LineChart.Tooltip>
                      {({ value }) => {
                        updatePriceTitle({ value });
                        return (
                          <View style={styles.tooltipContainer}>
                            <Text style={styles.tooltipText}>
                              ${value?.toFixed(2)}
                            </Text>
                          </View>
                        );
                      }}
                    </LineChart.Tooltip>
                    <LineChart.HoverTrap />
                  </LineChart.CursorCrosshair>
                </LineChart>
              </LineChart.Provider>
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
                <Text style={styles.emptyChartText}>No data available</Text>
                <Text style={styles.emptyChartSubtext}>Check back later for activity updates</Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>Recent Activities</Text>
          <View style={styles.activitiesContainer}>
            {recentActivities.length > 0 ? (
              <FlatList
                data={recentActivities}
                renderItem={renderActivity}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No recent activities</Text>
              </View>
            )}
          </View>
        </View>

        {/* My Wallets */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>My Wallets</Text>
          <View style={styles.walletsContainer}>
            <FlatList
              data={walletTransactions}
              renderItem={renderWallet}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
            />
            <Text style={styles.walletTip}>
              Tip: Convert followers into holders with Post Coins. Your monthly credits renew automatically.
            </Text>
          </View>
        </View>

        {/* Top Creators */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>Top Creators (Trending)</Text>
          <View style={styles.creatorsContainer}>
            {topCreators.length > 0 ? (
              <FlatList
                data={topCreators}
                renderItem={renderCreator}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No top creators available</Text>
              </View>
            )}
          </View>
        </View>

        {/* Token Purchase Modal */}
        <RBSheet
          ref={purchaseSheetRef}
          height={500}
          openDuration={250}
          draggable={true}
          closeOnPressMask={true}
          customModalProps={{ statusBarTranslucent: true }}
          onOpen={() => setPurchaseAutoFocus(true)}
          onClose={() => {
            Keyboard.dismiss();
            setPurchaseAutoFocus(false);
            setPendingFollowUserId(null);
          }}
          customStyles={{
            container: {
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              backgroundColor: '#f8f2fd',
              bottom: -30,
            },
            draggableIcon: {
              backgroundColor: '#ccc',
              width: 60,
            },
          }}
        >
          <TokenPurchaseModal
            onClose={handleTokenModalClose}
            onPurchase={handleTokenPurchase}
            hasFollowing={true}
            autoFocus={purchaseAutoFocus}
            vendorid={pendingFollowUserId}
          />
        </RBSheet>

        {/* Token Sell Modal */}
        <RBSheet
          ref={sellSheetRef}
          height={550}
          openDuration={250}
          draggable={true}
          closeOnPressMask={true}
          customModalProps={{ statusBarTranslucent: true }}
          onOpen={() => setPurchaseAutoFocus(true)}
          onClose={() => {
            Keyboard.dismiss();
            setPurchaseAutoFocus(false);
            setPendingFollowUserId(null);
          }}
          customStyles={{
            container: {
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              backgroundColor: '#f8f2fd',
              bottom: -30,
            },
            draggableIcon: {
              backgroundColor: '#ccc',
              width: 60,
            },
          }}
        >
          <TokenSellModal
            onSell={handleTokenSell}
            userId={pendingFollowUserId}
            tokenAddress={tokenAddress}
          />
        </RBSheet>

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
    marginBottom: Platform.OS == "ios" ? 60 : 0
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
    marginTop: Platform.OS == "ios" ? 20 : 0
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5a2d82',
  },
  // KPI Cards
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    flex: 1,
    marginHorizontal: 6,
  },
  kpiRow: {
    justifyContent: 'space-between',
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiTitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  kpiChange: {
    fontSize: 12,
    color: '#10b981',
  },
  // Activities
  activitiesContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
  },
  // Wallets
  walletsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  walletItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  walletChain: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  walletRight: {
    alignItems: 'flex-end',
  },
  walletBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  kycBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycText: {
    fontSize: 12,
    fontWeight: '600',
  },
  walletTip: {
    fontSize: 12,
    color: '#666',
    padding: 16,
    fontStyle: 'italic',
  },
  // Creators
  creatorsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  creatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#5a2d82',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginRight: 4,
  },
  creatorPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5a2d82',
  },
  creatorChange: {
    fontSize: 14,
    color: '#10b981',
    textAlign: 'right',
  },
  // Chart Container
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#5a2d82',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chartPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5a2d82',
    marginBottom: 4,
  },
  chartLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  tooltipContainer: {
    backgroundColor: '#5a2d82',
    padding: 8,
    borderRadius: 8,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptyChartSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  // Period Selector
  sectionHeader: {
    marginBottom: 5,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
    width: '100%',
    marginBottom: 10,
  },
  periodButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  periodButtonActive: {
    backgroundColor: '#5a2d82',
  },
  periodText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  periodTextActive: {
    color: '#fff',
  },
});

export default WalletDashboardScreen;