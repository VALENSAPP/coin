import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { LineChart } from 'react-native-wagmi-charts';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch } from 'react-redux';
import { getLatestTransactions, getRecentActivities, getTokenHistory, getTopCreators, getTotalTokenPurchase } from '../../services/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { getCreditsLeft, totalMission, totalSupport, totalamount, referPoints, metaMaskRecived, totalPoints, getTotalFollowers } from '../../services/wallet';
import { getUserCredentials, getUserDashboard } from '../../services/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RBSheet from 'react-native-raw-bottom-sheet';
import TokenPurchaseModal from '../../components/modals/TokenPurchaseModal';
import TokenSellModal from '../../components/modals/TokenSellModal';
import { useAppTheme } from '../../theme/useApptheme';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import { appKit } from '../../config/AppKitConfig';

const { width } = Dimensions.get('window');
const FALLBACK_AVATAR =
  'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const DEFAULT_REWARD_POINTS = {
  totalPlatformPoints: 0,
  totalBattlePoints: 0,
  referPoints: 0,
  used: 0,
};

/** UI label -> API `range` query (Swagger: daily | weekly). */
const FOLLOWERS_RANGE_BY_PERIOD = {
  Daily: 'daily',
  Weekly: 'weekly',
};

/** Map `user/followers-graph` response into LineChart points `{ timestamp, value }`. */
const mapFollowersGraphResponse = (response) => {
  const root = response?.data?.data ?? response?.data ?? response;
  const raw = Array.isArray(root?.points)
    ? root.points
    : Array.isArray(root)
      ? root
      : root?.graph ??
        root?.history ??
        root?.series ??
        root?.items ??
        (Array.isArray(root?.data) ? root.data : null);

  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  return raw
    .map((item, index) => {
      const dateStr =
        item?.date ??
        item?.label ??
        item?.day ??
        item?.time ??
        item?.createdAt;
      const val = Number(
        item?.followers ??
          item?.followerCount ??
          item?.count ??
          item?.newFollowers ??
          item?.total ??
          item?.value ??
          0,
      );
      let ts;
      if (dateStr != null && String(dateStr).length > 0) {
        ts = new Date(dateStr).getTime();
      } else if (typeof item?.timestamp === 'number') {
        ts = item.timestamp;
      } else {
        ts = Date.now() - (raw.length - 1 - index) * 86400000;
      }
      return {
        timestamp: ts,
        value: Number.isFinite(val) ? val : 0,
      };
    })
    .filter((p) => !isNaN(p.timestamp) && Number.isFinite(p.value))
    .sort((a, b) => a.timestamp - b.timestamp);
};

export const WalletDashboardScreen = ({ navigation }) => {
  const [activityPeriod, setActivityPeriod] = useState('Weekly'); // Daily | Weekly (matches API range)
  const [walletTransactions, setWalletTransactions] = useState(0);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivities, setRecentActivities] = useState(0);
  const [topCreators, setTopCreators] = useState([]);
  const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
  const [pendingFollowUserId, setPendingFollowUserId] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [tokenAddress, setTokenAddress] = useState(null);
  const [isBusinessProfile, setIsBusinessProfile] = useState(false);
  const [missionDonationTotal, setMissionDonationTotal] = useState(0);
  const [rewardSummary, setRewardSummary] = useState(DEFAULT_REWARD_POINTS);
  const [kpiData, setKpiData] = useState([
    { id: 'Total Earning', title: 'Total Earning', value: '-', icon: 'wallet', color: '#5a2d82' },
    { id: 'support', title: 'total support', value: '-', icon: 'logo-bitcoin', color: '#10b981' },
    { id: 'followers', title: 'Followers', value: '-', icon: 'people', color: '#f59e0b' },
    { id: 'credits', title: 'Credits Left', value: '-', icon: 'flash', color: '#ef4444', currentCredits: 5 },
    // { id: 'Active battles', title: 'Active battles', value: '-', icon: 'trophy', color: '#3b82f6' },
    { id: 'Mission Post', title: 'Mission Post', value: '-', icon: 'ribbon', color: '#8b5cf6' },
    { id: 'referralPoints', title: 'Referral Points', value: '-', icon: 'gift', color: '#14b8a6' },
    { id: 'metamask', title: 'MetaMask', value: '-', icon: 'logo-usd', color: '#f97316' },
  ]);
  const dispatch = useDispatch();
  const toast = useToast();
  const {
    openWalletConnect,
    isConnected: isWalletConnected,
    address: connectedWalletAddress,
  } = useWalletConnectSupport();
  const purchaseSheetRef = useRef(null);
  const sellSheetRef = useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();
  const [userWalletData, setUserWalletData] = useState({
    stripeCustomerId: '',
    walletAddress: '',
  });
  const [userProfile, setUserProfile] = useState({
    name: 'User',
    image: FALLBACK_AVATAR,
  });

  const loadProfileType = useCallback(async () => {
    try {
      const profileType = await AsyncStorage.getItem('profile');
      const normalized = String(profileType || '').toLowerCase();
      setIsBusinessProfile(normalized === 'company' || normalized === 'business');
    } catch (error) {
      console.error('Error loading profile type:', error);
      setIsBusinessProfile(false);
    }
  }, []);
  const formatPointValue = (value) => {
    const numericValue = Number(value) || 0;
    return numericValue.toLocaleString('en-US');
  };

  const rewardPointCards = useMemo(
    () => [
      {
        id: 'battlePoints',
        title: 'Battle Points',
        value: rewardSummary.totalBattlePoints,
        icon: 'trophy-outline',
        iconBackground: 'rgba(250, 204, 21, 0.16)',
        iconColor: '#facc15',
      },
      {
        id: 'referPoints',
        title: 'Refer Points',
        value: rewardSummary.referPoints,
        icon: 'gift-outline',
        iconBackground: 'rgba(34, 211, 238, 0.16)',
        iconColor: '#67e8f9',
      },
      {
        id: 'usedPoints',
        title: 'Used Points',
        value: rewardSummary.used,
        icon: 'remove-circle-outline',
        iconBackground: 'rgba(248, 113, 113, 0.16)',
        iconColor: '#fca5a5',
      },
    ],
    [rewardSummary]
  );

  const rewardPoints = async () => {
    try {
      const response = await totalPoints();

      const statusCode =
        response?.statusCode ??
        response?.data?.statusCode ??
        response?.status;
      const responseData =
        response?.data?.data ??
        response?.data ??
        DEFAULT_REWARD_POINTS;

      if (statusCode === 200) {
        setRewardSummary({
          totalPlatformPoints:
            Number(
              responseData?.totalPlatformPoints ??
              responseData?.platformPoints
            ) || 0,
          totalBattlePoints:
            Number(
              responseData?.totalBattlePoints ??
              responseData?.battlePoints
            ) || 0,
          referPoints:
            Number(
              responseData?.referPoints ??
              responseData?.referralPoints
            ) || 0,
          used:
            Number(
              responseData?.used ??
              responseData?.usedPoints
            ) || 0,
        });
        return;
      }

      setRewardSummary(DEFAULT_REWARD_POINTS);
    } catch (err) {
      console.log(err, 'erro in thi aposississsi');
      setRewardSummary(DEFAULT_REWARD_POINTS);
    }
  };

  const getUserDetail = async () => {
    try {
      const id = await AsyncStorage.getItem('userId');

      if (!id) {
        console.log('User ID not found');
        return;
      }

      const response = await getUserCredentials(id);

      console.log('API Response: data in thi apiaiaaiaiaai', response);
      setKyc(response?.data?.kycStatus || null);
      // 🔥 Adjust keys based on your API response
      const stripeCustomerId =
        response?.data?.stripeAccountId ||
        response?.data?.stripeCustomerId ||
        '';

      const walletAddress =
        response?.data?.walletAddress ||
        response?.data?.walletAddress ||
        '';

      // ✅ Save in state
      setUserWalletData({
        stripeCustomerId,
        walletAddress,
      });

      const profileName =
        response?.data?.userName ||
        response?.data?.username ||
        response?.data?.name ||
        'User';

      const profileImage =
        response?.data?.image ||
        response?.data?.userImage ||
        FALLBACK_AVATAR;

      setUserProfile({
        name: profileName,
        image: profileImage || FALLBACK_AVATAR,
      });

    } catch (error) {
      console.log('Error fetching user details:', error);
    }
  };

  const stripeAccountId = 'Not connected';
  const walletAddress = 'Not available';
  const visibleKpiData = useMemo(() => {
    if (isBusinessProfile) {
      return kpiData.filter(item => item.id !== 'support');
    }
    return kpiData;
  }, [kpiData, isBusinessProfile]);

  const kpiGridData = useMemo(() => {
    const list = [...visibleKpiData];
    if (list.length % 2 !== 0) {
      list.push({ id: 'kpi-placeholder', isPlaceholder: true });
    }
    return list;
  }, [visibleKpiData]);

  /** Profile header, KPI grid, Battle Points — same gradient */
  const walletScreenGradient = useMemo(
    () =>
      isBusinessProfile
        ? ['#D3B683', '#f8f2fd']
        : ['#513189', '#f8f2fd'],
    [isBusinessProfile],
  );

  const connectedWallet = useMemo(
    () =>
      String(
        connectedWalletAddress || userWalletData?.walletAddress || '',
      ).trim(),
    [connectedWalletAddress, userWalletData?.walletAddress],
  );
  const isMetaMaskConnected = isWalletConnected || !!connectedWallet;

  useEffect(() => {
    let timeout;

    const onKeyboardHide = () => {
      timeout = setTimeout(() => {
        // reset layout for both sheets
        purchaseSheetRef.current?.updateLayout?.({ height: 500 });
      }, 300); // wait until keyboard animation is done
    };

    const hideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);

    return () => {
      hideSub.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  // Replace the useFocusEffect and useCallback section with this:

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          dispatch(showLoader()); // Show loader once at the beginning

          await Promise.allSettled([
            // fetchAllTransaction(),
            // fetchDashboardData(),
            getUserDetail(),
            loadProfileType(),
            fetchCreditsLeft(),
            rewardPoints(),
            fetchFollowers(),
            fetchTotalSupport(),
            fetchTotalEarning(),
            fetchReferralPoints(),
            fetchMetaMaskReceived(),
            totalMissonDonation(),
            // fetchActivityOverview(),
            fetchTopCreators(),
            // fetchActivities(),
          ]);
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        } finally {
          dispatch(hideLoader()); // Hide loader once at the end
        }
      };

      fetchData();

      return () => {
        // Cleanup if needed
      };
    }, [dispatch, loadProfileType]) // Add dispatch to dependency array
  );

  // Remove the separate useEffect for activityPeriod
  // and replace with this one that properly triggers:
  // useEffect(() => {
  //   if (activityPeriod) {
  //     fetchActivityOverview();
  //   }
  // }, [activityPeriod]);

  // Update fetchAllData to remove the useCallback wrapper
  // const fetchAllData = async () => {
  //   await Promise.all([
  //     fetchAllTransaction(),
  //     fetchDashboardData(),
  //     fetchCreditsLeft(),
  //     fetchFollowers(),
  //     fetchActivityOverview(),
  //     fetchTopCreators(),
  //     fetchActivities(),
  //   ]);
  // };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      dispatch(showLoader());

      await Promise.allSettled([
        // fetchAllTransaction(),
        getUserDetail(),
        loadProfileType(),
        // fetchDashboardData(),
        getGraph(),
        fetchCreditsLeft(),
        rewardPoints(),
        fetchFollowers(),
        fetchTotalSupport(),
        fetchTotalEarning(),
        fetchReferralPoints(),
        fetchMetaMaskReceived(),
        // fetchActivityOverview(),
        fetchTopCreators(),
        // fetchActivities(),
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      dispatch(hideLoader());
      setRefreshing(false);
    }
  };

  const handleDisconnectWallet = useCallback(async () => {
    try {
      await appKit?.disconnect?.();
      await AsyncStorage.multiRemove(['walletAddress', 'walletChainId', 'walletType']);
      setUserWalletData((prev) => ({ ...prev, walletAddress: '' }));
      showToastMessage(toast, 'success', 'Wallet disconnected');
    } catch (error) {
      showToastMessage(toast, 'danger', 'Unable to disconnect wallet');
    }
  }, [toast]);

  const handleMetaMaskCardPress = useCallback(() => {
    if (isMetaMaskConnected) {
      Alert.alert(
        'Disconnect wallet',
        'Do you want to disconnect your wallet?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: handleDisconnectWallet,
          },
        ],
      );
      return;
    }
    openWalletConnect();
  }, [handleDisconnectWallet, isMetaMaskConnected, openWalletConnect]);

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

  //   const fetchDashboardData = async () => {
  //   const storedPrice = await AsyncStorage.getItem('priceInUsd');
  //   try {
  //     const response = await getTotalTokenPurchase();

  //     console.log('getTotalTokenPurchasegetTotalTokenPurchase',response)
  //     if (response?.statusCode === 200) {
  //       const totalPortfolioValue = response.data.reduce(
  //         (sum, item) => sum + (item.totalTokenAmount || 0),
  //         0
  //       );
  //       console.log("portfolio value----------------", totalPortfolioValue);
  //       setKpiData(prevKpiData => {
  //         const newKpiData = [...prevKpiData];
  //         newKpiData[0] = {
  //           ...newKpiData[0],
  //           value: `$ ${totalPortfolioValue.toFixed(4)}`
  //         };
  //         newKpiData[1] = {
  //           ...newKpiData[1],
  //           value: `$ ${Number(storedPrice).toFixed(4)}`
  //         };
  //         return newKpiData;
  //       });
  //     } else {
  //       showToastMessage(toast, 'danger', response?.message);
  //     }
  //   } catch (error) {
  //     console.error('Error in fetchDashboardData:', error);
  //   }
  // };

  // const fetchAllTransaction = async () => {
  //   try {
  //     const response = await getLatestTransactions();
  //     if (response?.statusCode === 200) {
  //       setWalletTransactions(response.data.transactions);
  //     } else {
  //       showToastMessage(toast, 'danger', response.data.message);
  //     }
  //   } catch (error) {
  //     console.error('Error in fetchAllTransaction:', error);
  //   }
  // };

  const fetchCreditsLeft = async () => {
    try {
      const response = await getCreditsLeft();
      console.log(response, 'credits left')
      if (response?.statusCode === 200) {
        const hitLeftRaw = response?.data?.hitLeft;
        const hitLeft = Number(hitLeftRaw);
        const safeHitLeft = Number.isFinite(hitLeft) ? Math.min(Math.max(hitLeft, 0), 5) : 0;
        setKpiData(prevKpiData => {
          const newKpiData = [...prevKpiData];
          newKpiData[3] = {
            ...newKpiData[3],
            value: `${hitLeft} / 5`,
            currentCredits: hitLeft
          };
          return newKpiData;
        });
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      console.error('Error in fetchCreditsLeft:', error);
    }
  };
  const getGraph = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.log('User ID not found for followers graph');
        setPriceHistory([]);
        setSelectedPrice(0);
        return;
      }
      const range =
        FOLLOWERS_RANGE_BY_PERIOD[activityPeriod] ?? 'weekly';
      const response = await getTotalFollowers({ userId, range });
      const points = mapFollowersGraphResponse(response);
      if (points.length > 0) {
        setPriceHistory(points);
        setSelectedPrice(points[points.length - 1].value);
      } else {
        setPriceHistory([]);
        setSelectedPrice(0);
      }
    } catch (error) {
      console.error('error in graph api', error);
      setPriceHistory([]);
      setSelectedPrice(0);
    }
  }, [activityPeriod]);

  useEffect(() => {
    getGraph();
  }, [getGraph]);

  //   const fetchActivityOverview = async () => {
  //   const getTokenAddress = await AsyncStorage.getItem('PlatFormToken');

  //   const periodMap = {
  //     'Weekly': 'week',
  //     'Monthly': 'month',
  //     'Yearly': 'year'
  //   };

  //   try {
  //     const response = await getTokenHistory(getTokenAddress, periodMap[activityPeriod]);

  //     if (response?.statusCode === 200) {
  //       if (response.data.history && Array.isArray(response.data.history)) {
  //         // Sort by date first
  //         const sortedHistory = [...response.data.history].sort(
  //           (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  //         );

  //         // Use balanceAfter to show actual portfolio value over time
  //         const formattedData = sortedHistory.map(item => ({
  //           timestamp: new Date(item.date).getTime(),
  //           value: parseFloat(item.balanceAfter || 0) // Use balanceAfter instead of amount
  //         })).filter(item => !isNaN(item.value) && !isNaN(item.timestamp));

  //         if (formattedData.length > 0) {
  //           setPriceHistory(formattedData);
  //           setSelectedPrice(formattedData[formattedData.length - 1].value);
  //         } else {
  //           setPriceHistory([]);
  //           setSelectedPrice(0);
  //         }
  //       } else {
  //         setPriceHistory([]);
  //         setSelectedPrice(0);
  //       }
  //     } else {
  //       showToastMessage(toast, 'danger', response.data.message);
  //       setPriceHistory([]);
  //       setSelectedPrice(0);
  //     }
  //   } catch (error) {
  //     console.error('Error in fetchActivityOverview:', error);
  //     setPriceHistory([]);
  //     setSelectedPrice(0);
  //   }
  // };

  const fetchFollowers = async () => {
    const id = await AsyncStorage.getItem('userId');
    try {
      const response = await getUserDashboard(id);
      if (response?.statusCode === 200) {
        setKpiData(prevKpiData => {
          return prevKpiData.map(item => {
            if (item.id === 'followers') {
              return {
                ...item,
                value: response.data.dashboardData.totalFollowers.toString() || '0',
              };
            }
            return item;
          });
        });
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      console.error('Error in fetchFollowers:', error);
    }
  };

  const fetchTotalSupport = async () => {
    try {
      const response = await totalSupport();
      console.log(response, 'data in total support ')
      const rawValue =
        response?.data?.totalAmount ??
        response?.data?.data?.totalAmount ??
        response?.data?.totalSupportReceived ??
        response?.data?.totalSupport ??
        response?.data?.supportedAmount ??
        response?.data?.amount ??
        0;
      const supportAmount = Number(rawValue) || 0;

      setKpiData(prevKpiData =>
        prevKpiData.map(item =>
          item.id === 'support'
            ? { ...item, value: `$ ${supportAmount.toFixed(2)}` }
            : item
        )
      );
    } catch (error) {
      console.error('Error in fetchTotalSupport:', error);
    }
  };
  const fetchTotalEarning = async () => {
    try {
      const response = await totalamount();
      const rawValue =
        response?.data?.totalAmount ??
        response?.data?.data?.totalAmount ??
        response?.data?.amount ??
        response?.data?.data?.amount ??
        0;
      const totalValue = Number(rawValue) || 0;

      setKpiData(prevKpiData =>
        prevKpiData.map(item =>
          item.id === 'Total Earning'
            ? { ...item, value: `$ ${totalValue.toFixed(2)}` }
            : item
        )
      );
    } catch (error) {
      console.error('Error in fetchTotalEarning:', error);
    }
  };
  const fetchReferralPoints = async () => {
    try {
      const response = await referPoints();
      const rawValue =
        response?.data?.referPoints ??
        response?.data?.referralPoints ??
        response?.data?.referPoint ??
        response?.data?.data?.referPoints ??
        response?.data?.data?.referralPoints ??
        response?.data?.data?.referPoint ??
        response?.data?.points ??
        response?.data?.data?.points ??
        0;
      const pointsValue = Number(rawValue) || 0;

      setKpiData(prevKpiData =>
        prevKpiData.map(item =>
          item.id === 'referralPoints'
            ? { ...item, value: `${pointsValue} pts` }
            : item
        )
      );
    } catch (error) {
      console.error('Error in fetchReferralPoints:', error);
    }
  };
  const fetchMetaMaskReceived = async () => {
    try {
      const response = await metaMaskRecived();
      const rawValue =
        response?.data?.totalAmount ??
        response?.data?.data?.totalAmount ??
        response?.data?.amount ??
        response?.data?.data?.amount ??
        0;
      const totalValue = Number(rawValue) || 0;

      setKpiData(prevKpiData =>
        prevKpiData.map(item =>
          item.id === 'metamask'
            ? { ...item, value: `$ ${totalValue.toFixed(2)}` }
            : item
        )
      );
    } catch (error) {
      console.error('Error in fetchMetaMaskReceived:', error);
    }
  };
  const totalMissonDonation = async () => {
    try {
      const response = await totalMission();
      const totalAmount = Number(response?.data?.totalAmount || 0);

      // ✅ Update local state (optional)
      setMissionDonationTotal(totalAmount);

      // ✅ UPDATE KPI CARD
      setKpiData(prevKpiData =>
        prevKpiData.map(item =>
          item.id === 'Mission Post'
            ? { ...item, value: `$ ${totalAmount.toFixed(2)}` }
            : item
        )
      );

    } catch (error) {
      console.log(error, "Error in total mission API");
    }
  };


  const fetchTopCreators = async () => {
    try {
      const response = await getTopCreators();
      if (response?.statusCode === 200) {
        console.log('Top creators', response.data);

        const formattedCreators = response.data.map((creator, index) => ({
          id: index + 1,
          name: `@${creator.username || 'unknown'}`,
          vendorId: creator.vendorId,
          followers: `${creator.followerCount || '0'} Followers`,
          tokenStatus: creator.currentTokenStatus,
        }));
        setTopCreators(formattedCreators.slice(0, 5));
      } else {
        showToastMessage(toast, 'danger', response.data.message);
      }
    } catch (error) {
      console.error('Error in fetchTopCreators:', error);
    }
  };

  //   const fetchActivities = async () => {
  //   try {
  //     const response = await getRecentActivities();
  //     if (response?.statusCode === 200) {
  //       console.log('Recent activities', response.data);

  //       const formattedActivities = [];
  //       let activityId = 1;

  //       if (response.data.activities) {
  //         const activities = response.data.activities;

  //         if (activities.purchase && Array.isArray(activities.purchase)) {
  //           activities.purchase.forEach(purchase => {
  //             formattedActivities.push({
  //               id: activityId++,
  //               action: `@${purchase.username || 'Unknown'} bought ${purchase.tokensReceived || 0} tokens`,
  //               time: formatTime(purchase.createdAt),
  //               type: 'buy',
  //               createdAt: new Date(purchase.createdAt).getTime(),
  //               rawData: purchase
  //             });
  //           });
  //         }

  //         if (activities.sell && Array.isArray(activities.sell)) {
  //           activities.sell.forEach(sell => {
  //             formattedActivities.push({
  //               id: activityId++,
  //               action: `@${sell.username || 'Unknown'} sold ${sell.amountTokens || 0} tokens`,
  //               time: formatTime(sell.createdAt),
  //               type: 'sell',
  //               createdAt: new Date(sell.createdAt).getTime(),
  //               rawData: sell
  //             });
  //           });
  //         }

  //         if (activities.following && Array.isArray(activities.following)) {
  //           activities.following.forEach(follow => {
  //             formattedActivities.push({
  //               id: activityId++,
  //               action: `${follow.followerName || 'Someone'} followed you`,
  //               time: formatTime(follow.createdAt),
  //               type: 'follow',
  //               createdAt: new Date(follow.createdAt).getTime(),
  //               rawData: follow
  //             });
  //           });
  //         }
  //       }

  //       formattedActivities.sort((a, b) => b.createdAt - a.createdAt);

  //       formattedActivities.forEach((activity, index) => {
  //         activity.id = index + 1;
  //       });

  //       setRecentActivities(formattedActivities.slice(0, 6));
  //     } else {
  //       showToastMessage(toast, 'danger', response.data.message);
  //     }
  //   } catch (error) {
  //     console.error('Error in fetchActivities:', error);
  //   }
  // }

  const handleTokenModalClose = () => {
    purchaseSheetRef.current?.close?.();
    setPendingFollowUserId(null);
  };

  const handleTokenPurchase = async () => {
    // try {
    //   purchaseSheetRef.current?.close?.();
    // } catch (error) {
    //   showToastMessage(
    //     toast,
    //     'danger',
    //     error?.message || 'Token purchase failed',
    //   );
    // } finally {
    //   dispatch(hideLoader());
    //   setPendingFollowUserId(null);
    // }
  }

  const handleTokenSell = useCallback(() => {
    // sellSheetRef.current?.close();
    showToastMessage(toast, 'success', 'Tokens sold successfully!');
    onRefresh();
  }, []);

  const renderKPICard = ({ item }) => {
    if (item?.isPlaceholder) {
      return <View style={[styles.kpiCard, styles.kpiCardPlaceholder]} />;
    }

    const onDarkGradient = !isBusinessProfile;
    const kpiTitleColor = onDarkGradient
      ? 'rgba(255,255,255,0.92)'
      : 'rgba(42,27,61,0.85)';
    const kpiValueColor = onDarkGradient ? '#ffffff' : '#2a1b3d';

    const isMetaMaskCard = item.id === 'metamask';
    const metaStatusText = isMetaMaskConnected ? 'Connected' : 'Disconnected';
    const metaActionText = isMetaMaskConnected ? 'Tap to disconnect' : 'Tap to connect';

    const cardContent = (
      <LinearGradient
        colors={walletScreenGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.kpiCard,
          isMetaMaskCard && styles.kpiCardNoOuterSpacing,
          isMetaMaskCard && styles.kpiCardFillTouchable,
          { shadowColor: text },
        ]}
      >
        <View style={styles.kpiHeader}>
          <Ionicons name={item.icon} size={24} color={item.color} />
          <Text style={[styles.kpiTitle, { color: kpiTitleColor }]} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
        <Text style={[styles.kpiValue, { color: kpiValueColor }]} numberOfLines={2}>
          {item.value}
        </Text>
        {isMetaMaskCard ? (
          <Text
            style={[
              styles.kpiMetaSingleLine,
              isMetaMaskConnected ? styles.kpiMetaConnected : styles.kpiMetaDisconnected,
            ]}
            numberOfLines={2}
          >
            {metaStatusText} · {metaActionText}
          </Text>
        ) : null}
      </LinearGradient>
    );

    if (isMetaMaskCard) {
      return (
        <TouchableOpacity
          style={styles.kpiCardTouchable}
          activeOpacity={0.86}
          onPress={handleMetaMaskCardPress}
        >
          {cardContent}
        </TouchableOpacity>
      );
    }

    return cardContent;
  };

  // const renderActivity = ({ item }) => (
  //   <View style={styles.activityItem}>
  //     <View style={[styles.activityIcon, {
  //       backgroundColor: item.type === 'buy' ? '#10b981' :
  //         item.type === 'sell' ? '#ef4444' :
  //           item.type === 'follow' ? '#3b82f6' : '#8b5cf6'
  //     }]}>
  //       <Ionicons
  //         name={item.type === 'buy' ? 'add' :
  //           item.type === 'sell' ? 'remove' :
  //             item.type === 'follow' ? 'people' : 'flash'}
  //         size={16}
  //         color="#fff"
  //       />
  //     </View>
  //     <View style={styles.activityContent}>
  //       <Text style={styles.activityAction}>{item.action}</Text>
  //       <Text style={styles.activityTime}>{item.time}</Text>
  //     </View>
  //   </View>
  // );

  // const renderWallet = ({ item }) => (
  //   <View style={styles.walletItem}>
  //     <View>
  //       <Text style={styles.walletChain}>
  //         {item.forPayment.charAt(0).toUpperCase() + item.forPayment.slice(1)}
  //       </Text>
  //       <Text style={styles.walletAddress}>{(item.stripeInvoiceId || '').trim().slice(0, 15) + '...'}
  //       </Text>
  //     </View>
  //     <View style={styles.walletRight}>
  //       <Text style={styles.walletBalance}>{item.amount}</Text>
  //       <View style={[styles.kycBadge, {
  //         backgroundColor: item.status === 'succeeded' ? '#dcfce7' : '#fef3c7'
  //       }]}>
  //         <Text style={[styles.kycText, {
  //           color: item.status === 'succeeded' ? '#166534' : '#92400e'
  //         }]}>
  //           {item.status}
  //         </Text>
  //       </View>
  //     </View>
  //   </View>
  // );

  // const renderCreator = ({ item }) => (
  //   <TouchableOpacity
  //     style={styles.creatorItem}
  //     onPress={() => {
  //       setPendingFollowUserId(item.vendorId);
  //       setTimeout(() => purchaseSheetRef.current?.open?.(), 0);
  //     }}
  //   >
  //     <View style={[styles.creatorAvatar, { backgroundColor: text }]}>
  //       <Text style={styles.avatarText}>{item.name.charAt(1).toUpperCase()}</Text>
  //     </View>
  //     <View style={styles.creatorInfo}>
  //       <Text style={styles.creatorName}>{item.name}</Text>
  //       <Text style={[styles.creatorPrice, textStyle]}>{item.followers}</Text>
  //     </View>
  //     {/* Arrow indicator at the end */}
  //     <View style={styles.arrowContainer}>
  //       {item.tokenStatus === 'high' && (
  //         <Ionicons name="arrow-up" size={20} color="#22c55e" />
  //       )}
  //       {item.tokenStatus === 'low' && (
  //         <Ionicons name="arrow-down" size={20} color="#ef4444" />
  //       )}
  //     </View>
  //   </TouchableOpacity>
  // );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[text]}
            tintColor={text}
            title="Pull to refresh"
            titleColor={text}
          />
        }
      >
        {/* Header — same gradient as KPI + Battle Points */}
        <View style={styles.header}>
          <LinearGradient
            colors={walletScreenGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <View style={styles.headerGlow} />
            <View style={styles.headerRow}>
              <View style={styles.headerAvatarWrap}>
                <HexAvatar
                  uri={userProfile.image || FALLBACK_AVATAR}
                  size={72}
                  borderWidth={3}
                  borderColor="rgba(255,255,255,0.45)"
                />
              </View>
              <View style={styles.headerText}>
                <Text
                  style={[
                    styles.headerName,
                    isBusinessProfile ? { color: '#2a1b3d' } : { color: '#fef3c7' },
                  ]}
                  numberOfLines={1}
                >
                  @{userProfile.name || 'User'}
                </Text>
                {kyc === 'verified' && (
                <View style={styles.headerStatus}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={isBusinessProfile ? '#5a2d82' : '#fef3c7'}
                  />
                  <Text
                    style={[
                      styles.headerStatusText,
                      isBusinessProfile
                        ? { color: 'rgba(42,27,61,0.85)' }
                        : { color: '#f9fafb' },
                    ]}
                  >
                    Verified
                  </Text>
                </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* KPI Cards */}
        <View style={styles.section}>
          <FlatList
            data={kpiGridData}
            renderItem={renderKPICard}
            keyExtractor={(item) => item.id || item.title}
            numColumns={2}
            columnWrapperStyle={styles.kpiRow}
            scrollEnabled={false}
          />
        </View>
        <View style={[styles.section, { marginBottom: 10 }]}>
          <Text style={[styles.sectionTitle, styles.pointsSectionTitle, textStyle]}>
            Battle Points
          </Text>
          <LinearGradient
            colors={walletScreenGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pointsCard}
          >
            <View style={styles.pointsGlow} />

            <Text
              style={[
                styles.pointsLabel,
                isBusinessProfile
                  ? { color: 'rgba(42,27,61,0.75)' }
                  : { color: 'rgba(255,255,255,0.92)' },
              ]}
            >
              Total Platform Points
            </Text>
            <Text
              style={[
                styles.pointsValue,
                isBusinessProfile ? { color: '#2a1b3d' } : { color: '#fff' },
              ]}
            >
              {formatPointValue(rewardSummary.totalPlatformPoints)}
            </Text>
            {/* <Text style={styles.pointsSubtext}>
              Your battle, referral, and used points are synced here from the
              wallet API.
            </Text> */}

            <View style={styles.pointsBreakdownRow}>
              {rewardPointCards.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.pointsBreakdownCard,
                    isBusinessProfile
                      ? styles.pointsBreakdownCardBiz
                      : styles.pointsBreakdownCardUser,
                  ]}
                >
                  <View
                    style={[
                      styles.pointsBreakdownIcon,
                      { backgroundColor: item.iconBackground },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={item.iconColor}
                    />
                  </View>
                  <Text
                    style={[
                      styles.pointsBreakdownValue,
                      isBusinessProfile
                        ? { color: '#2a1b3d' }
                        : { color: '#5a2d82' },
                    ]}
                  >
                    {formatPointValue(item.value)}
                  </Text>
                  <Text
                    style={[
                      styles.pointsBreakdownLabel,
                      isBusinessProfile
                        ? { color: 'rgba(42,27,61,0.75)' }
                        : { color: 'rgba(90,45,130,0.88)' },
                    ]}
                  >
                    {item.title}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Activity Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, textStyle]}>Activity Overview</Text>
          </View>

          <View style={styles.periodSelector}>
            {['Daily', 'Weekly'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  activityPeriod === period && { backgroundColor: text },
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
          <View style={[styles.chartContainer, { shadowColor: text }]}>
            <Text style={[styles.chartPrice, textStyle]}>
              {Number.isFinite(Number(selectedPrice))
                ? Math.round(Number(selectedPrice)).toLocaleString()
                : '0'}
            </Text>
            <Text style={styles.chartLabel}>Followers</Text>

            {priceHistory.length > 0 ? (
              <LineChart.Provider data={priceHistory}>
                <LineChart height={200} width={width - 72}>
                  <LineChart.Path color={text} width={3}>
                    <LineChart.Gradient color={text} />
                  </LineChart.Path>
                  <LineChart.CursorCrosshair
                    onActivated={() => hapticFeedback('impactLight')}
                    onEnded={() => resetPriceTitle()}
                  >
                    <LineChart.Tooltip>
                      {({ value }) => {
                        updatePriceTitle({ value });
                        return (
                          <View style={[styles.tooltipContainer, { backgroundColor: text }]}>
                            <Text style={styles.tooltipText}>
                              {Number.isFinite(Number(value))
                                ? Math.round(Number(value)).toLocaleString()
                                : '—'}
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
        {/* <View style={styles.section}>
          <Text style={[styles.sectionTitle, textStyle, { marginBottom: 5 }]}>Recent Activities</Text>
          <View style={[styles.activitiesContainer, { shadowColor: text }]}>
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
        </View> */}

        {/* My Wallets */}
        {/* <View style={styles.section}>
          <Text style={[styles.sectionTitle, textStyle, { marginBottom: 5 }]}>My Wallets</Text>
          <View style={[styles.walletsContainer, { shadowColor: text }]}> */}
        {/* <FlatList
              data={walletTransactions}
              renderItem={renderWallet}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
            // /> */}
        {/* // <Text style={styles.walletTip}>
            //   Tip: Convert followers into holders with Post Coins. Your monthly credits renew automatically.
            // </Text> */}
        {/* <View style={styles.walletInfoBox}>
              <Text style={styles.walletLabel}>Stripe Account ID</Text>
              <Text style={styles.walletValue}> {userWalletData.stripeCustomerId || 'Not Connected'}</Text>
            </View>
            <View style={styles.walletInfoBox}>
              <Text style={styles.walletLabel}>Wallet Address</Text>
              <Text style={styles.walletValue}> {userWalletData.walletAddress || 'Not Available'}</Text>
            </View>
          </View>
        </View> */}

        {/* Top Creators */}
        {/* <View style={styles.section}>
          <Text style={[styles.sectionTitle, textStyle, { marginBottom: 5 }]}>Top Creators (Trending)</Text>
          <View style={[styles.creatorsContainer, { shadowColor: text }]}>
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
        </View> */}

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
            container: [{
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              bottom: -30,
            }, bgStyle],
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
            container: [{
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              bottom: -30,
            }, bgStyle],
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
    // paddingTop: 20,
    paddingBottom: 40,
    marginBottom: Platform.OS == "ios" ? 60 : 0
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: -12
  },
  headerCard: {
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    width: 180,
    height: 120,
    borderRadius: 80,
    top: -20,
    right: -40,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 10
  },
  headerAvatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    color: '#fef3c7',
    fontSize: 18,
    fontWeight: '700',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  headerStatusText: {
    color: '#f9fafb',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  pointsSectionTitle: {
    marginBottom: 8,
  },
  battleMissionRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  battleCard: {
    width: '48%',
    minHeight: 210,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  missionCard: {
    width: '48%',
    minHeight: 210,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 14,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b1a4f',
  },
  livePill: {
    backgroundColor: '#f5e1f7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  livePillSmall: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 6,
  },
  livePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },
  battleBanner: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  battleBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  battleBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  battleBannerSub: {
    color: '#f3e8ff',
    fontSize: 12,
    marginTop: 4,
  },
  battleAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  battleAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  battleDelta: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  battleBannerFoot: {
    color: '#e9d5ff',
    fontSize: 11,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b5a84',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2a1b3d',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValueGreen: {
    color: '#22c55e',
  },
  monthPill: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },
  missionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  missionMainValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2a1b3d',
  },
  missionSub: {
    fontSize: 12,
    color: '#6b5a84',
    marginTop: 2,
  },
  missionRight: {
    alignItems: 'flex-end',
  },
  missionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2a1b3d',
  },
  missionDelta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
    marginTop: 2,
  },
  primaryButton: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pointsCard: {
    borderRadius: 24,
    padding: 2,
    overflow: 'hidden',
    elevation: 6,
  },
  pointsGlow: {
    position: 'absolute',
    width: 180,
    height: 120,
    borderRadius: 80,
    top: -24,
    right: -40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  pointsOverline: {
    fontSize: 12,
    color: '#ddd6fe',
    marginBottom: 4,
    fontWeight: '600',
  },
  pointsUserName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  pointsLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pointsLiveText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#fef3c7',
  },
  pointsLabel: {
    fontSize: 13,
    color: '#e9d5ff',
    marginBottom: 4,
    fontWeight: '500',
    paddingHorizontal: 16,
    marginTop: 16
  },
  pointsValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    paddingHorizontal: 16,
  },
  pointsSubtext: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 18,
    color: '#f3e8ff',
  },
  pointsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 16,
    marginBottom: 16
  },
  pointsBreakdownCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 14,
    marginBottom: 0,
    alignItems: 'center',
  },
  pointsBreakdownCardUser: {
    backgroundColor: 'rgba(90,45,130,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(90,45,130,0.18)',
  },
  pointsBreakdownCardBiz: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(42,27,61,0.1)',
  },
  pointsBreakdownIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pointsBreakdownValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  pointsBreakdownLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  // KPI Cards
  kpiCard: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    flex: 1,
    marginHorizontal: 6,
    alignSelf: 'stretch',
    minHeight: 132,
    justifyContent: 'flex-start',
  },
  kpiCardNoOuterSpacing: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
  kpiCardFillTouchable: {
    flexGrow: 1,
  },
  kpiCardTouchable: {
    flex: 1,
    marginHorizontal: 6,
    marginBottom: 12,
    alignSelf: 'stretch',
    minHeight: 132,
  },
  kpiCardPlaceholder: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  kpiRow: {
    justifyContent: 'space-between',
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16
  },
  kpiTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    textTransform: 'capitalize',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
    padding: 16
  },
  kpiMetaSingleLine: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    opacity: 0.95,
    padding: 16
  },
  kpiMetaConnected: {
    color: '#16a34a',
  },
  kpiMetaDisconnected: {
    color: '#b45309',
  },
  kpiChange: {
    fontSize: 12,
    color: '#10b981',
  },
  // Activities
  activitiesContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
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
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  chartPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chartLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  tooltipContainer: {
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
  walletInfoBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },

  walletLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },

  walletValue: {
    fontSize: 14,
    color: '#0f0a0a',
    fontWeight: '600',
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
  periodText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  periodTextActive: {
    color: '#fff',
  },
  emptyState: {
    padding: 10
  },
  emptyStateText: {
    fontSize: 18,
    color: '#000'
  }
});

export default WalletDashboardScreen;
