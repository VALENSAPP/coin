import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  RefreshControl,
  Linking,
  Alert,
  Modal,
  Pressable,
  Platform,
  Keyboard,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import ImageZoom from 'react-native-image-pan-zoom';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useDispatch, useSelector } from 'react-redux';
import { getLatestTransactions, getRecentActivities, getTokenHistory, getTopCreators, getTotalTokenPurchase } from '../../services/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { getCreditsLeft, totalMission, totalSupport, totalamount, referPoints, metaMaskRecived, totalPoints, getTotalFollowers, subscriptionEarningGraph } from '../../services/wallet';
import { getUserCredentials, getUserDashboard } from '../../services/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RBSheet from 'react-native-raw-bottom-sheet';
import TokenPurchaseModal from '../../components/modals/TokenPurchaseModal';
import TokenSellModal from '../../components/modals/TokenSellModal';
import { useAppTheme } from '../../theme/useApptheme';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useWalletConnectSupport } from '../../context/WalletConnectSupportContext';
import { appKit } from '../../config/AppKitConfig';
import { getDragonflyIcon } from '../../components/profile/ProfilePersonalData';
import MIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  WhiteDragonfly,
  BlueDragonfly,
  SoftGrayDragonfly,
  LilacDragonfly,
  GoldDragonfly,
  GoldLavenderDragonfly,
  LavenderDragonfly,
  Metamask,
} from '../../assets/icons';
import Svg, { Polygon, Path, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useLanguage } from '../../i18n';

const { width, height } = Dimensions.get('window');
const KPI_GRID_GAP = 12;
const AVATAR_PREVIEW_SIZE = Math.min(width * 0.9, 340);
const FALLBACK_AVATAR =
  'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const DEFAULT_REWARD_POINTS = {
  totalPlatformPoints: 0,
  totalBattlePoints: 0,
  referPoints: 0,
  used: 0,
};

const WALLET_ICON_BY_TYPE = {
  metamask: require('../../assets/icons/pngicons/Emeta.png'),
  coinbase: require('../../assets/icons/pngicons/coin.png'),
  walletconnect: require('../../assets/icons/pngicons/EWallet.png'),
  wallet: require('../../assets/icons/pngicons/EWallet.png'),
};

const DRAGONFLY_TIERS = (t) => [
  {
    id: 'white',
    Icon: WhiteDragonfly,
    title: t('walletDashboard.dragonflyTiers.white.title'),
    range: t('walletDashboard.dragonflyTiers.white.range'),
    note: t('walletDashboard.dragonflyTiers.white.note'),
    color: '#ffffff',
  },
  {
    id: 'black',
    Icon: BlueDragonfly,
    title: t('walletDashboard.dragonflyTiers.black.title'),
    range: t('walletDashboard.dragonflyTiers.black.range'),
    note: t('walletDashboard.dragonflyTiers.black.note'),
    color: '#000000',
  },
  {
    id: 'silver',
    Icon: SoftGrayDragonfly,
    title: t('walletDashboard.dragonflyTiers.silver.title'),
    range: t('walletDashboard.dragonflyTiers.silver.range'),
    note: t('walletDashboard.dragonflyTiers.silver.note'),
    color: '#c0c0c0',
  },
  {
    id: 'gold',
    Icon: GoldDragonfly,
    title: t('walletDashboard.dragonflyTiers.gold.title'),
    range: t('walletDashboard.dragonflyTiers.gold.range'),
    note: t('walletDashboard.dragonflyTiers.gold.note'),
    color: '#ffd700',
  },
  {
    id: 'purple',
    Icon: LavenderDragonfly,
    title: t('walletDashboard.dragonflyTiers.purple.title'),
    range: t('walletDashboard.dragonflyTiers.purple.range'),
    note: t('walletDashboard.dragonflyTiers.purple.note'),
    color: '#800080',
  },
];

/** UI label -> API `range` query (Swagger: daily | weekly). */
const FOLLOWERS_RANGE_BY_PERIOD = {
  Daily: 'daily',
  Weekly: 'weekly',
};

const pad2 = value => String(value).padStart(2, '0');

const formatActivityBucketLabel = (timestamp, range) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  if (range === 'daily') {
    return `${pad2(date.getHours())}:00`;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const normalizeActivityTimestamp = (timestamp, range) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return NaN;
  if (range === 'daily') {
    date.setMinutes(0, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
};

const parseApiTimestamp = (value) => {
  if (value == null || String(value).length === 0) return NaN;
  if (typeof value === 'number') return value;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  return new Date(raw).getTime();
};

const resolveActivityTimestamp = (item, index, raw, range) => {
  const dateStr =
    item?.timestamp ??
    item?.createdAt ??
    item?.time ??
    item?.date ??
    item?.day ??
    item?.weekStart ??
    item?.month;
  if (dateStr != null && String(dateStr).length > 0) {
    const ts = parseApiTimestamp(dateStr);
    if (Number.isFinite(ts)) return normalizeActivityTimestamp(ts, range);
  }

  if (range === 'daily' && item?.label && /^\d{1,2}:\d{2}$/.test(String(item.label))) {
    const [hour, minute] = String(item.label).split(':').map(Number);
    const fallback = new Date();
    fallback.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0);
    return fallback.getTime();
  }

  return Date.now() - (raw.length - 1 - index) * (range === 'daily' ? 3600000 : 86400000);
};

const resolveActivityLabel = (item, timestamp, range) => {
  const label = String(item?.label || '').trim();
  if (label) return label;
  return formatActivityBucketLabel(timestamp, range);
};

const HexStarIcon = ({ size = 36, starSize = 16, starColor = '#ffffff', bgColor = '#5a2d82' }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Polygon points={points} fill={bgColor} />
      </Svg>
      <Ionicons name="star" size={starSize} color={starColor} style={{ zIndex: 1 }} />
    </View>
  );
};
/** Subscription / support earnings graph → `{ timestamp, value }[]` */
const mapSubscriptionGraphPoints = (response, range = 'weekly') => {
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

  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .map((item, index) => {
      const val = Number(
        item?.amount ??
        item?.earning ??
        item?.revenue ??
        item?.totalAmount ??
        item?.value ??
        item?.count ??
        0,
      );
      const ts = resolveActivityTimestamp(item, index, raw, range);
      return {
        timestamp: ts,
        value: Number.isFinite(val) ? val : 0,
        label: resolveActivityLabel(item, ts, range),
      };
    })
    .filter((p) => !isNaN(p.timestamp) && Number.isFinite(p.value))
    .sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Parse `user/followers-graph`: follower totals/counts plus optional unfollow series
 * (`unfollowers`, `unfollowCount`, etc.) when the API provides them.
 */
const parseFollowersGraphSeries = (response, range = 'weekly') => {
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
    return { followers: [], unfollowers: [] };
  }

  const pair = raw
    .map((item, index) => {
      const fVal = Number(
        item?.followers ??
        item?.followerCount ??
        item?.count ??
        item?.newFollowers ??
        item?.total ??
        item?.value ??
        0,
      );
      const uVal = Number(
        item?.unfollowers ??
        item?.unfollowCount ??
        item?.unfollowed ??
        item?.lostFollowers ??
        item?.lost ??
        item?.unfollows ??
        0,
      );
      const ts = resolveActivityTimestamp(item, index, raw, range);
      return {
        timestamp: ts,
        label: resolveActivityLabel(item, ts, range),
        follower: Number.isFinite(fVal) ? fVal : 0,
        unfollow: Number.isFinite(uVal) ? uVal : 0,
      };
    })
    .filter((p) => !isNaN(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    followers: pair.map((p) => ({ timestamp: p.timestamp, value: p.follower, label: p.label })),
    unfollowers: pair.map((p) => ({ timestamp: p.timestamp, value: p.unfollow, label: p.label })),
  };
};

function alignThreeActivitySeries(followers, unfollowers, support, range = 'weekly') {
  const allTs = [
    ...new Set([
      ...followers.map((p) => p.timestamp),
      ...unfollowers.map((p) => p.timestamp),
      ...support.map((p) => p.timestamp),
    ]),
  ].sort((a, b) => a - b);

  if (allTs.length === 0) {
    return { followers: [], unfollowers: [], support: [], timestamps: [], labels: [] };
  }

  const labelsByTs = new Map();
  [...followers, ...unfollowers, ...support].forEach((point) => {
    if (!labelsByTs.has(point.timestamp) && point.label) {
      labelsByTs.set(point.timestamp, point.label);
    }
  });

  const align = (arr, carryForward) => {
    const m = new Map(arr.map((p) => [p.timestamp, p.value]));
    let carry = 0;
    let seeded = false;
    return allTs.map((ts) => {
      if (m.has(ts)) {
        carry = Number(m.get(ts)) || 0;
        seeded = true;
        return { timestamp: ts, value: carry };
      }
      return { timestamp: ts, value: carryForward && seeded ? carry : 0 };
    });
  };

  return {
    timestamps: allTs,
    labels: allTs.map(ts => labelsByTs.get(ts) || formatActivityBucketLabel(ts, range)),
    followers: align(followers, true),
    unfollowers: align(unfollowers, true),
    support: align(support, false),
  };
}

const seriesEndpointValue = (points) => {
  if (!points || points.length === 0) return 0;
  return Number(points[points.length - 1].value) || 0;
};

const seriesDelta = (points) => {
  if (!points || points.length < 2) return 0;
  const a = Number(points[0].value) || 0;
  const b = Number(points[points.length - 1].value) || 0;
  return b - a;
};

const formatSupportUsd = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Split display name into lines; last line is paired with the verified dragonfly icon. */
const splitHeaderNameLines = (label, maxCharsPerLine) => {
  const trimmed = String(label || '').trim();
  if (!trimmed) return [''];
  if (trimmed.length <= maxCharsPerLine) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  if (lines.length <= 2) return lines;

  const mergedLast = lines.slice(1).join(' ');
  const lastLine =
    mergedLast.length > maxCharsPerLine
      ? `${mergedLast.slice(0, maxCharsPerLine - 1)}…`
      : mergedLast;
  return [lines[0], lastLine];
};

const ACTIVITY_UNFOLLOW_PINK = '#db2777';
const ACTIVITY_SUPPORT_LINE = '#8b5cf6';
/** Min horizontal space per segment; chart widens (scroll) when points would crowd */
const ACTIVITY_CHART_POINT_GAP = 46;

/** Multi-series trend (each line scaled to its own min/max so shapes are visible together). */
function ActivityTrendSvg({
  timestamps,
  labels = [],
  followersValues,
  unfollowersValues,
  supportValues,
  chartWidth,
  chartHeight,
  colorFollowers,
  colorUnfollowers,
  colorSupport,
}) {
  const pairedSorted = useMemo(() => {
    const len = Math.min(
      timestamps.length,
      followersValues.length,
      unfollowersValues.length,
      supportValues.length,
    );
    const rows = [];
    for (let i = 0; i < len; i++) {
      const t = Number(timestamps[i]);
      if (!Number.isFinite(t)) continue;
      rows.push({
        t,
        label: labels[i],
        fv: Number(followersValues[i]) || 0,
        uv: Number(unfollowersValues[i]) || 0,
        sv: Number(supportValues[i]) || 0,
      });
    }
    rows.sort((a, b) => a.t - b.t);
    return rows;
  }, [timestamps, labels, followersValues, unfollowersValues, supportValues]);

  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 30;
  const innerW = Math.max(chartWidth - padL - padR, 1);
  const innerH = Math.max(chartHeight - padT - padB, 1);
  const n = pairedSorted.length;

  const followersValuesSorted = pairedSorted.map((r) => r.fv);
  const unfollowersValuesSorted = pairedSorted.map((r) => r.uv);
  const supportValuesSorted = pairedSorted.map((r) => r.sv);
  const timestampsSorted = pairedSorted.map((r) => r.t);
  const labelsSorted = pairedSorted.map((r) => r.label);

  const xs = Array.from({ length: n }, (_, i) =>
    padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW),
  );

  const labelIndexes = useMemo(() => {
    if (n <= 0) return [];
    if (n === 1) return [0];
    const maxLabels = Math.min(7, n);
    const set = new Set([0, n - 1]);
    for (let k = 1; k < maxLabels - 1; k++) {
      set.add(Math.round((k / (maxLabels - 1)) * (n - 1)));
    }
    return [...set].sort((a, b) => a - b);
  }, [n]);

  const toYs = (vals) => {
    const nums = vals.map((v) => Number(v) || 0);
    let min = Math.min(...nums);
    let max = Math.max(...nums);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return nums.map(() => padT + innerH / 2);
    if (max === min) {
      min -= 1;
      max += 1;
    }
    return nums.map((v) => padT + innerH - ((v - min) / (max - min)) * innerH);
  };

  const yF = toYs(followersValuesSorted);
  const yU = toYs(unfollowersValuesSorted);
  const yS = toYs(supportValuesSorted);

  const linePath = (ys) => {
    if (n === 0) return '';
    if (n === 1) return `M ${xs[0]} ${ys[0]} L ${xs[0] + 0.5} ${ys[0]}`;
    return ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${y}`).join(' ');
  };

  const areaPath = (ys) => {
    if (n === 0) return '';
    const base = padT + innerH;
    const lp = linePath(ys);
    if (!lp) return '';
    return `${lp} L ${xs[n - 1]} ${base} L ${xs[0]} ${base} Z`;
  };

  return (
    <Svg width={chartWidth} height={chartHeight}>
      <Defs>
        <SvgLinearGradient id="gradF" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colorFollowers} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colorFollowers} stopOpacity={0.02} />
        </SvgLinearGradient>
        <SvgLinearGradient id="gradU" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colorUnfollowers} stopOpacity={0.2} />
          <Stop offset="1" stopColor={colorUnfollowers} stopOpacity={0.02} />
        </SvgLinearGradient>
        <SvgLinearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colorSupport} stopOpacity={0.2} />
          <Stop offset="1" stopColor={colorSupport} stopOpacity={0.02} />
        </SvgLinearGradient>
      </Defs>

      {n > 0 ? (
        <>
          <Path d={areaPath(yS)} fill="#f1eaea" stroke="none" />
          <Path d={areaPath(yU)} fill="#f1eaea" stroke="none" />
          <Path d={areaPath(yF)} fill="#f1eaea" stroke="none" />

          <Path d={linePath(yS)} stroke={colorSupport} strokeWidth={2} fill="none" />
          <Path d={linePath(yU)} stroke={colorUnfollowers} strokeWidth={2} fill="none" />
          <Path d={linePath(yF)} stroke={colorFollowers} strokeWidth={2.5} fill="none" />
        </>
      ) : null}

      {labelIndexes.map((i) => {
        const ts = timestampsSorted[i];
        const isFirst = i === 0;
        const isLast = n > 1 && i === n - 1;
        const anchor = n === 1 ? 'middle' : isFirst ? 'start' : isLast ? 'end' : 'middle';
        return (
          <SvgText
            key={`lb-${ts}-${i}`}
            x={xs[i]}
            y={chartHeight - 4}
            fill="#888"
            fontSize={9}
            textAnchor={anchor}
          >
            {labelsSorted[i] || ''}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export const WalletDashboardScreen = ({ navigation }) => {
  const { t } = useLanguage();

  const [activityPeriod, setActivityPeriod] = useState('Weekly'); // Daily | Weekly (matches API range)
  const [walletTransactions, setWalletTransactions] = useState(0);
  const [activityTimestamps, setActivityTimestamps] = useState([]);
  const [activityBucketLabels, setActivityBucketLabels] = useState([]);
  const [activityFollowersSeries, setActivityFollowersSeries] = useState([]);
  const [activityUnfollowersSeries, setActivityUnfollowersSeries] = useState([]);
  const [activitySupportSeries, setActivitySupportSeries] = useState([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [supportReceivedUsd, setSupportReceivedUsd] = useState(0);
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
    { id: 'Total Earning', title: t('walletDashboard.kpi.totalEarning'), value: '-', icon: 'wallet' },
    { id: 'support', title: t('walletDashboard.kpi.subscriptionEarning').replace(' ', '\n'), value: '-', icon: 'pie-chart' },
    { id: 'followers', title: t('walletDashboard.kpi.followers'), value: '-', icon: 'people' },
    { id: 'credits', title: t('walletDashboard.kpi.creditsLeft'), value: '-', icon: 'flash', currentCredits: 5 },
    { id: 'Mission Post', title: t('walletDashboard.kpi.missionPost'), value: '-', icon: 'ribbon' },
    { id: 'referralPoints', title: t('walletDashboard.kpi.referralPoints'), value: '-', icon: 'gift' },
    { id: 'metamask', title: t('walletDashboard.kpi.metamaskWallet'), value: '-', icon: 'logo-usd' },
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
  const activityChartScrollRef = useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();
  const [userWalletData, setUserWalletData] = useState({
    stripeCustomerId: '',
    walletAddress: '',
  });
  const [userProfile, setUserProfile] = useState({
    name: t('walletDashboard.headerDefaultUser'),
    image: FALLBACK_AVATAR,
  });
  const [followersCount, setFollowersCount] = useState(0);
  const [connectedWalletType, setConnectedWalletType] = useState(null);

  const activityChartW = width - 64;
  const activityChartH = 200;
  const activityPeriodDeltaLabel =
    activityPeriod === 'Weekly' ? 'vs last week' : 'vs prior day';

  const followersTrendDelta = seriesDelta(activityFollowersSeries);
  const unfollowersTrendDelta = seriesDelta(activityUnfollowersSeries);
  const supportTrendDelta = seriesDelta(activitySupportSeries);
  const unfollowersDisplay = Math.round(seriesEndpointValue(activityUnfollowersSeries));

  const hasActivityChartData = activityTimestamps.length > 0;

  const activityChartScrollWidth = useMemo(() => {
    const n = activityTimestamps.length;
    if (n <= 1) return activityChartW;
    const contentWidth = 40 + (n - 1) * ACTIVITY_CHART_POINT_GAP;
    return Math.round(Math.max(activityChartW, contentWidth));
  }, [activityChartW, activityTimestamps.length]);

  const scrollActivityChartToEnd = useCallback(() => {
    if (!hasActivityChartData || activityChartScrollWidth <= activityChartW) return;
    activityChartScrollRef.current?.scrollTo({
      x: Math.max(activityChartScrollWidth - activityChartW, 0),
      animated: false,
    });
  }, [activityChartScrollWidth, activityChartW, hasActivityChartData]);

  useEffect(() => {
    if (!hasActivityChartData || activityChartScrollWidth <= activityChartW) return;
    const timer = setTimeout(scrollActivityChartToEnd, 0);
    return () => clearTimeout(timer);
  }, [scrollActivityChartToEnd, activityChartScrollWidth, activityChartW, hasActivityChartData, activityTimestamps]);

  const [dragonflyModalVisible, setDragonflyModalVisible] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const [referPointsInfoVisible, setReferPointsInfoVisible] = useState(false);
  const profileImage = useSelector(state => state.profileImage?.profileImg);

  const openDragonflyModal = () => setDragonflyModalVisible(true);
  const closeDragonflyModal = () => setDragonflyModalVisible(false);
  const openAvatarPreview = () => setAvatarPreviewVisible(true);
  const closeAvatarPreview = () => setAvatarPreviewVisible(false);
  const openReferPointsInfo = () => setReferPointsInfoVisible(true);
  const closeReferPointsInfo = () => setReferPointsInfoVisible(false);

  const formatPointValue = (value) => {
    const numericValue = Number(value) || 0;
    return numericValue.toLocaleString('en-US');
  };

  const rewardPointCards = useMemo(
    () => [
      {
        id: 'battlePoints',
        title: t('walletDashboard.battlePoints.battlePoints'),
        value: rewardSummary.totalBattlePoints,
        icon: 'trophy-outline',
        iconBackground: 'rgba(250, 204, 21, 0.16)',
        iconColor: '#facc15',
      },
      {
        id: 'referPoints',
        title: t('walletDashboard.battlePoints.referPoints'),
        value: rewardSummary.referPoints,
        icon: 'gift-outline',
        iconBackground: 'rgba(34, 211, 238, 0.16)',
        iconColor: '#67e8f9',
      },
      {
        id: 'usedPoints',
        title: t('walletDashboard.battlePoints.usedPoints'),
        value: rewardSummary.used,
        icon: 'remove-circle-outline',
        iconBackground: 'rgba(248, 113, 113, 0.16)',
        iconColor: '#fca5a5',
      },
    ],
    [rewardSummary, t]
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
      dispatch(showLoader());
      const id = await AsyncStorage.getItem('userId');

      if (!id) {
        console.log('User ID not found');
        return;
      }

      const response = await getUserCredentials(id);

      console.log('API Response: data in thi apiaiaaiaiaai', response);
      setIsBusinessProfile(response?.data?.profile !== 'user');
      setKyc(response?.data?.kyc || null);
      console.log(response, 'data in this apiaia for resposne ')
      // 🔥 Adjust keys based on your API response
      const stripeCustomerId =
        response?.data?.stripeAccountId ||
        response?.data?.stripeCustomerId ||
        '';

      const walletAddress =
        response?.data?.walletAddress ||
        response?.data?.walletAddress ||
        '';

      setUserWalletData({
        stripeCustomerId,
        walletAddress,
      });

      const profileName =
        response?.data?.userName ||
        response?.data?.username ||
        response?.data?.name ||
        t('walletDashboard.headerDefaultUser');

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
    } finally {
      dispatch(hideLoader());
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
    const isMetaMaskLast = list[list.length - 1]?.id === 'metamask';

    if (isMetaMaskLast && list.length % 2 === 0) {
      list.splice(list.length - 1, 0, { id: 'kpi-placeholder', isPlaceholder: true });
    } else if (!isMetaMaskLast && list.length % 2 !== 0) {
      list.push({ id: 'kpi-placeholder', isPlaceholder: true });
    }
    return list;
  }, [visibleKpiData]);

  /** Profile header, KPI grid, Battle Points — same gradient */
  const walletScreenGradient = useMemo(
    () =>
      isBusinessProfile
        ? ['#C9A15a', '#fdfcfa']
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
  const DragonflyIcon = useMemo(
    () => getDragonflyIcon(followersCount),
    [followersCount],
  );
  const headerNameLabel = useMemo(() => {
    const name = String(userProfile.name || t('walletDashboard.headerDefaultUser')).trim();
    return `@${name}`;
  }, [t, userProfile.name]);
  const headerNameLines = useMemo(() => {
    const maxChars = Math.max(12, Math.floor((width - 168) / 9));
    return splitHeaderNameLines(headerNameLabel, maxChars);
  }, [headerNameLabel]);

  useEffect(() => {
    let timeout;

    const onKeyboardHide = () => {
      timeout = setTimeout(() => {
        purchaseSheetRef.current?.updateLayout?.({ height: 500 });
      }, 300);
    };

    const hideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);

    return () => {
      hideSub.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          dispatch(showLoader());

          const storedWalletType = await AsyncStorage.getItem('walletType');
          setConnectedWalletType(storedWalletType);

          await Promise.allSettled([
            getUserDetail(),
            fetchCreditsLeft(),
            rewardPoints(),
            fetchFollowers(),
            fetchTotalSupport(),
            fetchTotalEarning(),
            fetchReferralPoints(),
            fetchMetaMaskReceived(),
            totalMissonDonation(),
            fetchTopCreators(),
          ]);
        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        } finally {
          dispatch(hideLoader());
        }
      };

      fetchData();

      return () => {
        // Cleanup if needed
      };
    }, [dispatch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      dispatch(showLoader());

      await Promise.allSettled([
        getUserDetail(),
        // fetchDashboardData(),
        fetchActivityOverviewCharts(),
        fetchCreditsLeft(),
        rewardPoints(),
        fetchFollowers(),
        fetchTotalSupport(),
        fetchTotalEarning(),
        fetchReferralPoints(),
        fetchMetaMaskReceived(),
        fetchTopCreators(),
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
      setConnectedWalletType(null);
      showToastMessage(toast, 'success', t('walletDashboard.metamask.walletDisconnected'));
    } catch (error) {
      showToastMessage(toast, 'danger', t('walletDashboard.metamask.walletDisconnectError'));
    }
  }, [toast, t]);

  const handleMetaMaskCardPress = useCallback(() => {
    if (isMetaMaskConnected) {
      Alert.alert(
        t('walletDashboard.metamask.disconnectAlertTitle'),
        t('walletDashboard.metamask.disconnectAlertMessage'),
        [
          { text: t('walletDashboard.metamask.disconnectAlertCancel'), style: 'cancel' },
          {
            text: t('walletDashboard.metamask.disconnectAlertConfirm'),
            style: 'destructive',
            onPress: handleDisconnectWallet,
          },
        ],
      );
      return;
    }
    openWalletConnect();
  }, [handleDisconnectWallet, isMetaMaskConnected, openWalletConnect, t]);

  // Helper function to format activity type
  const getActivityType = (activity) => {
    if (activity.purchase) return 'buy';
    if (activity.sell) return 'sell';
    if (activity.following) return 'follow';
    return 'mint';
  };

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
  const fetchActivityOverviewCharts = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const range = FOLLOWERS_RANGE_BY_PERIOD[activityPeriod] ?? 'weekly';

      const [followersRes, supportRes] = await Promise.all([
        userId ? getTotalFollowers({ userId, range }) : Promise.resolve(null),
        subscriptionEarningGraph({ interval: range }),
      ]);
      console.log('Followers API Response:', followersRes);
      console.log('Subscription Graph Response:', supportRes);
      const { followers: fp, unfollowers: up } = parseFollowersGraphSeries(followersRes, range);
      const sp = mapSubscriptionGraphPoints(supportRes, range);
      const aligned = alignThreeActivitySeries(fp, up, sp, range);

      setActivityTimestamps(aligned.timestamps);
      setActivityBucketLabels(aligned.labels);
      setActivityFollowersSeries(aligned.followers);
      setActivityUnfollowersSeries(aligned.unfollowers);
      setActivitySupportSeries(aligned.support);
    } catch (error) {
      console.error('error in activity overview charts', error);
      setActivityTimestamps([]);
      setActivityBucketLabels([]);
      setActivityFollowersSeries([]);
      setActivityUnfollowersSeries([]);
      setActivitySupportSeries([]);
    }
  }, [activityPeriod]);

  useEffect(() => {
    fetchActivityOverviewCharts();
  }, [fetchActivityOverviewCharts]);

  const fetchFollowers = async () => {
    const id = await AsyncStorage.getItem('userId');
    try {
      const response = await getUserDashboard(id);
      if (response?.statusCode === 200) {
        const dash = response.data.dashboardData ?? {};
        const totalFollowers = Number(dash.totalFollowers) || 0;
        const totalFollowing = Number(dash.totalFollowing) || 0;
        setFollowersCount(totalFollowers);
        setFollowingCount(totalFollowing);
        setKpiData(prevKpiData => {
          return prevKpiData.map(item => {
            if (item.id === 'followers') {
              return {
                ...item,
                value: totalFollowers.toString() || '0',
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
      setSupportReceivedUsd(supportAmount);

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
      console.log(response, 'data in total earning totalamounttotalamounttotalamounttotalamounttotalamount')
      const rawValue =
        response?.data?.totalAmount ??
        response?.data?.data?.totalAmount ??
        response?.data?.totalReceived ??
        response?.data?.data?.totalReceived ??
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

      const activePostCount =
        response?.data?.activePostCount ??
        response?.data?.data?.activePostCount ??
        0;
      const postCount = Number(activePostCount) || 0;

      setMissionDonationTotal(totalAmount);

      setKpiData(prevKpiData =>
        prevKpiData.map(item =>
          item.id === 'Mission Post'
            ? {
              ...item,
              value: `$ ${totalAmount.toFixed(2)} \n${t('walletDashboard.kpi.missionActive', { count: postCount || 0 })}`,
            }
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

  const handleTokenModalClose = () => {
    purchaseSheetRef.current?.close?.();
    setPendingFollowUserId(null);
  };

  const handleTokenPurchase = async () => { };

  const handleTokenSell = () => {
    // sellSheetRef.current?.close();
    showToastMessage(toast, 'success', 'Tokens sold successfully!');
    onRefresh();
  };

  const renderKPICard = (item) => {
    const isMetaMaskCard = item.id === 'metamask';
    const cellStyle = [
      styles.kpiCardCell,
      isMetaMaskCard && styles.kpiCardCellFull,
    ];

    if (item?.isPlaceholder) {
      return <View key={item.id} style={cellStyle} />;
    }

    const isCreditsCard = item.id === 'credits';
    const isMissionPostCard = item.id === 'Mission Post';
    const isSupportCard = item.id === 'support';
    const metaStatusText = isMetaMaskConnected
      ? t('walletDashboard.metamask.connected')
      : t('walletDashboard.metamask.disconnected');
    const metaActionText = isMetaMaskConnected
      ? t('walletDashboard.metamask.tapToDisconnect')
      : t('walletDashboard.metamask.tapToConnect');

    if (isMetaMaskCard) {
      const normalizedWalletType = String(connectedWalletType || '').trim().toLowerCase();
      const walletTypeForUi = isMetaMaskConnected
        ? normalizedWalletType || 'walletconnect'
        : 'wallet';

      const walletTitle = isMetaMaskConnected
        ? normalizedWalletType === 'metamask'
          ? 'MetaMask'
          : normalizedWalletType === 'coinbase'
            ? 'Coinbase Wallet'
            : 'WalletConnect'
        : t('walletDashboard.kpi.wallet');

      const walletIconSource =
        WALLET_ICON_BY_TYPE[walletTypeForUi] || WALLET_ICON_BY_TYPE.wallet;

      return (
        <View key={item.id} style={cellStyle}>
          <TouchableOpacity
            style={styles.kpiCardTouchable}
            activeOpacity={0.86}
            onPress={handleMetaMaskCardPress}
          >
            <LinearGradient
              colors={walletScreenGradient}
              start={{ x: -5, y: -5 }}
              end={{ x: 1, y: 1 }}
              style={[styles.kpiCard, styles.kpiCardMetaMask, { shadowColor: text }]}
            >
              <View style={styles.kpiMetaMaskRow}>
                <View style={styles.kpiMetaMaskLeft}>
                  <View style={[styles.kpiMetaMaskIconWrap, { backgroundColor: '#D3D3D3' }]}>
                    <Image source={walletIconSource} style={styles.kpiWalletIcon} resizeMode="contain" />
                  </View>
                  <View style={styles.kpiMetaMaskText}>
                    <Text style={[styles.kpiTitle, { color: text }]} numberOfLines={1}>
                      {isMetaMaskConnected ? item.title : t('walletDashboard.Wallet')}
                    </Text>
                    <Text style={[styles.kpiValue, styles.kpiValueMetaMask, { color: text }]} numberOfLines={1}>
                      {item.value}
                    </Text>
                    <View style={styles.kpiMetaMaskStatusRow}>
                      <View
                        style={[
                          styles.kpiStatusDot,
                          { backgroundColor: isMetaMaskConnected ? '#16a34a' : '#b45309' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.kpiMetaMaskStatusText,
                          { color: isMetaMaskConnected ? '#16a34a' : '#b45309' },
                        ]}
                        numberOfLines={1}
                      >
                        {metaStatusText}
                      </Text>
                      <Text style={[styles.kpiMetaMaskHint, { color: text }]} numberOfLines={1}>
                        {metaActionText}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={text} style={styles.kpiChevron} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    const cardContent = (
      <LinearGradient
        colors={walletScreenGradient}
        start={{ x: -1, y: -1 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.kpiCard,
          (isCreditsCard || isMissionPostCard || isSupportCard) && styles.kpiCardFillTouchable,
        ]}
      >
        <View style={[styles.kpiHeader, styles.kpiHeaderWithAction]}>
          <View style={styles.kpiHeaderLeft}>
            <View style={styles.kpiIconWrap}>
              <Ionicons name={item.icon} size={18} color={text} />
            </View>
            {isSupportCard ? (
              <View style={styles.kpiSubscriptionTitleWrap}>
                {(() => {
                  const [firstLine = '', ...rest] = t('walletDashboard.kpi.subscriptionEarning').trim().split(/\s+/);
                  const secondLine = rest.join(' ');
                  return (
                    <>
                      <Text style={[styles.kpiSubscriptionTitleLine, { color: text }]} numberOfLines={1}>
                        {firstLine}
                      </Text>
                      <Text style={[styles.kpiSubscriptionTitleLine, { color: text }]} numberOfLines={1}>
                        {secondLine}
                      </Text>
                    </>
                  );
                })()}
              </View>
            ) : (
              <Text style={[styles.kpiTitle, { color: text }]} numberOfLines={2}>
                {item.title}
              </Text>
            )}
          </View>
          {item.id === 'followers' && (
            <TouchableOpacity
              style={styles.dragonflyInfoButton}
              onPress={openDragonflyModal}
              activeOpacity={0.75}
            >
              <DragonflyIcon width={25} height={25} />
            </TouchableOpacity>
          )}
          {item.id === 'referralPoints' && (
            <TouchableOpacity
              style={styles.kpiInfoButton}
              onPress={openReferPointsInfo}
              activeOpacity={0.75}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('walletDashboard.battlePoints.referPointsInfoTitle')}
            >
              <Ionicons name="information-circle-outline" size={18} color={text} />            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.kpiValue, isMissionPostCard && styles.kpiValueMultiline, { color: text }]} numberOfLines={3}>
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
        {isCreditsCard ? (
          <Text
            style={[
              styles.kpiMetaSingleLine,
              styles.kpiMetaBuyCredits, { color: text }
            ]}
            numberOfLines={2}
          >
            {t('walletDashboard.kpi.tapToBuyCredits')}
          </Text>
        ) : null}
        {(isCreditsCard || isMissionPostCard) ? (
          <Ionicons name="chevron-forward" size={16} color={text} style={styles.kpiChevronInline} />
        ) : null}
      </LinearGradient>
    );

    if (isCreditsCard) {
      return (
        <View key={item.id} style={cellStyle}>
          <TouchableOpacity
            style={styles.kpiCardTouchable}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('WalletMain')}
          >
            {cardContent}
          </TouchableOpacity>
        </View>
      );
    }

    if (isMissionPostCard) {
      return (
        <View key={item.id} style={cellStyle}>
          <TouchableOpacity
            style={styles.kpiCardTouchable}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('ViewMissionPost', { isBusinessProfile: isBusinessProfile })}
          >
            {cardContent}
          </TouchableOpacity>
        </View>
      );
    }

    if (isSupportCard) {
      return (
        <View key={item.id} style={cellStyle}>
          <TouchableOpacity
            style={styles.kpiCardTouchable}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('RevenueFromSubscriptions')}
          >
            {cardContent}
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View key={item.id} style={cellStyle}>
        {cardContent}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[text]}
            tintColor={text}
            title={t('walletDashboard.pullToRefresh')}
            titleColor={text}
          />
        }
      >
        {/* Header — same gradient as KPI + Battle Points */}
        <View style={styles.header}>
          <LinearGradient
            colors={walletScreenGradient}
            start={{ x: -1, y: -1 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <View style={styles.headerGlow} />
            <View style={styles.headerRow}>
              <View style={styles.headerAvatarWrap}>
                <TouchableOpacity activeOpacity={0.85} onPress={openAvatarPreview}>
                  <HexAvatar
                    uri={profileImage || userProfile.image || FALLBACK_AVATAR}
                    size={72}
                    borderWidth={3}
                    borderColor={text}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.headerText}>
                <View style={styles.headerNameBlock}>
                  {headerNameLines.slice(0, -1).map((line, index) => (
                    <Text
                      key={`${line}-${index}`}
                      style={[styles.headerName, { color: text }]}
                      numberOfLines={1}
                    >
                      {line}
                    </Text>
                  ))}
                  <View style={styles.headerNameLastRow}>
                    <Text
                      style={[styles.headerName, styles.headerNameLastLine, { color: text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {headerNameLines[headerNameLines.length - 1]}
                    </Text>
                    {kyc === true && (
                      <DragonflyIcon width={20} height={20} style={styles.headerNameDragonfly} />
                    )}
                  </View>
                </View>
                {kyc === true && (
                  <Text style={[styles.headerStatusText, { color: text }]}>
                    {t('walletDashboard.headerVerified')}
                  </Text>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* KPI Cards */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            {kpiGridData.map((item) => renderKPICard(item))}
          </View>
        </View>

        {/* Battle Points */}
        <View style={[styles.section, styles.battlePointsSection]}>
          <Text style={[styles.sectionTitle, styles.pointsSectionTitle, textStyle]}>
            {t('walletDashboard.battlePoints.sectionTitle')}
          </Text>
          <LinearGradient
            colors={walletScreenGradient}
            start={{ x: -2, y: -2 }}
            end={{ x: 1, y: 1 }}
            style={styles.pointsCard}
          >
            <View style={styles.pointsGlow} />
            <View style={styles.pointsFourColRow}>
              <View style={styles.pointsMainCol}>
                <View style={styles.pointsMainIconWrap}>
                  <HexStarIcon size={34} starSize={14} starColor="#ffffff" bgColor={text} />
                </View>
                <View style={styles.pointsMainText}>
                  <Text style={[styles.pointsMainLabel, { color: text }]} numberOfLines={2}>
                    {t('walletDashboard.battlePoints.totalPlatformPoints')}
                  </Text>
                  <Text style={[styles.pointsMainValue, { color: text }]} numberOfLines={1}>
                    {formatPointValue(rewardSummary.totalPlatformPoints)}
                  </Text>
                </View>
              </View>

              {rewardPointCards.map((item, index) => (
                <React.Fragment key={item.id}>
                  <View style={styles.pointsCol}>
                    <Ionicons name={item.icon} size={18} color={item.iconColor} />
                    <Text style={[styles.pointsColValue, { color: text }]} numberOfLines={1}>
                      {formatPointValue(item.value)}
                    </Text>
                    {item.id === 'referPoints' ? (
                      <View style={styles.pointsColLabelRow}>
                        <Text
                          style={[styles.pointsColLabel, { color: text, marginTop: 0 }]}
                          numberOfLines={2}
                        >
                          {item.title}
                        </Text>
                        <TouchableOpacity
                          style={styles.pointsInfoButton}
                          onPress={openReferPointsInfo}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityRole="button"
                          accessibilityLabel={t('walletDashboard.battlePoints.referPointsInfoTitle')}
                        >
                          <Ionicons name="ellipsis-horizontal" size={14} color={text} style={styles.pointsInfoIcon} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={[styles.pointsColLabel, { color: text }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                    )}
                  </View>
                  {index !== rewardPointCards.length - 1 ? (
                    <View style={styles.pointsDivider} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Activity Overview */}
        <View style={[styles.section, { marginTop: 17 }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, textStyle]}>
              {t('walletDashboard.activityOverview.sectionTitle')}
            </Text>
          </View>

          <View style={styles.periodSelector}>
            {[
              t('walletDashboard.activityOverview.periodDaily'),
              t('walletDashboard.activityOverview.periodWeekly'),
            ].map((period) => {
              // Map translated label back to internal key
              const periodKey =
                period === t('walletDashboard.activityOverview.periodDaily') ? 'Daily' : 'Weekly';
              return (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    activityPeriod === periodKey && { backgroundColor: text },
                  ]}
                  onPress={() => setActivityPeriod(periodKey)}
                >
                  <Text
                    style={[
                      styles.periodText,
                      activityPeriod === periodKey && styles.periodTextActive,
                    ]}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Chart — followers vs unfollowers vs subscription support */}
          <View style={[styles.chartContainer, { shadowColor: text }]}>
            <View style={styles.activityMetricsRow}>
              <View style={[styles.activityMetricCard, styles.activityMetricCardCompact, { borderColor: `${text}22` }]}>
                <View style={[styles.activityMetricIconWrap, styles.activityMetricIconWrapCompact, { backgroundColor: `${text}18` }]}>
                  <Ionicons name="people" size={14} color={text} />
                </View>
                <Text style={[styles.activityMetricValue, styles.activityMetricValueCompact, { color: text }]}>
                  {Math.round(followersCount).toLocaleString()}
                </Text>
                <Text style={[styles.activityMetricLabel, styles.activityMetricLabelCompact]}>Followers</Text>
                <Text style={[styles.activityFollowingHint, styles.activityMetricSubCompact, { color: text }]} numberOfLines={1}>
                  Following {Math.round(followingCount).toLocaleString()}
                </Text>
                <View
                  style={[
                    styles.activityDeltaPill,
                    styles.activityDeltaPillCompact,
                    {
                      backgroundColor:
                        followersTrendDelta >= 0 ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                    },
                  ]}
                >
                  <Ionicons
                    name={followersTrendDelta >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={followersTrendDelta >= 0 ? '#059669' : '#dc2626'}
                  />
                  <Text
                    style={[
                      styles.activityDeltaText,
                      styles.activityDeltaTextCompact,
                      { color: followersTrendDelta >= 0 ? '#059669' : '#dc2626' },
                    ]}
                    numberOfLines={1}
                  >
                    {`${followersTrendDelta >= 0 ? '+' : ''}${Math.round(followersTrendDelta)} ${activityPeriodDeltaLabel}`}
                  </Text>
                </View>
              </View>

              <View style={[styles.activityMetricCard, styles.activityMetricCardCompact, { borderColor: `${ACTIVITY_SUPPORT_LINE}33` }]}>
                <View style={[styles.activityMetricIconWrap, styles.activityMetricIconWrapCompact, { backgroundColor: `${ACTIVITY_SUPPORT_LINE}22` }]}>
                  <Ionicons name="wallet" size={14} color={ACTIVITY_SUPPORT_LINE} />
                </View>
                <Text style={[styles.activityMetricValue, styles.activityMetricValueCompact, { color: ACTIVITY_SUPPORT_LINE }]}>
                  {formatSupportUsd(supportReceivedUsd)}
                </Text>
                <Text style={[styles.activityMetricLabel, styles.activityMetricLabelCompact]} numberOfLines={1}>
                  Total support
                </Text>
                <Text style={[styles.activityMetricSub, styles.activityMetricSubCompact]} numberOfLines={1}>
                  Subscriptions & tips
                </Text>
                <View
                  style={[
                    styles.activityDeltaPill,
                    styles.activityDeltaPillCompact,
                    {
                      backgroundColor:
                        supportTrendDelta >= 0 ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                    },
                  ]}
                >
                  <Ionicons
                    name={supportTrendDelta >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={supportTrendDelta >= 0 ? '#059669' : '#dc2626'}
                  />
                  <Text
                    style={[
                      styles.activityDeltaText,
                      styles.activityDeltaTextCompact,
                      { color: supportTrendDelta >= 0 ? '#059669' : '#dc2626' },
                    ]}
                    numberOfLines={1}
                  >
                    {`${supportTrendDelta >= 0 ? '+' : '-'}${formatSupportUsd(Math.abs(supportTrendDelta))} ${activityPeriodDeltaLabel}`}
                  </Text>
                </View>
              </View>

              <View style={[styles.activityMetricCard, styles.activityMetricCardCompact, { borderColor: `${ACTIVITY_UNFOLLOW_PINK}33` }]}>
                <View style={[styles.activityMetricIconWrap, styles.activityMetricIconWrapCompact, { backgroundColor: `${ACTIVITY_UNFOLLOW_PINK}18` }]}>
                  <Ionicons name="person-remove-outline" size={14} color={ACTIVITY_UNFOLLOW_PINK} />
                </View>
                <Text style={[styles.activityMetricValue, styles.activityMetricValueCompact, { color: ACTIVITY_UNFOLLOW_PINK }]}>
                  {unfollowersDisplay.toLocaleString()}
                </Text>
                <Text style={[styles.activityMetricLabel, styles.activityMetricLabelCompact]}>Unfollowers</Text>
                <Text style={[styles.activityMetricSub, styles.activityMetricSubCompact]} numberOfLines={1}>
                  Lost over this range
                </Text>
                <View
                  style={[
                    styles.activityDeltaPill,
                    styles.activityDeltaPillCompact,
                    {
                      backgroundColor:
                        unfollowersTrendDelta <= 0 ? 'rgba(16,185,129,0.14)' : 'rgba(219,39,119,0.14)',
                    },
                  ]}
                >
                  <Ionicons
                    name={unfollowersTrendDelta <= 0 ? 'arrow-down' : 'arrow-up'}
                    size={10}
                    color={unfollowersTrendDelta <= 0 ? '#059669' : ACTIVITY_UNFOLLOW_PINK}
                  />
                  <Text
                    style={[
                      styles.activityDeltaText,
                      styles.activityDeltaTextCompact,
                      { color: unfollowersTrendDelta <= 0 ? '#059669' : ACTIVITY_UNFOLLOW_PINK },
                    ]}
                    numberOfLines={1}
                  >
                    {`${unfollowersTrendDelta >= 0 ? '+' : ''}${Math.round(unfollowersTrendDelta)} ${activityPeriodDeltaLabel}`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.activityLegend}>
              <View style={styles.activityLegendItem}>
                <View style={[styles.activityLegendDot, { backgroundColor: text }]} />
                <Text style={styles.activityLegendText}>Followers</Text>
              </View>
              <View style={styles.activityLegendItem}>
                <View style={[styles.activityLegendDot, { backgroundColor: ACTIVITY_SUPPORT_LINE }]} />
                <Text style={styles.activityLegendText}>Support trend</Text>
              </View>
              <View style={styles.activityLegendItem}>
                <View style={[styles.activityLegendDot, { backgroundColor: ACTIVITY_UNFOLLOW_PINK }]} />
                <Text style={styles.activityLegendText}>Unfollowers</Text>
              </View>
            </View>

            {hasActivityChartData ? (
              <>
                <ScrollView
                  ref={activityChartScrollRef}
                  horizontal
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsHorizontalScrollIndicator
                  style={[styles.activityChartScrollViewport, { width: activityChartW }]}
                  contentContainerStyle={styles.activityChartScrollContent}
                  onContentSizeChange={(contentWidth) => {
                    if (contentWidth > activityChartW) {
                      activityChartScrollRef.current?.scrollTo({
                        x: contentWidth - activityChartW,
                        animated: false,
                      });
                    }
                  }}
                >
                  <ActivityTrendSvg
                    timestamps={activityTimestamps}
                    labels={activityBucketLabels}
                    followersValues={activityFollowersSeries.map((p) => p.value)}
                    unfollowersValues={activityUnfollowersSeries.map((p) => p.value)}
                    supportValues={activitySupportSeries.map((p) => p.value)}
                    chartWidth={activityChartScrollWidth}
                    chartHeight={activityChartH}
                    colorFollowers={text}
                    colorUnfollowers={ACTIVITY_UNFOLLOW_PINK}
                    colorSupport={ACTIVITY_SUPPORT_LINE}
                  />
                </ScrollView>
                <Text style={styles.activityChartFootnote}>
                  Lines use separate scales. Swipe the chart sideways when points are crowded.
                </Text>
              </>
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
                <Text style={styles.emptyChartText}>No chart data yet</Text>
                <Text style={styles.emptyChartSubtext}>Pull to refresh after activity builds up</Text>
              </View>
            )}
          </View>
        </View>

        <Modal
          visible={avatarPreviewVisible}
          transparent
          animationType="fade"
          onRequestClose={closeAvatarPreview}
        >
          <Pressable style={styles.avatarPreviewOverlay} onPress={closeAvatarPreview}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={closeAvatarPreview}
              style={styles.avatarPreviewCloseBtn}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <Pressable
              style={styles.avatarPreviewZoomHost}
              onPress={(e) => e?.stopPropagation?.()}
            >
              <ImageZoom
                cropWidth={width}
                cropHeight={height}
                imageWidth={AVATAR_PREVIEW_SIZE}
                imageHeight={AVATAR_PREVIEW_SIZE}
                enableCenterFocus
              >
                <View style={styles.avatarPreviewHexWrap}>
                  <HexAvatar
                    uri={profileImage || userProfile.image || FALLBACK_AVATAR}
                    size={AVATAR_PREVIEW_SIZE}
                    borderWidth={2}
                    borderColor="rgba(255,255,255,0.6)"
                  />
                </View>
              </ImageZoom>
            </Pressable>
          </Pressable>
        </Modal>
        <Modal
          visible={dragonflyModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeDragonflyModal}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={closeDragonflyModal}
            />
            <View style={[styles.modalContent, bgStyle]}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalTitleBlock}>
                    <Text style={[styles.modalTitle, textStyle]}>
                      {t('walletDashboard.dralensModal.title')}
                    </Text>
                  </View>
                  <View style={styles.modalIconWrap}>
                    <BlueDragonfly width={60} height={60} />
                  </View>
                </View>
                <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                  <Text style={[styles.modalParagraph, textStyle]}>
                    {t('walletDashboard.dralensModal.paragraph1')}
                  </Text>
                  <Text style={[styles.modalParagraph, textStyle]}>
                    {t('walletDashboard.dralensModal.paragraph2')}
                  </Text>
                  <Text style={[styles.modalParagraph, textStyle]}>
                    {t('walletDashboard.dralensModal.paragraph3')}
                  </Text>

                  <Text style={[styles.modalSectionHeading, textStyle]}>
                    {t('walletDashboard.dralensModal.onValensHeading')}
                  </Text>
                  <View style={styles.modalBulletList}>
                    {[
                      t('walletDashboard.dralensModal.bullet1'),
                      t('walletDashboard.dralensModal.bullet2'),
                      t('walletDashboard.dralensModal.bullet3'),
                      t('walletDashboard.dralensModal.bullet4'),
                    ].map((item) => (
                      <View key={item} style={styles.modalBulletItem}>
                        <View style={styles.modalBulletPoint} />
                        <Text style={[styles.modalBulletText, textStyle]}>{item}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={[styles.modalParagraph, textStyle]}>
                    {t('walletDashboard.dralensModal.paragraph4')}
                  </Text>

                  <View style={styles.modalGrid}>
                    {DRAGONFLY_TIERS(t).map(({ id, Icon, title, range, note, color }, index) => {
                      const isLastRow =
                        DRAGONFLY_TIERS(t).length % 3 !== 0 &&
                        index >= DRAGONFLY_TIERS(t).length - (DRAGONFLY_TIERS(t).length % 3);

                      return (
                        <View
                          key={id}
                          style={[
                            styles.modalCard,
                            isLastRow && styles.lastRowCard,
                          ]}
                        >
                          <Icon width={42} height={42} />
                          <Text style={[styles.modalCardTitle, textStyle]}>{title}</Text>
                          <Text
                            style={[
                              styles.modalCardRange,
                              textStyle,
                              {
                                backgroundColor: color,
                                color: color === '#ffffff' ? '#000000' : '#ffffff',
                              },
                            ]}
                          >
                            {range}
                          </Text>
                          <Text style={[styles.modalCardNote, textStyle]}>{note}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.modalCloseButton, { backgroundColor: text }]}
                    onPress={closeDragonflyModal}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCloseButtonText}>
                      {t('walletDashboard.dralensModal.gotIt')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={referPointsInfoVisible}
          transparent
          animationType="fade"
          onRequestClose={closeReferPointsInfo}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={closeReferPointsInfo}
            />
            <View style={[styles.modalContent, bgStyle]}>
              <View style={styles.referPointsInfoInner}>
                <Text style={[styles.referPointsInfoTitle, textStyle]}>
                  {t('walletDashboard.battlePoints.referPointsInfoTitle')}
                </Text>
                <Text style={[styles.referPointsInfoText, textStyle]}>
                  {t('walletDashboard.battlePoints.referPointsInfoBody1')}
                </Text>
                <Text style={[styles.referPointsInfoText, textStyle]}>
                  {t('walletDashboard.battlePoints.referPointsInfoBody2', { points: '1,000' })}
                </Text>

                <TouchableOpacity
                  style={[styles.referPointsInfoCta, { backgroundColor: text }]}
                  onPress={closeReferPointsInfo}
                  activeOpacity={0.85}
                >
                  <Text style={styles.referPointsInfoCtaText}>
                    {t('walletDashboard.battlePoints.referPointsInfoCta')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
    paddingBottom: 40,
    marginBottom: Platform.OS == "ios" ? 60 : 0
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: Platform.OS == "android" ? 0 : 14,
    paddingTop: Platform.OS == "android" ? 16 : 0,
    paddingBottom: Platform.OS == "android" ? 8 : 0,
    marginBottom: Platform.OS == "android" ? 4 : -12,
  },
  headerCard: {
    borderRadius: 20,
    padding: Platform.OS == "android" ? 18 : 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
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
    paddingVertical: Platform.OS == "android" ? 4 : 0,
    paddingBottom: Platform.OS == "android" ? 0 : 40,
    paddingTop: Platform.OS == "android" ? 0 : 10,
  },
  headerAvatarWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerNameBlock: {
    width: '100%',
  },
  headerNameLastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  headerName: {
    color: '#fef3c7',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  headerNameLastLine: {
    flexShrink: 1,
    minWidth: 0,
  },
  headerNameDragonfly: {
    marginLeft: 6,
    flexShrink: 0,
  },
  headerStatusText: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
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
    marginBottom: 28,
  },
  battlePointsSection: {
    marginTop: Platform.OS == "android" ? 4 : -25,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  pointsSectionTitle: {
    marginBottom: 12,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
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
  pointsFourColRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  pointsDivider: {
    width: 1,
    height: 46,
    backgroundColor: 'rgba(90,45,130,0.16)',
    marginHorizontal: 5,
  },
  pointsMainCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.8,
    minWidth: 0,
  },
  pointsMainIconWrap: {
    // width: 20,
    // height: 20,
    // borderRadius: 10,
    // backgroundColor: '#5a2d82',
    // alignItems: 'center',
    // justifyContent: 'center',
    marginRight: 4,
  },
  pointsMainText: {
    // flex: 1,
    minWidth: 0,
  },
  pointsMainLabel: {
    fontSize: 8,
    fontWeight: '500',
    opacity: 0.82,
  },
  pointsMainValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  pointsCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    paddingLeft: 4,
  },
  pointsColValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
  },
  pointsColLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.75,
    textAlign: 'center',
  },
  pointsColLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    gap: 4,
  },
  pointsInfoButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 10,
    opacity: 0.9,
  },
  pointsInfoIcon: {
    marginTop: 1,
  },
  referPointsInfoInner: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  referPointsInfoTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  referPointsInfoText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  referPointsInfoCta: {
    marginTop: 6,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referPointsInfoCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -(KPI_GRID_GAP / 2),
  },
  kpiCardCell: {
    width: '50%',
    paddingHorizontal: KPI_GRID_GAP / 2,
    marginBottom: KPI_GRID_GAP,
  },
  kpiCardCellFull: {
    width: '100%',
  },
  kpiCard: {
    borderRadius: 16,
    padding: Platform.OS == "android" ? 16 : 8,
    marginBottom: Platform.OS == "android" ? 0 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
    flex: 1,
    alignSelf: 'stretch',
    minHeight: Platform.OS == "android" ? 132 : 150,
    justifyContent: 'flex-start',
    top: 15
  },
  kpiCardMetaMask: {
    borderRadius: 18,
    padding: 16,
    minHeight: 108,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  kpiCardFillTouchable: {
    flexGrow: 1,
  },
  kpiCardTouchable: {
    flex: 1,
    alignItems: 'stretch',
    minWidth: 0,
    minHeight: Platform.OS == "android" ? 132 : 170,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS == "android" ? 0 : 15,
    paddingTop: 0,
    paddingHorizontal: 0,
    marginBottom: 10,
  },
  kpiHeaderWithAction: {
    justifyContent: 'space-between',
  },
  kpiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D3D3D3',
    borderWidth: 1,
    borderColor: '#D3D3D3',
  },
  dragonflyInfoButton: {
    padding: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    right: Platform.OS == "android" ? 0 : 14,
  },
  kpiInfoButton: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    right: Platform.OS == "android" ? 0 : 8,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
    textTransform: 'capitalize',
    lineHeight: 16,
    height: 32,
  },
  kpiSubscriptionTitleWrap: {
    flex: 1,
    marginLeft: 8,
    height: 32,
    justifyContent: 'center',
  },
  kpiSubscriptionTitleLine: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
    lineHeight: 16,
    includeFontPadding: false,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 0,
    paddingBottom: 0,
    paddingLeft: Platform.OS == "android" ? 0 : 15,
    paddingTop: 0,
    lineHeight: 26,
  },
  kpiValueMultiline: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 2,
  },
  kpiValueMetaMask: {
    fontSize: 24,
    paddingLeft: 0,
    paddingTop: 6,
    paddingBottom: 0,
    marginBottom: 0,
  },
  kpiMetaSingleLine: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    opacity: 0.85,
    paddingLeft: 0,
    paddingBottom: 0,
  },
  kpiMetaConnected: {
    color: '#16a34a',
  },
  kpiMetaDisconnected: {
    color: '#b45309',
  },
  kpiMetaBuyCredits: {
    opacity: 0.75,
    paddingLeft: Platform.OS == "android" ? 0 : 15,
  },
  kpiChevronInline: {
    position: 'absolute',
    top: Platform.OS == "android" ? 16 : 15,
    right: Platform.OS == "android" ? 0 : 22,
    opacity: 0.75,
  },
  kpiChevron: {
    opacity: 0.8,
  },
  kpiMetaMaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiMetaMaskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  kpiMetaMaskIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  kpiWalletIcon: {
    width: 28,
    height: 28,
  },
  kpiMetaMaskText: {
    flex: 1,
    minWidth: 0,
  },
  kpiMetaMaskStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  kpiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kpiMetaMaskStatusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  kpiMetaMaskHint: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.75,
    marginLeft: 2,
  },
  kpiChange: {
    fontSize: 12,
    color: '#10b981',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',

  },
  modalContent: {
    borderRadius: 24,
    padding: 0,
    overflow: 'hidden',
    maxHeight: '90%',
    zIndex: 1,
    backgroundColor: '#d1e5f5'
  },
  modalScrollContent: {
    // padding: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  modalTitleBlock: {
    flex: 1,
    marginRight: 12,
  },
  modalBadge: {
    width: 32,
    height: 32,
    borderRadius: 14,
    backgroundColor: '#fde68a',
    alignItems: 'center',
    // justifyContent: 'center',
    marginBottom: 10,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    // justifyContent: 'center',
    paddingRight: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    paddingLeft: 20,
    marginTop: '6%',
  },
  modalSectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
  },
  modalParagraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4b5563',
    marginBottom: 10,
  },
  modalBulletList: {
    marginBottom: 14,
  },
  modalBulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modalBulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7c3aed',
    marginTop: 8,
    marginRight: 10,
  },
  modalBulletText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
    flex: 1,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalCard: {
    width: '30%',
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  modalCardRange: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    borderRadius: 20,
    paddingHorizontal: 6,
    // paddingVertical: 4,
    marginHorizontal: 1,
    fontWeight: '600',
  },
  modalCardNote: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    width: '40%',
    alignSelf: 'center',
  },
  modalCloseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  lastRowCard: {
    flexGrow: 1,
    maxWidth: '45%',
    marginTop: -10
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
  activityMetricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
  },
  activityMetricCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: '#fafafa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  activityMetricCardCompact: {
    flex: 1,
    minWidth: 0,
  },
  activityMetricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activityMetricIconWrapCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginBottom: 4,
  },
  activityMetricValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  activityMetricValueCompact: {
    fontSize: 13,
  },
  activityMetricLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 1,
  },
  activityMetricLabelCompact: {
    fontSize: 10,
    marginBottom: 0,
  },
  activityMetricSub: {
    fontSize: 9,
    color: '#94a3b8',
    marginBottom: 1,
  },
  activityMetricSubCompact: {
    fontSize: 9,
    marginBottom: 0,
  },
  activityFollowingHint: {
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.85,
    marginBottom: 2,
  },
  activityDeltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  activityDeltaPillCompact: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginTop: 2,
  },
  activityDeltaText: {
    fontSize: 8,
    fontWeight: '600',
    flexShrink: 1,
  },
  activityDeltaTextCompact: {
    fontSize: 8,
  },
  activityLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 10,
  },
  activityLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityLegendText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  activityChartFootnote: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 10,
    lineHeight: 15,
  },
  activityChartScrollViewport: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  activityChartScrollContent: {
    alignItems: 'flex-start',
  },
  // Chart Container
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
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
  },
  avatarPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
  },
  avatarPreviewCloseBtn: {
    position: 'absolute',
    top: 44,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 10,
  },
  avatarPreviewZoomHost: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPreviewHexWrap: {
    width: AVATAR_PREVIEW_SIZE,
    height: AVATAR_PREVIEW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default WalletDashboardScreen;
