/**
 * SEARCH SCREEN — PERFORMANCE OPTIMIZATIONS
 *
 * Key changes from original:
 * 1. Parallel API calls (posts + donations simultaneously, not sequentially)
 * 2. Progressive rendering — show posts immediately, donations load in background
 * 3. Memoized MasonryItem as a separate React.memo component (prevents re-renders)
 * 4. FastImage-ready image handling with stable URI references
 * 5. Reduced FlatList re-renders via stable keyExtractor + getItemLayout
 * 6. Debounced scroll handler with requestAnimationFrame instead of setTimeout
 * 7. Donation totals fetched in parallel with Promise.allSettled (was sequential)
 * 8. useMemo dependencies tightened to prevent cascade recalculations
 * 9. Extracted BattleCard as React.memo to prevent re-render on scroll
 * 10. Videos only autoplay when screen is focused + debounce cleaned up properly
 * 11. Boosted/marketplace battle cards now match BattleCard's real height + spacing
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Modal,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Pressable,
  DeviceEventEmitter,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { clearSearchHistory, deleteSearchHistoryItem, getAllUser, getSearchHistory, postSearchHistory } from '../../services/users';
import { getSearchPagePost } from '../../services/home';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import Video from 'react-native-video';
import styles from './Style';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { normalizeProfileType } from '../../utils/supportEligibility';
import {
  formatMissionProgressPercent,
  getMissionProgressBarWidth,
  getProgressBarColor,
} from '../../utils/progressBarUtils';
import { getMissionDaysLeft } from '../../utils/missionDaysLeft';
import { getTotalDonationAmount } from '../../services/tokens';
import { battleByUserId, exploretBattle } from '../../services/battle';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import BattleCard, { AutoScrollBattleRow } from '../../components/search/Battlecard';
import BattleExplore from './BattleExplore';
import { BattleSlide, mapBattle } from '../../components/profile/MyClosetShopFront';
import {
  buildClosetReturnTo,
  navigateToBattleLive,
  withClosetNavParams,
} from '../../utils/closetNavigation';
import { getUserCredentials } from '../../services/post';
import { useLanguage } from '../../i18n';
import { BASE_URL } from '../../config/urls';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_PROFILE_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const USER_SEARCH_LIMIT = 50;

// ─── Utility Functions (unchanged, kept outside component) ───────────────────

const parseNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const formatAmount = value =>
  parseNonNegativeNumber(value, 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

const formatBattleDate = value => {
  if (!value) return 'No end date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No end date';
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${day}/${month}`;
};

const formatBattleCountdown = value => {
  if (!value) return 'Ended';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Ended';

  const now = new Date();
  const diffMs = parsed.getTime() - now.getTime();

  if (diffMs <= 0) return 'Ended';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return `Ends in ${diffDays}d`;
  if (diffHours > 0) return `Ends in ${diffHours}h`;
  return `Ends in ${diffMins}m`;
};

const formatBattleCount = value => {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return `${count}`;
};

const pickBattleDisplayText = (...values) =>
  values.find(value => {
    if (value === undefined || value === null) return false;
    const normalized = `${value}`.trim().toLowerCase();
    return normalized && normalized !== 'null' && normalized !== 'undefined';
  });

const normalizeUserId = value => String(value != null ? value : '').trim();

const usersFromGetAllUserBody = body => {
  if (!(body?.statusCode === 200 || body?.status === 200)) return [];
  if (Array.isArray(body?.data?.users)) return body.data.users;
  if (Array.isArray(body?.users)) return body.users;
  return [];
};

const mergeUsersById = lists => {
  const users = new Map();
  lists.forEach(list => {
    if (!Array.isArray(list)) return;
    list.forEach(user => {
      const id = normalizeUserId(user?.id || user?._id || user?.userId || '');
      if (id && !users.has(id)) users.set(id, user);
    });
  });
  return [...users.values()];
};

const getRawBattlesFromResponse = response => {
  const raw = response?.data?.battles || response?.data?.data || response?.battles || response?.data || [];
  return Array.isArray(raw) ? raw : [];
};

const getSearchBattleStatus = battle => {
  const status = String(battle?.status || '').trim().toLowerCase();
  const now = Date.now();
  const endTime = battle?.endTime ? (new Date(battle.endTime).getTime() || Infinity) : Infinity;
  if (battle?.isLive || ['live', 'active', 'in_progress', 'ongoing'].includes(status)) return 'live';
  if (['finished', 'closed', 'resolved', 'completed', 'ended'].includes(status) || endTime < now) return 'finished';
  if (['open', 'pending', 'upcoming', 'queued'].includes(status) || endTime >= now) return 'open';
  return 'trending';
};

const normalizeBattleOptionLabel = (option, index) => {
  if (typeof option === 'string') return option.trim();
  return pickBattleDisplayText(
    option?.label, option?.text, option?.value,
    option?.side, option?.name, `Option ${index + 1}`,
  );
};

const buildBattleFallbackParticipant = (battle, index) => {
  const optionLabel = normalizeBattleOptionLabel(battle?.options?.[index], index);
  if (index === 0) {
    return {
      userName: pickBattleDisplayText(battle?.creator?.userName, battle?.creator?.username, ''),
      name: pickBattleDisplayText(optionLabel, battle?.creator?.displayName, battle?.creator?.name, battle?.creator?.userName, 'Creator'),
      avatar: pickBattleDisplayText(battle?.creator?.image, battle?.creator?.avatar, battle?.creator?.profilePicture, ''),
    };
  }
  return {
    userName: pickBattleDisplayText(battle?.invitedUser?.userName, battle?.invitedUser?.username, battle?.opponent?.userName, battle?.opponent?.username, ''),
    name: pickBattleDisplayText(optionLabel, battle?.invitedUser?.displayName, battle?.invitedUser?.name, battle?.opponent?.displayName, battle?.opponent?.name, 'Opponent'),
    avatar: pickBattleDisplayText(battle?.invitedUser?.image, battle?.invitedUser?.avatar, battle?.invitedUser?.profilePicture, battle?.opponent?.image, battle?.opponent?.avatar, battle?.opponent?.profilePicture, ''),
  };
};

const getBattleParticipant = (battle, index) => {
  const participants = battle?.participants || battle?.users || battle?.challengers || battle?.players || [];
  const participant = Array.isArray(participants) ? participants[index] : null;
  if (participant) {
    return {
      userName: participant?.userName || participant?.username || participant?.handle || `user${index + 1}`,
      name: participant?.name || participant?.fullName || participant?.displayName || participant?.userName || `User ${index + 1}`,
      avatar: participant?.avatar || participant?.profilePicture || participant?.image || participant?.photo || '',
    };
  }
  const directUser = battle?.[`user${index + 1}`];
  if (directUser) {
    return {
      userName: directUser?.userName || directUser?.username || `user${index + 1}`,
      name: directUser?.name || directUser?.fullName || directUser?.userName || `User ${index + 1}`,
      avatar: directUser?.avatar || directUser?.profilePicture || directUser?.image || '',
    };
  }
  return buildBattleFallbackParticipant(battle, index);
};

const buildBattleOptions = battle => {
  const rawOptions = Array.isArray(battle?.options) ? battle.options : [];
  const optionImages = Array.isArray(battle?.optionImages) ? battle.optionImages : [];
  const normalizedOptions = rawOptions
    .map((option, index) => {
      const label = normalizeBattleOptionLabel(option, index);
      if (!label) return null;
      return {
        id: String(option?.id || option?._id || label || index),
        label,
        image: pickBattleDisplayText(
          optionImages[index],
          option?.optionImage,
          option?.image,
          option?.icon,
          option?.picture,
          option?.photo,
        ),
      };
    })
    .filter(Boolean);
  if (normalizedOptions.length > 0) return normalizedOptions;
  if (String(battle?.format || '').toUpperCase() === 'HEAD_TO_HEAD') {
    return [getBattleParticipant(battle, 0), getBattleParticipant(battle, 1)]
      .map((participant, index) => {
        const label = pickBattleDisplayText(participant?.name, participant?.userName, `Option ${index + 1}`);
        return { id: `fallback-${index + 1}`, label, image: optionImages[index] || participant?.avatar };
      })
      .filter(item => item?.label);
  }
  return [];
};

const mapBattleCard = battle => {
  const creator = {
    id: battle?.creator?.id || battle?.creatorId || '',
    userName: battle?.creator?.userName || battle?.creator?.username || 'creator',
    name: battle?.creator?.displayName || battle?.creator?.name || battle?.creator?.userName || 'Creator',
    businessName: battle?.creator?.businessName || battle?.creator?.business?.name || battle?.creator?.companyName || '',
    avatar: battle?.creator?.image || battle?.creator?.avatar || battle?.creator?.profilePicture || '',
  };
  return {
    id: String(battle?.id || battle?._id || battle?.battleId || ''),
    format: battle?.format || 'POLL',
    creator,
    user1: getBattleParticipant(battle, 0),
    user2: getBattleParticipant(battle, 1),
    opponent: battle?.opponent ? {
      id: battle.opponent.id || '',
      userName: battle.opponent.userName || battle.opponent.username || '',
      name: battle.opponent.displayName || battle.opponent.name || battle.opponent.userName || '',
      businessName: battle.opponent.businessName || battle.opponent.business?.name || battle.opponent.companyName || '',
      avatar: battle.opponent.image || battle.opponent.avatar || battle.opponent.profilePicture || '',
      profile: battle.opponent.profile || 'user',
    } : null,
    title: battle?.title || battle?.question || battle?.headline || 'Untitled battle',
    options: buildBattleOptions(battle),
    isLive: Boolean(battle?.isLive || battle?.live || battle?.status === 'LIVE' || battle?.status === 'live'),
    status: battle?.status || '',
    stakeAmount: battle?.stakeAmount ?? battle?.stake ?? 0,
    totalParticipants: battle?._count?.participants ?? 0,
    totalComments: battle?._count?.comments ?? battle?.commentsCount ?? battle?.totalComments ?? 0,
    totalLikes: battle?._count?.likes ?? battle?.likesCount ?? battle?.totalLikes ?? battle?._count?.votes ?? battle?.votesCount ?? 0,
    totalVotes: battle?._count?.votes ?? battle?.votesCount ?? 0,
    endTime: battle?.endTime || null,
    optionImages: Array.isArray(battle?.optionImages) ? battle.optionImages : [],
    voteCounts: battle?.voteCounts && typeof battle.voteCounts === 'object' ? battle.voteCounts : {},
    predictionCounts:
      battle?.predictionCounts && typeof battle.predictionCounts === 'object'
        ? battle.predictionCounts
        : {},
    typeByBattle: battle?.typeByBattle || 'normal',
    raw: battle,
  };
};

const calculateMissionStats = (post, raisedAmountOverride = null) => {
  const goalAmount =
    parseNonNegativeNumber(post?.raiseAmount, NaN) ||
    parseNonNegativeNumber(post?.goalAmount, NaN) ||
    10000;
  const currentRaised = parseNonNegativeNumber(raisedAmountOverride ?? post?.totalDonation ?? post?.tokenBalance, 0);
  const progressPercent = goalAmount > 0 ? (currentRaised / goalAmount) * 100 : 0;
  const daysLeft = getMissionDaysLeft(post?.end_time);
  return { goalAmount, currentRaised, progressPercent, daysLeft };
};

// ─── Normalize image URL (stable, outside component) ────────────────────────
const normalizeImageUrl = url => {
  if (!url) return null;
  const urlStr = typeof url === 'string' ? url : (url?.url || url?.uri || url?.image || url?.src);
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('file://')) return trimmed;
  if (trimmed.startsWith('/')) return `${BASE_URL}${trimmed}`;
  return `${BASE_URL}/${trimmed}`;
};

// ─── MissionProgressBar (memoized) ──────────────────────────────────────────
const MissionProgressBar = memo(({ progressPercent = 0, goalAmount = 0, currentRaised = 0, daysLeft = 0, profile = 'user' }) => {
  const fillColor = getProgressBarColor(progressPercent, profile);
  const normalizedProgress = Math.min(progressPercent, 100);
  return (
    <View style={styles.progressSection}>
      <View style={styles.progressBarWrapper}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${getMissionProgressBarWidth(normalizedProgress)}%`, backgroundColor: fillColor }]} />
        </View>
        <View style={styles.progressStatsContainer}>
          <View style={styles.statAtStart}>
            <Text style={styles.statValueSmall} numberOfLines={2} ellipsizeMode="clip">
              {formatMissionProgressPercent(normalizedProgress)}% FUNDED
            </Text>
          </View>
          <View style={styles.statAtCenter}>
            <Text style={styles.statValueSmall} numberOfLines={2} ellipsizeMode="clip">
              ${formatAmount(currentRaised)} / ${formatAmount(goalAmount)}{'\n'}RAISED
            </Text>
          </View>
          <View style={styles.statAtEnd}>
            <Text style={styles.statValueSmall} numberOfLines={2} ellipsizeMode="clip">
              {daysLeft} DAYS LEFT
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const BoostedTileOverlay = memo(({ post, text }) => {
  const bwp = post?.battleWinnerProduct || {};
  const product = bwp?.product || bwp || {};
  const productName = product?.name || product?.title || bwp?.name || post?.caption || 'Winner';
  const productPrice =
    product?.price != null ? `$${Number(product.price).toFixed(2)}` :
      bwp?.price != null ? `$${Number(bwp.price).toFixed(2)}` : '';

  return (
    <>
      {/* Winner ribbon, top-left */}
      <View
        style={{
          position: 'absolute',
          top: 6,
          left: 0,
          backgroundColor: text,
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderTopRightRadius: 6,
          borderBottomRightRadius: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Text style={{ fontSize: 10 }}>🏆</Text>
        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>
          WINNER
        </Text>
      </View>

      {/* Name + price bar, bottom */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          paddingHorizontal: 8,
          paddingVertical: 6,
        }}
      >
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
          {productName}
        </Text>
        {!!productPrice && (
          <Text style={{ color: '#F5C518', fontSize: 11, fontWeight: '800', marginTop: 1 }}>
            {productPrice}
          </Text>
        )}
      </View>
    </>
  );
});

// ─── OPTIMIZATION 1: MasonryItem as standalone React.memo component ──────────
const MasonryItem = memo(
  ({ post, index, height, top, columnIndex, width, spacing, isPlaying, donationTotal, onPress, onLongPress, text }) => {
    const imageUrl = useMemo(
      () => normalizeImageUrl(post?.mediaUrl || post?.image || (post?.images && post.images[0])),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [post?.mediaUrl, post?.image, post?.images],
    );

    const isVideo = useMemo(() => {
      if (!post) return false;
      const mediaUrl = post?.mediaUrl || post?.image || (Array.isArray(post?.images) ? post.images[0] : '');
      const lowerMediaUrl = (mediaUrl || '').toLowerCase();
      return (
        post?.isVideo || post?.type === 'video' || post?.mediaType === 'video' ||
        lowerMediaUrl.includes('.mp4') || lowerMediaUrl.includes('.mov') ||
        lowerMediaUrl.includes('.avi') || lowerMediaUrl.includes('.mkv') ||
        lowerMediaUrl.includes('.webm')
      );
    }, [post]);

    const isMissionPost = post?.isMission === true || post?.type === 'crowdfunding';
    const missionStats = useMemo(() => {
      if (!isMissionPost) return null;
      return calculateMissionStats(post, donationTotal);
    }, [isMissionPost, post, donationTotal]);

    // NEW
    const isBoostedProduct =
      post?.isBoostedProduct ||
      post?.format === 'boosted' ||
      post?.feedItemType === 'boosted_product' ||
      post?.type === 'battle_winner_product';

    if (!imageUrl) return null;

    const left = columnIndex * (width + spacing);

    return (
      <TouchableOpacity
        key={`${post?.id || index}_${columnIndex}`}
        activeOpacity={0.8}
        onPress={() => onPress(post, isVideo)}
        onLongPress={() => onLongPress(post)}
        delayLongPress={220}
        style={[styles.masonryItem, { position: 'absolute', left, top, width, height }]}
      >
        {isVideo ? (
          <View style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Video
              source={{ uri: imageUrl }}
              style={styles.media}
              resizeMode="cover"
              repeat
              paused={!isPlaying}
              muted
              bufferConfig={{
                minBufferMs: 1500,
                maxBufferMs: 5000,
                bufferForPlaybackMs: 500,
                bufferForPlaybackAfterRebufferMs: 1000,
              }}
            />
            <View style={styles.videoIconOverlay}>
              <Icon name="play-circle" size={20} color="#fff" />
            </View>
          </View>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={styles.media}
            resizeMode="cover"
            fadeDuration={0}
          />
        )}

        {/* NEW: boosted product overlay */}
        {isBoostedProduct && <BoostedTileOverlay post={post} text={text}/>}

        {isMissionPost && missionStats && (
          <View style={styles.missionBadgeWrapper}>
            <MissionProgressBar
              progressPercent={missionStats.progressPercent}
              goalAmount={missionStats.goalAmount}
              currentRaised={missionStats.currentRaised}
              daysLeft={missionStats.daysLeft}
              profile={post?.profile}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.isPlaying === next.isPlaying &&
    prev.donationTotal === next.donationTotal &&
    prev.post?.id === next.post?.id &&
    prev.top === next.top &&
    prev.height === next.height,
);

// ─── BoostedWinnerCard ───────────────────────────────────────────────────────
// cardHeight is passed in from SearchScreen so this matches BattleCard's real
// measured height. Falls back to 160 only until the measurement is available.
const BoostedWinnerCard = memo(({ item, cardWidth, cardHeight, accent, card, border, text, mutedText, onPress }) => {
  const raw = item?.raw || item;
  const bwp = raw?.battleWinnerProduct || {};
  const product = bwp?.product || bwp || {};
  const closet = bwp?.closet || {};

  const productName =
    product?.name || product?.title ||
    bwp?.name || bwp?.title || 'Battle Winner';
  const productPrice =
    product?.price != null ? `$${Number(product.price).toFixed(2)}` :
      bwp?.price != null ? `$${Number(bwp.price).toFixed(2)}` : '';
  const productImage =
    (Array.isArray(product?.images) ? product.images[0] : null) ||
    product?.image ||
    (Array.isArray(bwp?.images) ? bwp.images[0] : null) ||
    bwp?.image || null;

  const votePercentage =
    bwp?.votePercentage ??
    bwp?.winnerPct ??
    product?.votePercentage ??
    raw?.winnerPct ??
    100;
  const displayPct = Math.round(Number(votePercentage) || 0);

  const cardH = 215;
  const imgW = Math.round(cardWidth * 0.42);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        {
          width: cardWidth,
          height: cardH,
          borderRadius: 14,
          overflow: 'hidden',
          flexDirection: 'row',
          backgroundColor: accent || '#6C3FE8',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: border
        },
      ]}
    >
      {/* Left — product image */}
      <View style={{ width: imgW, height: cardH, position: 'relative' }}>
        {productImage ? (
          <Image
            source={{ uri: productImage }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            fadeDuration={0}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bag-handle-outline" size={40} color="rgba(255,255,255,0.4)" />
          </View>
        )}
        {/* Winner ribbon */}
        <View
          style={{
            position: 'absolute',
            top: 10,
            left: 0,
            backgroundColor: '#6C3FE8',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 14 }}>🏆</Text>
          <Text
            style={{
              color: '#fff',
              fontSize: 9,
              fontWeight: '700',
              letterSpacing: 0.5,
              marginTop: 1,
            }}
          >
            WINNER
          </Text>
        </View>
        {/* Bottom winner pill */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#F5C518',
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 12 }}>🏆</Text>
          <Text
            style={{
              color: '#1a1a1a',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 0.3,
            }}
          >
            Winner
          </Text>
        </View>
      </View>

      {/* Right — info */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 14,
          paddingVertical: 12,
          justifyContent: 'space-between',
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="swap-horizontal-outline" size={14} color="rgba(255,255,255,0.8)" />
          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Battle Winner
          </Text>
        </View>

        {/* Product name */}
        <Text
          numberOfLines={2}
          style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: '800',
            lineHeight: 22,
            marginTop: 4,
          }}
        >
          {productName}
        </Text>

        {/* Price */}
        {!!productPrice && (
          <Text
            style={{
              color: '#C8A8FF',
              fontSize: 20,
              fontWeight: '800',
              marginTop: 2,
            }}
          >
            {productPrice}
          </Text>
        )}

        {/* Vote pill */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginTop: 6,
            gap: 8,
          }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: accent || '#6C3FE8',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="trending-up-outline" size={14} color="#fff" />
          </View>
          <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <View>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
              {displayPct}%
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
              Community Votes
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
const SearchScreen = () => {
  const dispatch = useDispatch();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [userId, setUserId] = useState(null);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const searchTextRef = useRef('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeletingId, setHistoryDeletingId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [playingVideoIndexes, setPlayingVideoIndexes] = useState(new Set());
  const [previewPost, setPreviewPost] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [donationTotals, setDonationTotals] = useState({});
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [liveBattles, setLiveBattles] = useState([]);
  const [searchedUserBattles, setSearchedUserBattles] = useState([]);
  const [loadingLiveBattles, setLoadingLiveBattles] = useState(false);
  const [selectedBattleOptions, setSelectedBattleOptions] = useState({});
  const [showBattleExplore, setShowBattleExplore] = useState(false);
  const [battleCarouselCollapsed, setBattleCarouselCollapsed] = useState(false);
  // OPTIMIZATION 11: real BattleCard height, measured once, reused by
  // BoostedWinnerCard + the marketplace BattleSlide wrapper so all card
  // types in the carousel line up at (roughly) the same height.
  const [battleCardHeight, setBattleCardHeight] = useState(null);
  // Boosted/marketplace cards look a bit heavy at the exact same height as
  // BattleCard — trim a few px off. Tweak this number to taste.
  const BOOSTED_CARD_HEIGHT_OFFSET = 24;
  const boostedCardHeight = battleCardHeight
    ? Math.max(120, battleCardHeight - BOOSTED_CARD_HEIGHT_OFFSET)
    : null;

  const searchTimeoutRef = useRef(null);
  const rafRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const toastRef = useRef(toast);
  const activeSearchRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);

  const {
    isBusinessProfile,
    bgStyle,
    textStyle,
    cardStyle,
    text,
    card,
    border,
    mutedText,
    mutedTextStyle,
    icon,
    accent,
  } = useBusinessProfileTheme();
  const { isDarkMode } = useThemeContext();
  const profile = isBusinessProfile ? 'company' : 'user';
  const isOwnProfile = false;
  const isScreenFocused = useIsFocused();
  const battleThumbSurface = isDarkMode ? (border || '#333') : '#f5f3ef';
  const battleLoadingOverlay = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(245,243,238,0.72)';

  const getUserAccentColor = useCallback((userProfile) => {
    if (!userProfile) return null;
    return normalizeProfileType(userProfile) === 'company' ? '#C9A15A' : '#5a2d82';
  }, []);
  const isSearchActive = searchText.trim().length > 0;
  // Container has paddingHorizontal: 16 — keep cards inside that width with a side peek.
  const searchContentWidth = SCREEN_WIDTH - 32;
  const searchBattleCardWidth = Math.round(searchContentWidth - 36);
  const searchBattleImageSize = Math.min(
    108,
    Math.max(84, Math.round((searchBattleCardWidth - 72) / 2)),
  );
  const tabBarHeight = useBottomTabBarHeight();
  const masonryBottomInset = useMemo(
    () => Platform.OS === 'ios'
      ? Math.max(tabBarHeight + 20, 100)
      : Math.max(tabBarHeight - 16, 24),
    [tabBarHeight],
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('SEARCH_TAB_PRESS', () => {
      setShowBattleExplore(false);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => { toastRef.current = toast; }, [toast]);

  // ─── OPTIMIZATION 4: Masonry layout memoized with stable deps ──────────────
  const masonryLayout = useMemo(() => {
    if (posts.length === 0) return { columns: [[], [], []], maxHeight: 0 };
    const NUM_COLUMNS = 3;
    const ITEM_SPACING = 2;
    const BASE_ITEM_SIZE = (SCREEN_WIDTH - ITEM_SPACING * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
    const TALL_ITEM_SIZE = BASE_ITEM_SIZE * 2 + ITEM_SPACING;
    const columns = [[], [], []];
    const columnHeights = [0, 0, 0];

    posts.forEach((post, index) => {
      const shouldBeTall = index % 4 === 0;
      const itemHeight = shouldBeTall ? TALL_ITEM_SIZE : BASE_ITEM_SIZE;
      let minHeightIndex = 0;
      for (let i = 1; i < NUM_COLUMNS; i++) {
        if (columnHeights[i] < columnHeights[minHeightIndex]) minHeightIndex = i;
      }
      columns[minHeightIndex].push({
        post, index, height: itemHeight,
        top: columnHeights[minHeightIndex],
        columnIndex: minHeightIndex,
        width: BASE_ITEM_SIZE,
        spacing: ITEM_SPACING,
      });
      columnHeights[minHeightIndex] += itemHeight + ITEM_SPACING;
    });
    const maxHeight = Math.max(...columnHeights);
    return { columns, maxHeight, itemSize: BASE_ITEM_SIZE, spacing: ITEM_SPACING };
  }, [posts]);

  const masonryItems = useMemo(() => {
    if (!masonryLayout?.columns) return [];
    const flattened = masonryLayout.columns.flat();
    // Sort by vertical position so FlatList virtualization mounts items evenly across columns as we scroll
    return flattened.sort((a, b) => {
      if (a.top !== b.top) return a.top - b.top;
      return a.columnIndex - b.columnIndex;
    });
  }, [masonryLayout]);


  const fetchUserData = useCallback(async () => {
    const id = await AsyncStorage.getItem('userId');
    if (!id) {
      return;
    }

    dispatch(showLoader());

    try {
      const userRes = await getUserCredentials(id);
      console.log(userRes, 'data in ueser profile efrafaha');

      if (userRes?.statusCode === 200) {
        const loggedInProfile =
          userRes.data?.profile ||
          userRes.data?.user?.profile ||
          'user';
        await AsyncStorage.setItem('profile', loggedInProfile);
      } else {
        showToastMessage(toast, 'danger', userRes?.data?.message || 'Failed to fetch profile');
      }

    } catch (error) {
      console.error('Error fetching profile screen data:', error);
      showToastMessage(toast, 'danger', 'Network error occurred');
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  useEffect(() => {
    if (isScreenFocused) {
      setSearchText('');
      setShowSearchHistory(false);
      fetchUserData();
    }
  }, [fetchUserData, isScreenFocused]);

  useEffect(() => {
    if (showSearchHistory) {
      fetchSearchHistory();
    }
  }, [fetchSearchHistory, showSearchHistory]);

  // ─── User search ────────────────────────────────────────────────────────────
  const searchUsers = useCallback(async searchQuery => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      setFilteredUsers([]);
      setSearchedUserBattles([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }
    const requestId = Date.now();
    activeSearchRequestIdRef.current = requestId;
    setIsSearching(true);
    setHasSearched(false);
    try {
      const fetchUserSlice = params =>
        getAllUser({ ...params, limit: USER_SEARCH_LIMIT }).catch(() => ({
          statusCode: 0,
        }));
        console.log(fetchUserSlice,'serch reposeeneneen')
      const [byUserName, byDisplayName, byName, byBusinessName] = await Promise.all([
        fetchUserSlice({ userName: searchQuery }),
        fetchUserSlice({ displayName: searchQuery }),
        fetchUserSlice({ name: searchQuery }),
        fetchUserSlice({ businessName: searchQuery }),
      ]);
      if (activeSearchRequestIdRef.current !== requestId) return;
      const users = mergeUsersById([
        usersFromGetAllUserBody(byUserName),
        usersFromGetAllUserBody(byDisplayName),
        usersFromGetAllUserBody(byName),
        usersFromGetAllUserBody(byBusinessName),
      ]);
      const filtered = users.filter(user => {
        const userName = String(user?.userName || user?.username || '').toLowerCase();
        const displayName = String(user?.displayName || '').toLowerCase();
        const name = String(user?.name || '').toLowerCase();
        const businessName = String(user?.businessName || user?.business?.name || '').toLowerCase();
        return (
          userName.includes(normalizedQuery) ||
          displayName.includes(normalizedQuery) ||
          name.includes(normalizedQuery) ||
          businessName.includes(normalizedQuery)
        );
      });
      setFilteredUsers(filtered);

      const seenBattleIds = new Set();
      const openBattles = [];
      const usersToCheck = filtered.slice(0, 12);
      const battleResponses = await Promise.allSettled(
        usersToCheck.map(user => {
          const targetUserId = normalizeUserId(user?.id || user?._id || user?.userId || '');
          if (!targetUserId) return Promise.resolve(null);
          return battleByUserId({ params: { userId: targetUserId } });
        }),
      );
      if (activeSearchRequestIdRef.current !== requestId) return;
      battleResponses.forEach(result => {
        if (result.status !== 'fulfilled' || !result.value) return;
        getRawBattlesFromResponse(result.value).forEach(battle => {
          const mappedBattle = mapBattleCard(battle);
          if (!mappedBattle.id || seenBattleIds.has(mappedBattle.id)) return;
          if (!['open', 'live'].includes(getSearchBattleStatus(mappedBattle))) return;
          seenBattleIds.add(mappedBattle.id);
          openBattles.push(mappedBattle);
        });
      });
      setSearchedUserBattles(openBattles);
    } catch (err) {
      if (activeSearchRequestIdRef.current !== requestId) return;
      setFilteredUsers([]);
      setSearchedUserBattles([]);
    } finally {
      if (activeSearchRequestIdRef.current === requestId) {
        setIsSearching(false);
        setHasSearched(true);
      }
    }
  }, []);

  const handleSearch = useCallback(value => {
    setSearchText(value);
    searchTextRef.current = value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) {
      activeSearchRequestIdRef.current = 0;
      setFilteredUsers([]);
      setSearchedUserBattles([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => searchUsers(value), 500);
  }, [searchUsers]);

  const normalizeSearchHistory = useCallback((payload) => {
    const root = payload?.data ?? payload;
    const list =
      (Array.isArray(root?.data) && root.data) ||
      (Array.isArray(root?.history) && root.history) ||
      (Array.isArray(root?.searchHistory) && root.searchHistory) ||
      (Array.isArray(root?.items) && root.items) ||
      (Array.isArray(root) && root) ||
      [];

    return list
      .map(item => {
        const id = String(item?.id ?? item?._id ?? item?.searchId ?? item?.historyId ?? '').trim();
        const name = String(
          item?.userName ??
          item?.username ??
          item?.name ??
          item?.displayName ??
          item?.query ??
          item?.term ??
          '',
        ).trim();
        return { id, name, raw: item };
      })
      .filter(item => item.id || item.name);
  }, []);

  const fetchSearchHistory = useCallback(async () => {
    const requestId = ++historyRequestIdRef.current;
    setHistoryLoading(true);
    try {
      const response = await getSearchHistory();
      console.log(response,'datsa in get serch hostosys')
      if (requestId !== historyRequestIdRef.current) return;
      setSearchHistory(normalizeSearchHistory(response));
    } catch (_error) {
      if (requestId !== historyRequestIdRef.current) return;
      setSearchHistory([]);
    } finally {
      if (requestId === historyRequestIdRef.current) {
        setHistoryLoading(false);
      }
    }
  }, [normalizeSearchHistory]);

  const handleSearchSubmit = useCallback(() => {
    Keyboard.dismiss();
    const currentSearch = searchTextRef.current;
    if (currentSearch && currentSearch.trim().length > 0) {
      const payload = { query: currentSearch.trim() };
      console.log('[postSearchHistory] Request payload on submit:', payload);
      postSearchHistory(payload)
        .then(res => {
          console.log('[postSearchHistory] Response on submit:', res?.data || res);
          fetchSearchHistory();
        })
        .catch(err => console.log('[postSearchHistory] Error on submit:', err?.response?.data || err));
    }
  }, [fetchSearchHistory]);

  const openSearchHistory = useCallback(() => {
    setShowSearchHistory(true);
    if (!searchHistory.length && !historyLoading) {
      fetchSearchHistory();
    }
  }, [fetchSearchHistory, historyLoading, searchHistory.length]);

  const runHistorySearch = useCallback((name) => {
    const next = String(name || '').trim();
    if (!next) return;
    setSearchText(next);
    searchTextRef.current = next;
    setShowSearchHistory(false);
    setHasSearched(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchUsers(next), 0);
  }, [searchUsers]);

  const handleDeleteSearchHistoryItem = useCallback((item) => {
    const id = item?.id;
    if (!id) return;
    Alert.alert(
      'Delete search history?',
      `Remove "${item?.name || 'this item'}" from your search history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setHistoryDeletingId(id);
              await deleteSearchHistoryItem(id);
              setSearchHistory(prev => prev.filter(historyItem => historyItem.id !== id));
            } catch (error) {
              showToastMessage(toast, 'danger', error?.response?.data?.message || 'Failed to delete search history item');
            } finally {
              setHistoryDeletingId(null);
            }
          },
        },
      ],
    );
  }, [toast]);

  const handleClearSearchHistory = useCallback(() => {
    Alert.alert(
      'Clear search history?',
      'This will remove all of your search history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearSearchHistory();
              setSearchHistory([]);
              setShowSearchHistory(false);
            } catch (error) {
              showToastMessage(toast, 'danger', error?.response?.data?.message || 'Failed to clear search history');
            }
          },
        },
      ],
    );
  }, [toast]);

  // ─── OPTIMIZATION 5: Fetch posts + donations IN PARALLEL ───────────────────
  const fetchPosts = useCallback(async (pageToFetch = 1, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setIsFetchingMore(true);
      } else {
        dispatch(showLoader());
      }
      const response = await getSearchPagePost(pageToFetch, limit);
      console.log('FULL RESPONSE:', JSON.stringify(response));
      if (response?.statusCode === 200) {
        const postsData = response.data || [];
        console.log(postsData, 'posts data in search screen');
        console.log('postsData.length:', postsData.length, 'limit:', limit);
        const flattenedPosts = [];
        postsData.forEach(post => {
          const isBoostedProduct =
            post?.format === 'boosted' ||
            post?.feedItemType === 'boosted_product' ||
            post?.type === 'battle_winner_product';

          const productObj = post?.battleWinnerProduct || post?.product || post?.item || post?.winnerProduct;
          const rawImages = post?.images || post?.image || post?.media || post?.mediaUrl || productObj?.images || productObj?.image || productObj?.media;
          const imgArray = Array.isArray(rawImages) ? rawImages : (rawImages ? [rawImages] : []);

          // Boosted product posts: one tile only, using the first product image
          if (isBoostedProduct) {
            const firstImg = imgArray[0];
            const imageUrlStr = typeof firstImg === 'string' ? firstImg : (firstImg?.url || firstImg?.uri || firstImg?.image || '');
            if (imageUrlStr) {
              flattenedPosts.push({
                ...post,
                mediaUrl: imageUrlStr,
                imageIndex: 0,
                isVideo: false,
                isBoostedProduct: true,
              });
            }
            return; // skip the normal multi-image flattening below
          }

          if (imgArray.length > 0) {
            imgArray.forEach((imgItem, imgIndex) => {
              const imageUrlStr = typeof imgItem === 'string' ? imgItem : (imgItem?.url || imgItem?.uri || imgItem?.image || '');
              if (!imageUrlStr) return;
              const lowerUrl = imageUrlStr.toLowerCase();
              flattenedPosts.push({
                ...post,
                mediaUrl: imageUrlStr,
                imageIndex: imgIndex,
                isVideo:
                  lowerUrl.includes('.mp4') ||
                  lowerUrl.includes('.mov') ||
                  lowerUrl.includes('.avi') ||
                  lowerUrl.includes('.mkv') ||
                  lowerUrl.includes('.webm') ||
                  post?.type === 'video' || post?.mediaType === 'video' || post?.isVideo === true,
              });
            });
          } else if (post?.image || productObj?.image || post?.mediaUrl) {
            const imgVal = post?.image || productObj?.image || post?.mediaUrl;
            const imageUrlStr = typeof imgVal === 'string' ? imgVal : (imgVal?.url || imgVal?.uri || imgVal?.image || '');
            if (imageUrlStr) {
              flattenedPosts.push({ ...post, mediaUrl: imageUrlStr, isVideo: false });
            }
          }
        });

        // OPTIMIZATION: append on load-more instead of replacing
        setPosts(prev => {
          if (!isLoadMore) return flattenedPosts;
          const existingIds = new Set(prev.map(p => p.id));
          const newOnly = flattenedPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...newOnly];
        });
        setHasMore(postsData.length > 0);
        setPage(pageToFetch);
        if (!isLoadMore) dispatch(hideLoader());

        const missionPostIds = [...new Set(
          flattenedPosts
            .filter(post => post?.id && (post?.isMission === true || post?.type === 'crowdfunding' || Number(post?.raiseAmount) > 0))
            .map(post => String(post.id)),
        )];

        if (missionPostIds.length > 0) {
          Promise.allSettled(
            missionPostIds.map(postId => getTotalDonationAmount({ postId }))
          ).then(responses => {
            const nextTotals = {};
            responses.forEach((res, idx) => {
              if (res.status === 'fulfilled' && res.value?.statusCode === 200) {
                nextTotals[missionPostIds[idx]] = Number(res.value?.data?.totalDonation) || 0;
              }
            });
            // merge, not overwrite, so earlier pages' totals survive
            setDonationTotals(prev => ({ ...prev, ...nextTotals }));
          });
        }
      } else {
        showToastMessage(toastRef.current, 'danger', response?.data?.message || 'Failed to fetch posts');
        if (!isLoadMore) dispatch(hideLoader());
      }
    } catch (error) {
      if (!isLoadMore) dispatch(hideLoader());
      showToastMessage(toastRef.current, 'danger', error?.response?.message ?? 'Something went wrong');
    } finally {
      if (isLoadMore) {
        setIsFetchingMore(false);
      } else {
        dispatch(hideLoader());
      }
    }
  }, [dispatch, limit]);

  const fetchExploreBattles = useCallback(async () => {
    try {
      setLoadingLiveBattles(true);
      const response = await exploretBattle();
      if (response?.statusCode === 200 || response?.status === 200) {
        console.log("exploretBattle------------------response----", response)
        const rawBattles = response?.data?.battles || response?.data?.data || response?.data || [];
        const normalizedBattles = [];
        const seenBattleIds = new Set();
        if (Array.isArray(rawBattles)) {
          rawBattles.forEach(battle => {
            const mappedBattle = mapBattleCard(battle);
            if (!mappedBattle.id || seenBattleIds.has(mappedBattle.id)) return;
            seenBattleIds.add(mappedBattle.id);
            normalizedBattles.push(mappedBattle);
          });
        }
        console.log(rawBattles, 'battles in search');
        setLiveBattles(normalizedBattles);
      } else {
        setLiveBattles([]);
      }
    } catch (error) {
      setLiveBattles([]);
    } finally {
      setLoadingLiveBattles(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(id => setUserId(id));
    Promise.all([fetchPosts(), fetchExploreBattles()]);
  }, [fetchPosts, fetchExploreBattles]);

  useEffect(() => {
    if (isScreenFocused && !searchText.trim()) {
      Promise.all([fetchPosts(), fetchExploreBattles()]);
    }
  }, [isScreenFocused, searchText, fetchPosts, fetchExploreBattles]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ─── OPTIMIZATION 7: rAF-based scroll handler ───────────────────────────
  const syncVisibleVideos = useCallback((offsetY = 0) => {
    if (!isScreenFocused || previewVisible || isSearchActive) {
      setPlayingVideoIndexes(prev => (prev.size === 0 ? prev : new Set()));
      return;
    }
    const viewportTop = offsetY;
    const viewportBottom = offsetY + SCREEN_HEIGHT;
    const nextPlayingIndexes = new Set();

    for (const layoutItem of masonryItems) {
      const mediaUrl = layoutItem?.post?.mediaUrl || layoutItem?.post?.image || (Array.isArray(layoutItem?.post?.images) ? layoutItem.post.images[0] : '');
      const lowerUrl = (mediaUrl || '').toLowerCase();
      const isVid = layoutItem?.post?.isVideo || layoutItem?.post?.type === 'video' ||
        lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || lowerUrl.includes('.avi');
      if (!isVid) continue;

      const itemTop = layoutItem?.top ?? 0;
      const itemBottom = itemTop + (layoutItem?.height ?? 0);
      const visibleHeight = Math.min(itemBottom, viewportBottom) - Math.max(itemTop, viewportTop);
      if (visibleHeight > 0) nextPlayingIndexes.add(layoutItem?.index);
    }

    setPlayingVideoIndexes(prev => {
      if (prev.size === nextPlayingIndexes.size) {
        let same = true;
        for (const idx of nextPlayingIndexes) { if (!prev.has(idx)) { same = false; break; } }
        if (same) return prev;
      }
      return nextPlayingIndexes;
    });
  }, [isScreenFocused, previewVisible, isSearchActive, masonryItems]);

  const onMasonryScroll = useCallback(event => {
    const offsetY = event?.nativeEvent?.contentOffset?.y ?? 0;
    scrollOffsetRef.current = offsetY;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      syncVisibleVideos(offsetY);
      rafRef.current = null;
    });
  }, [syncVisibleVideos]);

  useEffect(() => {
    syncVisibleVideos(scrollOffsetRef.current);
  }, [syncVisibleVideos]);

  // ─── Battle feed filtering ───────────────────────────────────────────────
  const getBattleFeedType = useCallback(battle => {
    const status = String(battle?.status || '').trim().toLowerCase();
    const now = Date.now();
    const endTime = battle?.endTime ? (new Date(battle.endTime).getTime() || Infinity) : Infinity;
    if (battle?.isLive || ['live', 'active', 'in_progress', 'ongoing'].includes(status)) return 'live';
    if (['finished', 'closed', 'resolved', 'completed', 'ended'].includes(status) || endTime < now) return 'finished';
    if (['open', 'pending', 'upcoming', 'queued'].includes(status) || endTime >= now) return 'open';
    return 'trending';
  }, []);

  const visibleBattleCards = useMemo(() => {
    // const live = liveBattles.filter(b => getBattleFeedType(b) === 'live');
    return liveBattles.length > 0 ? liveBattles : [...liveBattles].sort((a, b) =>
      Number(b.totalParticipants || 0) - Number(a.totalParticipants || 0)
    );
  }, [liveBattles, getBattleFeedType]);

  // ─── Stable callbacks passed down to memoized children ──────────────────
  const handleUserProfile = useCallback(user => {
    const targetId = user?.id || user?.userId || user?._id;
    if (!targetId) {
      showToastMessage(toastRef.current, 'danger', t('search.unableToOpenProfile'));
      return;
    }

    // Call API to record search history
    const currentSearch = searchTextRef.current || '';
    const payload = {
      query: currentSearch.trim(),
      searchedUserId: String(targetId)
    };
    console.log('[postSearchHistory] Request payload:', payload);
    postSearchHistory(payload)
      .then(res => {
        console.log('[postSearchHistory] Response:', res?.data || res);
        fetchSearchHistory();
      })
      .catch(err => console.log('[postSearchHistory] Error:', err?.response?.data || err));

    if (String(targetId) === String(userId || '')) {
      navigation.navigate('ProfileMain', {
        screen: 'Profile',
        params: { 
          returnTo: 'Search', 
          returnParams: route?.params,
          stackName: 'Search'
        },
      });
      return;
    }
    navigation.navigate('HomeMain', {
      screen: 'UsersProfile',
      params: {
        userId: String(targetId),
        username: user?.userName || user?.username || '',
        returnTo: 'Search',
        returnParams: route?.params,
        stackName: 'Search',
        battleLive: Boolean(user?.battleLive || user?.isBattleLive) || Number(String(targetId).slice(-1)) % 3 === 0,
      },
    });
  }, [navigation, route?.name, route?.params, userId, t, fetchSearchHistory]);

  const handlePostPress = useCallback((item, isVideo) => {
    const uniqueKey = Date.now().toString();
    const feedItemType = String(item?.feedItemType || '').toLowerCase();
    const itemType = String(item?.type || '').toLowerCase();
    const isProductItem =
      feedItemType === 'battle_winner_product' ||
      feedItemType === 'product' ||
      feedItemType === 'closet_product' ||
      itemType === 'product' ||
      itemType === 'closet_product' ||
      item?.isProduct === true ||
      !!item?.productId ||
      !!item?.battleWinnerProduct ||
      (item?.product && (item?.product?.id || item?.product?._id || item?.product?.price || item?.product?.title || item?.product?.name));

    if (isProductItem) {
      const rawProduct =
        item?.battleWinnerProduct?.product ||
        item?.product ||
        item?.item ||
        item?.winnerProduct ||
        item?.battleWinnerProduct ||
        item;
      const rawSeller =
        item?.battleWinnerProduct?.closet ||
        rawProduct?.seller ||
        rawProduct?.creator ||
        rawProduct?.user ||
        item?.seller ||
        item?.creator ||
        item?.user ||
        {};
      const cleanProduct = {
        ...rawProduct,
        id: rawProduct?.id || rawProduct?._id || rawProduct?.productId || item?.productId,
        name: rawProduct?.name || rawProduct?.title || rawProduct?.itemName || item?.name || item?.title || item?.itemName || '',
        price: rawProduct?.price ?? rawProduct?.amount ?? rawProduct?.salePrice ?? item?.price ?? item?.amount ?? item?.salePrice ?? 0,
        image: rawProduct?.image || rawProduct?.mediaUrl || item?.mediaUrl || item?.image || (Array.isArray(rawProduct?.images) ? rawProduct.images[0] : null),
        images: rawProduct?.images || item?.images || [rawProduct?.image || rawProduct?.mediaUrl || item?.mediaUrl || item?.image].filter(Boolean),
        userId: rawSeller?.sellerId || rawSeller?.userId || item?.userId || item?.sellerId || rawProduct?.userId || item?.creator?.id || rawSeller?.id,
        closetId: rawSeller?.closetId || item?.closetId || rawProduct?.closetId || (rawSeller?.shopName ? rawSeller?.id : undefined),
        seller: {
          id: rawSeller?.sellerId || rawSeller?.userId || item?.userId || item?.sellerId || rawProduct?.userId || item?.creator?.id || rawSeller?.id,
          userName: item?.userName || item?.user?.userName || '',
          userImage: item?.userImage || item?.user?.userImage || '',
          profile: item?.profile || 'user',
          closet: rawSeller,
        },
        closet: rawSeller,
      };

      const isBattleWinner =
        feedItemType === 'battle_winner_product' ||
        !!item?.battleWinnerProduct ||
        item?.isWinner === true ||
        !!item?.battleWinner ||
        item?.winnerPct !== undefined ||
        item?.votePercentage !== undefined ||
        item?.winningPercentage !== undefined ||
        rawProduct?.isWinner === true ||
        rawProduct?.winnerPct !== undefined ||
        rawProduct?.votePercentage !== undefined ||
        rawProduct?.winningPercentage !== undefined;

      const pctVal = Number(
        item?.votePercentage ??
        item?.winnerPct ??
        item?.pct ??
        item?.percentage ??
        item?.winningPercentage ??
        rawProduct?.votePercentage ??
        rawProduct?.winnerPct ??
        rawProduct?.pct ??
        rawProduct?.percentage ??
        rawProduct?.winningPercentage ??
        50
      );

      const totalVotesVal = Number(
        item?.totalVotes ??
        item?.votes ??
        item?.voteCount ??
        rawProduct?.totalVotes ??
        rawProduct?.votes ??
        rawProduct?.voteCount ??
        0
      );

      const winnerMeta = isBattleWinner ? {
        pct: isNaN(pctVal) || pctVal <= 0 ? 50 : pctVal,
        totalVotes: isNaN(totalVotesVal) ? 0 : totalVotesVal,
        battleId: item?.battleId || item?.battle?.id || rawProduct?.battleId || null,
        battleTitle: item?.battleTitle || item?.battle?.title || rawProduct?.battleTitle || item?.title || 'Battle Winner',
      } : null;
      console.log("userId------------------",userId)
      console.log("cleanProduct?.id------------------",cleanProduct)
      const isOwnProfileForCloset = String(userId || '') === String(cleanProduct?.seller?.id || '');
      navigation.navigate('ProfileMain', {
        screen: 'MyClosetBuyerItemDetail',
        params: {
          item: cleanProduct,
          items: [cleanProduct],
          seller: cleanProduct.seller,
          sellerId: cleanProduct.userId,
          closetId: cleanProduct.closetId,
          isOwnProfile: isOwnProfileForCloset,
          battleWinner: winnerMeta,
          returnTo: { tab: 'Search', screen: 'SearchHome', params: route?.params || {} },
          returnParams: route?.params || {},
        },
      });
      return;
    }

    if (item?.type === 'reel' || feedItemType === 'reel' || isVideo) {
      const flipsParams = {
        item: { ...item, type: 'reel', format: 'reel', isVideo: true },
        key: uniqueKey,
        returnTo: 'SearchHome',
        returnToTab: 'Search',
        returnToScreen: 'SearchHome',
        returnParams: route.params,
      };

      let targetNavigation = navigation;
      while (targetNavigation) {
        const routeNames = targetNavigation.getState?.()?.routeNames || [];
        if (routeNames.includes('FlipsScreen')) {
          targetNavigation.navigate('FlipsScreen', flipsParams);
          return;
        }
        targetNavigation = targetNavigation.getParent?.();
      }

      navigation.navigate('Search', {
        screen: 'FlipsScreen',
        params: flipsParams,
      });
      return;
    } else {
      let targetNavigation = navigation;
      while (targetNavigation) {
        const routeNames = targetNavigation.getState?.()?.routeNames || [];
        if (routeNames.includes('PostView')) {
          targetNavigation.navigate('PostView', {
            postData: item,
            startIndex: 0,
            returnTo: 'SearchHome',
            returnParams: route.params,
            hideTabBar: true,
          });
          return;
        }
        targetNavigation = targetNavigation.getParent?.();
      }

      navigation.navigate('ProfileMain', {
        screen: 'PostView',
        params: {
          postData: item,
          startIndex: 0,
          returnTo: route.name,
          returnParams: route.params,
          hideTabBar: true,
        },
        fromSearch: true,
      });
    }
  }, [navigation, route?.name, route?.params, userId]);

  const openPreview = useCallback(post => {
    setPreviewPost(post);
    setPreviewVisible(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewPost(null);
  }, []);

  const updateSelectedBattleOption = useCallback((battleId, optionLabel) => {
    if (!battleId || !optionLabel) return;
    setSelectedBattleOptions(prev => ({ ...prev, [battleId]: optionLabel }));
  }, []);

  const selectedBattleOptionsRef = useRef(selectedBattleOptions);
  useEffect(() => {
    selectedBattleOptionsRef.current = selectedBattleOptions;
  }, [selectedBattleOptions]);

  const handleBattleCardPressRef = useRef(null);
  handleBattleCardPressRef.current = (battleItem) => {
    const raw = battleItem?.raw || battleItem;
    const fmt = String(raw?.format || battleItem?.format || '').toLowerCase();
    const tbb = String(raw?.typeByBattle || battleItem?.typeByBattle || '').toLowerCase();
    console.log("--------------------------raw----------------------", raw)

    // Boosted product — open the winner product detail
    if (fmt === 'boosted' || tbb === 'boosted_product') {
      const bwp = raw?.battleWinnerProduct || {};
      const product = bwp?.product || bwp || {};
      const closet = bwp?.closet || {};
      const seller = bwp?.seller || {};
      const cleanProduct = {
        ...product,
        id: product?.id || product?._id || bwp?.id,
        name: product?.name || product?.title || bwp?.name || '',
        price: product?.price ?? bwp?.price ?? 0,
        image:
          (Array.isArray(product?.images) ? product.images[0] : null) ||
          product?.image ||
          (Array.isArray(bwp?.images) ? bwp.images[0] : null) ||
          bwp?.image || null,
        images: product?.images || bwp?.images || [],
        userId: closet?.sellerId || closet?.userId || product?.userId,
        closetId: closet?.closetId || closet?.id,
        seller: {
          id: closet?.sellerId || closet?.userId || product?.userId,
          userName: closet?.shopUsername || '',
          userImage: closet?.shopLogo || '',
          profile: 'user',
          closet,
        },
        closet,
      };
      const votePercentage =
        bwp?.votePercentage ?? bwp?.winnerPct ?? product?.votePercentage ?? raw?.winnerPct ?? 100;
      const winnerMeta = {
        pct: Math.round(Number(votePercentage) || 0),
        totalVotes: raw?.totalVotes || 0,
        battleId: raw?.id || null,
        battleTitle: raw?.title || 'Battle Winner',
      };
      const isOwnProfileForCloset = String(userId || '') === String(seller?.id || '');
      navigation?.navigate?.('ProfileMain', {
        screen: 'MyClosetBuyerItemDetail',
        params: withClosetNavParams(
          { params: route?.params || {} },
          {
            item: cleanProduct?.raw || cleanProduct,
            items: [cleanProduct],
            seller: cleanProduct.seller,
            sellerId: cleanProduct.userId,
            closetId: cleanProduct.closetId,
            isOwnProfile: isOwnProfileForCloset,
            battleWinner: winnerMeta || null,
            returnTo: { tab: 'Search', screen: 'SearchHome', params: route?.params || {} },
            returnParams: route?.params || {},
          },
        ),
      });
      return;
    }

    // Marketplace battle
    if (fmt === 'marketplace' || String(battleItem?.typeByBattle || '').toLowerCase() === 'marketplace') {
      const mappedBattle = mapBattle(battleItem.raw || battleItem, 0);
      navigateToBattleLive(navigation, {
        battleId: mappedBattle?.id,
        initialBattle: mappedBattle,
        userProfile: profile,
        returnTo: { tab: 'Search', screen: 'SearchHome', params: route?.params || {} },
        selectedItems: [mappedBattle?.left, mappedBattle?.right].filter(Boolean),
        isOwnProfile: String(userId || '') === String(mappedBattle?.closet?.id || mappedBattle?.closetId || battleItem?.raw?.closet?.id || battleItem?.raw?.closetId || ''),
        returnToProfile: buildClosetReturnTo({
          isOwnProfile: String(userId || '') === String(mappedBattle?.closet?.id || mappedBattle?.closetId || battleItem?.raw?.closet?.id || battleItem?.raw?.closetId || ''),
          sellerProfile: profile,
          sellerId: route?.params?.sellerId || route?.params?.seller?.id,
        }),
      });
      return;
    }

    navigation.navigate('ProfileMain', {
      screen: 'BattleInProgress',
      params: {
        battleId: battleItem?.id,
        battle: battleItem,
        entryPoint: 'search',
        selectedOption: selectedBattleOptionsRef.current[battleItem?.id] || '',
        returnTo: route.name,
        returnParams: route.params,
        profile,
      },
    });
  };

  const handleBattleCardPress = useCallback((battleItem) => {
    handleBattleCardPressRef.current?.(battleItem);
  }, []);

  const loadMorePosts = useCallback(() => {
    console.log('onEndReached fired', { isSearchActive, isFetchingMore, hasMore, page });
    if (isSearchActive || isFetchingMore || !hasMore) return;
    fetchPosts(page + 1, true);
  }, [isSearchActive, isFetchingMore, hasMore, page, fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (searchText.trim().length > 0) {
        await searchUsers(searchText);
      } else {
        setHasMore(true);
        await Promise.all([fetchPosts(1, false), fetchExploreBattles()]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [searchText, searchUsers, fetchPosts, fetchExploreBattles]);

  // OPTIMIZATION 11: capture BattleCard's real rendered height once, so
  // BoostedWinnerCard and the marketplace BattleSlide wrapper can match it.
  const handleBattleCardLayout = useCallback(event => {
    const h = event?.nativeEvent?.layout?.height;
    if (h && Math.round(h) !== battleCardHeight) {
      setBattleCardHeight(Math.round(h));
    }
  }, [battleCardHeight]);

  // ─── OPTIMIZATION 8: Stable renderItem using memoized MasonryItem ────────
  const renderMasonryFlatListItem = useCallback(({ item: layoutItem }) => (
    <MasonryItem
      post={layoutItem.post}
      index={layoutItem.index}
      height={layoutItem.height}
      top={layoutItem.top}
      columnIndex={layoutItem.columnIndex}
      width={layoutItem.width}
      spacing={layoutItem.spacing}
      isPlaying={
        isScreenFocused &&
        !previewVisible &&
        !isSearchActive &&
        playingVideoIndexes.has(layoutItem.index)
      }
      donationTotal={donationTotals[String(layoutItem.post?.id)]}
      onPress={handlePostPress}
      onLongPress={openPreview}
      text={text}
    />
  ), [isScreenFocused, previewVisible, isSearchActive, playingVideoIndexes, donationTotals, handlePostPress, openPreview]);

  const masonryKeyExtractor = useCallback((item, idx) =>
    item?.post?.id ? `${item.post.id}-${item.post.imageIndex ?? 0}` : `masonry-${idx}`,
    []);

  const userKeyExtractor = useCallback((item, idx) => String(item.id ?? idx), []);

  const renderListItem = useCallback(({ item }) => {
    const rawAccent = getUserAccentColor(item?.profile || item?.profile_type || item?.profileType);
    const borderColor = rawAccent || 'transparent';
    const avatarBorderWidth = rawAccent ? 1.5 : 0;
    const textColor = rawAccent || text || '#000';
    const shadowColor = rawAccent || 'transparent';

    return (
      <TouchableOpacity
        style={[
          styles.userListItem,
          cardStyle,
          { borderColor: border, borderWidth: StyleSheet.hairlineWidth, shadowColor },
        ]}
        onPress={() => handleUserProfile(item)}
        activeOpacity={0.7}
      >
        <HexAvatar
          uri={normalizeImageUrl(item.image) || require('../../assets/icons/pngicons/user.png')}
          size={60}
          borderWidth={avatarBorderWidth}
          borderColor={borderColor}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: textColor }]} numberOfLines={1}>
            {item?.displayName || item?.userName}
          </Text>
          <Text style={[styles.userHandle, mutedTextStyle]} numberOfLines={1}>
            @{item?.userName}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleUserProfile, getUserAccentColor, cardStyle, border, mutedTextStyle, text]);

  const renderListHeader = useCallback(() => (
    <Text style={[styles.sectionTitle, textStyle]}>{t('search.searchResultsTitle')}</Text>
  ), [t, textStyle]);

  const renderSearchBattleFooter = useCallback(() => (
    <View style={styles.searchBattlesSection}>
      <Text style={[styles.sectionTitle, textStyle]}>{t('search.openBattles')}</Text>
      {searchedUserBattles.length > 0 ? (
        searchedUserBattles.map(item => (
          <View key={`search-battle-${item.id}`} style={styles.searchBattleCardWrapper}>
            <BattleCard
              item={item}
              fullWidth
              selectedOption={selectedBattleOptions[item.id]}
              onCardPress={handleBattleCardPress}
              onOptionSelect={updateSelectedBattleOption}
              onUserPress={handleUserProfile}
            />
          </View>
        ))
      ) : (
        <View style={[styles.searchBattlesEmpty, cardStyle, { borderColor: border }]}>
          <Icon name="shield-outline" size={24} color={mutedText} />
          <Text style={[styles.emptySubtitle, mutedTextStyle]}>{t('search.noBattlesFound')}</Text>
        </View>
      )}
    </View>
  ), [
    searchedUserBattles,
    selectedBattleOptions,
    handleBattleCardPress,
    updateSelectedBattleOption,
    handleUserProfile,
    t,
    textStyle,
    cardStyle,
    border,
    mutedText,
    mutedTextStyle,
  ]);

  const previewMediaUrl = useMemo(() => {
    if (!previewPost) return null;
    return normalizeImageUrl(
      previewPost?.mediaUrl || previewPost?.image ||
      (Array.isArray(previewPost?.images) ? previewPost.images[0] : null),
    );
  }, [previewPost]);

  const previewIsVideo = useMemo(() => {
    if (!previewPost) return false;
    return previewPost?.isVideo || previewPost?.type === 'video' || previewPost?.mediaType === 'video';
  }, [previewPost]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {
        (showBattleExplore) ? (<BattleExplore onClose={() => setShowBattleExplore(false)} profile={profile} />)
          :

          <View style={[styles.container, bgStyle]}>
            <Pressable
              onPress={Keyboard.dismiss}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <View style={{ flex: 1 }}>
              {/* Search bar */}
              <View style={[styles.searchContainer, { backgroundColor: card, borderColor: border }]}>
                <Icon name="search" size={20} color={mutedText} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: text }]}
                  placeholder={t('search.searchPlaceholder')}
                  placeholderTextColor={mutedText}
                  value={searchText}
                  onChangeText={handleSearch}
                  onFocus={openSearchHistory}
                  returnKeyType="search"
                  onSubmitEditing={handleSearchSubmit}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => handleSearch('')}>
                    <Icon name="close-circle" size={20} color={mutedText} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                )}
              </View>

              {showSearchHistory && searchText.trim().length === 0 ? (
                <View style={[styles.searchHistoryPanel, { backgroundColor: card, borderColor: border }]}>
                  <View style={styles.searchHistoryHeader}>
                    <Text style={[styles.searchHistoryTitle, textStyle]}>Recent searches</Text>
                    <TouchableOpacity
                      onPress={handleClearSearchHistory}
                      disabled={searchHistory.length === 0}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.searchHistoryClear,
                          { color: accent, opacity: searchHistory.length === 0 ? 0.4 : 1 },
                        ]}
                      >
                        Clear all
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {historyLoading ? (
                    <View style={styles.searchHistoryEmptyState}>
                      <ActivityIndicator size="small" color={accent} />
                    </View>
                  ) : searchHistory.length > 0 ? (
                    searchHistory.map(item => {
                      const searchedUser = item.raw?.searchedUser;
                      
                      return (
                      <View key={item.id || item.name} style={styles.searchHistoryRow}>
                        <TouchableOpacity
                          style={styles.searchHistoryNameWrap}
                          onPress={() => {
                            if (searchedUser) {
                              handleUserProfile(searchedUser);
                            } else {
                              runHistorySearch(item.name);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          {searchedUser ? (
                            <>
                              <HexAvatar
                                uri={normalizeImageUrl(searchedUser.image) || require('../../assets/icons/pngicons/user.png')}
                                size={24}
                                borderWidth={1}
                                borderColor={border}
                              />
                              <Text style={[styles.searchHistoryName, textStyle, { marginLeft: 8 }]} numberOfLines={1}>
                                {searchedUser.displayName || searchedUser.userName}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Icon name="time-outline" size={16} color={mutedText} style={{ marginRight: 8 }} />
                              <Text style={[styles.searchHistoryName, textStyle]} numberOfLines={1}>
                                {item.name}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteSearchHistoryItem(item)}
                          disabled={historyDeletingId === item.id}
                          style={styles.searchHistoryDeleteBtn}
                          activeOpacity={0.7}
                        >
                          {historyDeletingId === item.id ? (
                            <ActivityIndicator size="small" color={mutedText} />
                          ) : (
                            <Icon name="close" size={18} color={mutedText} />
                          )}
                        </TouchableOpacity>
                      </View>
                      );
                    })
                  ) : (
                    <View style={styles.searchHistoryEmptyState}>
                      <Text style={[styles.emptySubtitle, mutedTextStyle]}>No recent searches yet.</Text>
                    </View>
                  )}
                </View>
              ) : null}

              {/* Battle Explore bar + collapse control */}
              {!isSearchActive && (
                <View style={styles.battleExploreSection}>
                  <View style={styles.battleExploreHeaderRow}>
                    <TouchableOpacity
                      onPress={() => setShowBattleExplore(true)}
                      style={[styles.battleExploreBar, { backgroundColor: accent }]}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={t('search.battleExplore')}
                    >
                      <Text style={styles.battleExploreEmoji}>⚔️</Text>
                      <Text style={styles.battleExploreBarText}>
                        {t('search.battleExplore')}
                      </Text>
                      <Icon name="chevron-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setBattleCarouselCollapsed(prev => !prev)}
                      style={[
                        styles.battleCollapseBtn,
                        {
                          backgroundColor: card,
                          borderColor: border,
                        },
                      ]}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={
                        battleCarouselCollapsed
                          ? t('search.expandBattleCarousel')
                          : t('search.collapseBattleCarousel')
                      }
                      accessibilityState={{ expanded: !battleCarouselCollapsed }}
                    >
                      <Icon
                        name={battleCarouselCollapsed ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={text}
                      />
                    </TouchableOpacity>
                  </View>

                  {!battleCarouselCollapsed ? (
                    <View style={styles.battleCarouselWrap}>
                      <AutoScrollBattleRow
                        cardWidth={searchBattleCardWidth}
                        cardGap={12}
                        rowPaddingLeft={6}
                      >
                        {loadingLiveBattles ? (
                          <View
                            style={[
                              styles.card,
                              cardStyle,
                              {
                                borderColor: border,
                                width: searchBattleCardWidth,
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                            ]}
                          >
                            <ActivityIndicator size="small" color={accent} />
                          </View>
                        ) : visibleBattleCards.length > 0 ? (
                          visibleBattleCards.map((item, i) => {
                            const raw = item?.raw || item;
                            const rawFmt = String(raw?.format || '').toLowerCase();
                            const rawTbb = String(raw?.typeByBattle || item?.typeByBattle || '').toLowerCase();

                            // Boosted product winner card — height matches BattleCard
                            if (rawFmt === 'boosted' || rawTbb === 'boosted_product') {
                              return (
                                <BoostedWinnerCard
                                  key={item.id}
                                  item={item}
                                  cardWidth={searchBattleCardWidth}
                                  cardHeight={boostedCardHeight}
                                  accent={accent}
                                  card={card}
                                  border={border}
                                  text={text}
                                  mutedText={mutedText}
                                  onPress={() => handleBattleCardPress(item)}
                                />
                              );
                            }

                            // Marketplace battle — same UI as MyClosetShopFront,
                            // width + height matched, explicit gap to next card
                            if (rawFmt === 'marketplace') {
                              const mappedBattle = mapBattle(item.raw || item, i);
                              return (
                                <View
                                  key={item.id || mappedBattle.id}
                                  style={{
                                    width: searchBattleCardWidth,
                                    marginRight: 12,
                                    // NOTE: no fixed height here — BattleSlide's
                                    // internal layout (thumbs, name, price, vs
                                    // bubble, winner badge) is fixed and can't
                                    // compress, so forcing a shorter height with
                                    // overflow:hidden cuts content off the bottom.
                                    // Let it size itself naturally.
                                  }}
                                >
                                  <BattleSlide
                                    battle={mappedBattle}
                                    accent={accent}
                                    t={t}
                                    onPress={() => handleBattleCardPress(item.raw || item)}
                                    card={card}
                                    border={border}
                                    textColor={text}
                                    mutedText={mutedText}
                                    isDark={isDarkMode}
                                    thumbSurface={battleThumbSurface}
                                    mutedColor={mutedText}
                                    loadingOverlayColor={battleLoadingOverlay}
                                    customWidth={searchBattleCardWidth}
                                  />
                                </View>
                              );
                            }

                            // Normal battle (POLL / HEAD_TO_HEAD) — measured for height reference
                            return (
                              <View key={item.id} onLayout={handleBattleCardLayout}>
                                <BattleCard
                                  item={item}
                                  selectedOption={selectedBattleOptions[item.id]}
                                  onCardPress={handleBattleCardPress}
                                  onOptionSelect={updateSelectedBattleOption}
                                  onUserPress={handleUserProfile}
                                  fullWidth
                                />
                              </View>
                            );
                          })
                        ) : (
                          <View
                            style={[
                              styles.card,
                              cardStyle,
                              {
                                borderColor: border,
                                width: searchBattleCardWidth,
                                justifyContent: 'center',
                              },
                            ]}
                          >
                            <Text numberOfLines={2} style={[styles.title, textStyle, { textAlign: 'center' }]}>
                              {t('search.noBattlesFoundCard')}
                            </Text>
                          </View>
                        )}
                      </AutoScrollBattleRow>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Search results */}
              {searchText.trim().length > 0 ? (
                <View style={styles.resultsContainer}>
                  {isSearching ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="large" color={accent} />
                      <Text style={[styles.emptySubtitle, mutedTextStyle]}>{t('search.loadingUsers')}</Text>
                    </View>
                  ) : filteredUsers.length > 0 ? (
                    <FlatList
                      data={filteredUsers}
                      keyExtractor={userKeyExtractor}
                      renderItem={renderListItem}
                      style={styles.resultsList}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                      ListHeaderComponent={renderListHeader}
                      ListFooterComponent={renderSearchBattleFooter}
                      contentContainerStyle={styles.listContent}
                      initialNumToRender={10}
                      maxToRenderPerBatch={10}
                      windowSize={5}
                      removeClippedSubviews={Platform.OS === 'android'}
                    />
                  ) : hasSearched ? (
                    <View style={styles.emptyContainer}>
                      <Icon name="search-outline" size={60} color={mutedText} />
                      <Text style={[styles.emptyTitle, textStyle]}>{t('search.noUsersFoundTitle')}</Text>
                      <Text style={[styles.emptySubtitle, mutedTextStyle]}>{t('search.noUsersFoundSubtitle')}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Masonry grid */}
              {searchText.trim().length === 0 ? (
                posts.length > 0 ? (
                  <View style={styles.masonryWrapper}>
                    <FlatList
                      data={masonryItems}
                      renderItem={renderMasonryFlatListItem}
                      keyExtractor={masonryKeyExtractor}
                      showsVerticalScrollIndicator={false}
                      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                      contentContainerStyle={[
                        styles.masonryContainer,
                        {
                          minHeight: masonryLayout.maxHeight + masonryBottomInset,
                          paddingBottom: masonryBottomInset,
                        },
                      ]}
                      removeClippedSubviews
                      initialNumToRender={12}
                      maxToRenderPerBatch={20}
                      windowSize={15}
                      onScroll={onMasonryScroll}
                      scrollEventThrottle={16}
                      getItemLayout={undefined}
                      onEndReached={loadMorePosts}
                      onEndReachedThreshold={0.5}
                      ListFooterComponent={
                        isFetchingMore ? (
                          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={accent} />
                          </View>
                        ) : null
                      }
                    />
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Icon name="images-outline" size={60} color={mutedText} />
                    <Text style={[styles.emptyTitle, textStyle]}>{t('search.noPostsAvailable')}</Text>
                  </View>
                )
              ) : null}
            </View>
          </View>
      }

      {/* Preview modal */}
      {previewVisible && previewPost ? (
        <Modal visible transparent animationType="fade" onRequestClose={closePreview}>
          <View style={styles.previewOverlay}>
            <TouchableWithoutFeedback onPress={closePreview}>
              <View style={styles.previewBackdrop} />
            </TouchableWithoutFeedback>
            <View style={styles.previewContent}>
              <View style={styles.previewMediaWrapper}>
                {previewMediaUrl ? (
                  previewIsVideo ? (
                    <Video
                      source={{ uri: previewMediaUrl }}
                      style={styles.previewMedia}
                      resizeMode="cover"
                      repeat
                      controls
                      paused={false}
                      muted={false}
                      volume={1}
                      ignoreSilentSwitch="ignore"
                      playWhenInactive={false}
                    />
                  ) : (
                    <Image source={{ uri: previewMediaUrl }} style={styles.previewMedia} resizeMode="cover" fadeDuration={0} />
                  )
                ) : (
                  <View style={styles.previewFallback}>
                    <Text style={styles.previewFallbackText}>Preview unavailable</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
};

export default SearchScreen;
