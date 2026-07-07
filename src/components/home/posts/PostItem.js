import React, { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  AppState,
  Alert,
  Platform,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
  FlatList,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import Video, { ViewType } from 'react-native-video';
import { WhiteDragonfly, Thumbup, Comments, ShareIcom } from '../../../assets/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ShareModal from '../../modals/ShareModal';
import { getDragonflyIcon } from '../../profile/ProfilePersonalData';
import { showToastMessage } from '../../displaytoastmessage';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import {
  getUserCredentials,
  getUserDashboard,
  getTrustScrore,
  getvotesDetail,
  unVote,
  voteTrust,
  editPost,
  getPostlikes,
} from '../../../services/post';
import {
  formatMintedDateTime,
  getMintLabelKey,
  resolveMintTimestamp,
} from '../../../utils/postMintDisplay';
import { useAppTheme } from '../../../theme/useApptheme';
import { getTotalDonationAmount } from '../../../services/tokens';
import BuyersListModal from '../../modals/BuyerList';
import FastImage from 'react-native-fast-image';
import SupportCreatorModal from '../../modals/SupportCreatorModal';
import { getSupportRecipientWalletAddress } from '../../../utils/walletPaymentSupport';
import { useWalletConnectSupport } from '../../../context/WalletConnectSupportContext';
import MissionSupportScreen from '../../modals/DonationModal';
import { getProgressBarColor } from '../../../utils/progressBarUtils';
import { isSupportAllowed, normalizeProfileType } from '../../../utils/supportEligibility';
import HexAvatar from '../story.js/HexAvatar';
import YoutubePlayer from 'react-native-youtube-iframe';
import { parsePostMeta, getPostMusicForSlide, getPostSlidePreviewState, getMusicTrimPlaybackWindowFromTrim } from '../../../utils/postSoundtracks';
import { postSupportsLocation } from '../../../utils/hydratePostForEditor';
import PostMediaTextOverlays from '../../post/PostMediaTextOverlays';
import {
  DEFAULT_FEED_MEDIA_HEIGHT,
  measureFeedMediaItemHeight,
  resolveFeedMediaHeight,
} from '../../../utils/feedMediaDimensions';
import { useLanguage } from '../../../i18n';
import { navigateToUserProfile } from '../../../utils/navigateToUserProfile';
import TrustCommentModal from '../../modals/TrustCommentModal';
import PostLocationModal from '../../modals/PostLocationModal';

const { width } = Dimensions.get('window');
const AnimatedFastImage = Animated.createAnimatedComponent(FastImage);
const TRUST_OPTIONS = [
  { type: 'agree', labelKey: 'postItem.trustAgree', detailKey: 'postItem.trustAgreeDetail', icon: 'thumbs-up', color: '#059669' },
  { type: 'not_sure', labelKey: 'postItem.trustNotSure', detailKey: 'postItem.trustNotSureDetail', icon: 'help-circle', color: '#F59E0B' },
  { type: 'disagree', labelKey: 'postItem.trustDisagree', detailKey: 'postItem.trustDisagreeDetail', icon: 'thumbs-down', color: '#DC2626' },
];

const TRUST_SCORE_KEYS = {
  agree: ['agree', 'approve', 'approved', 'trust', 'credible'],
  not_sure: ['not_sure', 'notSure', 'unsure', 'neutral', 'notSurePercent'],
  disagree: ['disagree', 'reject', 'rejected', 'untrust', 'notCredible'],
};

const isTruthyTrustPost = value => value === true || value === 1 || String(value).toLowerCase() === 'true';

const TRUST_VOTE_TYPE_FROM_API = {
  AGREE: 'agree',
  NOT_SURE: 'not_sure',
  DISAGREE: 'disagree',
};

const parseTrustVoteDetailResponse = response => {
  let detail = response?.data ?? response;
  if (detail?.data != null && detail.data.hasSubmittedVote !== undefined) {
    detail = detail.data;
  }

  const hasSubmittedVote =
    detail?.hasSubmittedVote === true
    || detail?.hasSubmittedVote === 1
    || String(detail?.hasSubmittedVote).toLowerCase() === 'true';

  if (!hasSubmittedVote) {
    return { hasSubmittedVote: false, vote: null };
  }

  const vote = detail?.vote;
  if (!vote) {
    return { hasSubmittedVote: true, vote: null };
  }

  const rawType = vote.voteType ?? vote.type;
  const normalizedType = TRUST_VOTE_TYPE_FROM_API[rawType]
    ?? String(rawType || '').toLowerCase().replace(/\s+/g, '_');

  return {
    hasSubmittedVote: true,
    vote: { ...vote, type: normalizedType },
  };
};


/* ─── InstagramZoomableImage ─────────────────────────────────────────────── */
function InstagramZoomableImage({ uri, height, onZoomChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalImageLoaded, setModalImageLoaded] = useState(false);

  const imageSource = useMemo(
    () => ({ uri, priority: FastImage.priority.high, cache: FastImage.cacheControl.immutable }),
    [uri],
  );

  const screenWidth = Dimensions.get('window').width;
  const displayHeight = height || DEFAULT_FEED_MEDIA_HEIGHT;
  const halfWidth = screenWidth / 2;
  const halfHeight = displayHeight / 2;

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale, focalX: translateX, focalY: translateY } }],
    { useNativeDriver: true },
  );

  const resetScale = useCallback(() => {
    setIsModalVisible(false);
    setModalImageLoaded(false);
    onZoomChange?.(false);
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 0 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [onZoomChange, scale, translateX, translateY]);

  const onPinchStateChange = useCallback(({ nativeEvent }) => {
    const { state } = nativeEvent;
    if (state === State.BEGAN) {
      setIsModalVisible(true);
      onZoomChange?.(true);
      return;
    }
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      resetScale();
    }
  }, [onZoomChange, resetScale]);

  useEffect(() => {
    if (!uri) return;
    FastImage.preload([imageSource]);
    setTimeout(() => {
      FastImage.preload([{ ...imageSource, priority: FastImage.priority.highest }]);
    }, 400);
  }, [uri, imageSource]);

  return (
    <GestureHandlerRootView style={[styles.mediaContainer, { height: displayHeight }]}>
      <PinchGestureHandler
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
        minPointers={2}>
        <AnimatedFastImage
          source={imageSource}
          resizeMode={FastImage.resizeMode.contain}
          fadeDuration={0}
          style={[
            { width: '100%', height: displayHeight },
            { opacity: isModalVisible && modalImageLoaded ? 0 : 1 },
          ]}
        />
      </PinchGestureHandler>
      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={resetScale}>
        <GestureHandlerRootView style={styles.gestureModalRoot}>
          <View style={styles.modalBackground}>
            <TouchableWithoutFeedback onPress={resetScale}>
              <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>
            <PinchGestureHandler
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
              minPointers={2}>
              <AnimatedFastImage
                source={imageSource}
                resizeMode="contain"
                fadeDuration={0}
                onLoadStart={() => setModalImageLoaded(false)}
                onLoadEnd={() => setModalImageLoaded(true)}
                style={[
                  styles.fullScreenImage,
                  {
                    width: screenWidth,
                    height: displayHeight,
                    transform: [
                      { translateX: Animated.subtract(translateX, halfWidth) },
                      { translateY: Animated.subtract(translateY, halfHeight) },
                      { scale },
                      { translateX: Animated.multiply(Animated.subtract(translateX, halfWidth), -1) },
                      { translateY: Animated.multiply(Animated.subtract(translateY, halfHeight), -1) },
                    ],
                  },
                ]}
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
              />
            </PinchGestureHandler>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={resetScale}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close zoomed image">
              <Icon name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </GestureHandlerRootView>
  );
}

/* ─── InstagramZoomableVideo ─────────────────────────────────────────────── */
function InstagramZoomableVideo({
  uri,
  thumbnailUri,
  videoHeight,
  paused,
  muted,
  repeat,
  onZoomChange,
  onVideoRef,
  onLoadStart,
  onLoad,
  onError,
  bufferConfig,
  maxBitRate,
  simultaneousHandlers,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalVideoReady, setModalVideoReady] = useState(false);
  const [hasInlineLoaded, setHasInlineLoaded] = useState(false);

  const currentTimeRef = useRef(0);
  const modalVideoRef = useRef(null);
  const inlineVideoRef = useRef(null);

  const resolvedBufferConfig = useMemo(() => {
    const base = { ...(bufferConfig || {}) };
    if (Platform.OS === 'android' && base.cacheSizeMB == null) base.cacheSizeMB = 64;
    return base;
  }, [bufferConfig]);

  const modalBufferConfig = useMemo(
    () => ({
      ...resolvedBufferConfig,
      bufferForPlaybackMs: Math.min(Number(resolvedBufferConfig.bufferForPlaybackMs) || 800, 250),
      bufferForPlaybackAfterRebufferMs: Math.min(
        Number(resolvedBufferConfig.bufferForPlaybackAfterRebufferMs) || 800,
        250,
      ),
    }),
    [resolvedBufferConfig],
  );

  useEffect(() => {
    setHasInlineLoaded(false);
    setModalVideoReady(false);
  }, [uri]);

  const handleInlineLoad = useCallback(payload => {
    setHasInlineLoaded(true);
    onLoad?.(payload);
  }, [onLoad]);

  const screenW = Dimensions.get('window').width;
  const halfWidth = screenW / 2;
  const halfHeight = videoHeight / 2;

  const inlinePaused = isModalVisible && modalVideoReady ? true : paused;

  const onProgressStable = useCallback(({ currentTime }) => {
    currentTimeRef.current = currentTime;
  }, []);

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale, focalX: translateX, focalY: translateY } }],
    { useNativeDriver: true },
  );

  const resetScale = useCallback(() => {
    setIsModalVisible(false);
    setModalVideoReady(false);
    onZoomChange?.(false);
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 0 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [scale, translateX, translateY, onZoomChange]);

  const onPinchStateChange = useCallback(({ nativeEvent }) => {
    const { state } = nativeEvent;
    if (state === State.BEGAN) {
      setModalVideoReady(false);
      setIsModalVisible(true);
      onZoomChange?.(true);
      return;
    }
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      resetScale();
    }
  }, [resetScale, onZoomChange]);

  const zoomTransform = useMemo(
    () => [
      { translateX: Animated.subtract(translateX, halfWidth) },
      { translateY: Animated.subtract(translateY, halfHeight) },
      { scale },
      { translateX: Animated.multiply(Animated.subtract(translateX, halfWidth), -1) },
      { translateY: Animated.multiply(Animated.subtract(translateY, halfHeight), -1) },
    ],
    [halfHeight, halfWidth, scale, translateX, translateY],
  );

  const modalTransformStyle = {
    width: screenW,
    height: videoHeight,
    transform: zoomTransform,
  };

  const androidTextureViewProps =
    Platform.OS === 'android' ? { viewType: ViewType.TEXTURE } : {};

  const onModalLoad = useCallback(() => {
    const seekTo = currentTimeRef.current || 0;
    if (seekTo > 0.5 && modalVideoRef.current?.seek) {
      modalVideoRef.current.seek(seekTo);
    }
  }, []);

  const onModalReady = useCallback(() => {
    setModalVideoReady(true);
  }, []);

  return (
    <GestureHandlerRootView style={styles.mediaContainer}>
      <PinchGestureHandler
        onGestureEvent={onPinchEvent}
        onHandlerStateChange={onPinchStateChange}
        simultaneousHandlers={simultaneousHandlers}
        minPointers={2}>
        <Animated.View
          style={{
            width: '100%',
            height: videoHeight,
            opacity: isModalVisible && modalVideoReady ? 0 : 1,
          }}
          collapsable={false}>
          <Video
            ref={ref => {
              inlineVideoRef.current = ref;
              onVideoRef?.(ref);
            }}
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            repeat={repeat}
            paused={inlinePaused}
            muted={muted}
            volume={muted ? 0 : 1}
            controls={false}
            pointerEvents="none"
            onLoadStart={onLoadStart}
            onLoad={handleInlineLoad}
            onError={onError}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            progressUpdateInterval={1000}
            onProgress={onProgressStable}
            bufferConfig={resolvedBufferConfig}
            maxBitRate={maxBitRate}
            preferredForwardBufferDuration={Platform.OS === 'ios' ? 12 : undefined}
            {...androidTextureViewProps}
          />
        </Animated.View>
      </PinchGestureHandler>

      {uri && hasInlineLoaded && (
        <View
          pointerEvents="none"
          collapsable={false}
          style={styles.zoomVideoPrewarmHost}>
          <Video
            source={{ uri }}
            style={styles.zoomVideoPrewarmVideo}
            resizeMode="cover"
            repeat={repeat}
            paused
            muted
            controls={false}
            playWhenInactive={false}
            bufferConfig={resolvedBufferConfig}
            maxBitRate={maxBitRate}
            {...androidTextureViewProps}
          />
        </View>
      )}

      <Modal
        visible={isModalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        onRequestClose={resetScale}>
        <GestureHandlerRootView style={styles.gestureModalRoot}>
          <View style={styles.modalBackground}>
            <TouchableWithoutFeedback onPress={resetScale}>
              <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>
            <PinchGestureHandler
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
              minPointers={2}>
              <Animated.View
                collapsable={false}
                style={[{ width: screenW, height: videoHeight, backgroundColor: '#000' }, modalTransformStyle]}>
                {!modalVideoReady ? (
                  <>
                    {thumbnailUri ? (
                      <FastImage
                        source={{
                          uri: thumbnailUri,
                          priority: FastImage.priority.high,
                          cache: FastImage.cacheControl.immutable,
                        }}
                        resizeMode={FastImage.resizeMode.cover}
                        fadeDuration={0}
                        style={StyleSheet.absoluteFillObject}
                      />
                    ) : (
                      <View
                        style={[StyleSheet.absoluteFillObject, styles.zoomVideoLoadingBackdrop]}
                      />
                    )}
                    <View style={styles.zoomVideoLoading} pointerEvents="none">
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  </>
                ) : null}
                <Video
                  ref={modalVideoRef}
                  source={{ uri }}
                  style={[
                    StyleSheet.absoluteFillObject,
                    { opacity: modalVideoReady ? 1 : 0 },
                  ]}
                  resizeMode="contain"
                  repeat={repeat}
                  paused={false}
                  muted={muted}
                  volume={muted ? 0 : 1}
                  controls={false}
                  pointerEvents="none"
                  playWhenInactive={false}
                  ignoreSilentSwitch="ignore"
                  progressUpdateInterval={1000}
                  bufferConfig={modalBufferConfig}
                  maxBitRate={maxBitRate}
                  onError={onError}
                  onLoad={onModalLoad}
                  onReadyForDisplay={onModalReady}
                  preferredForwardBufferDuration={Platform.OS === 'ios' ? 12 : undefined}
                  {...androidTextureViewProps}
                />
              </Animated.View>
            </PinchGestureHandler>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={resetScale}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close zoomed video">
              <Icon name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </GestureHandlerRootView>
  );
}

/* ─── PostItem ───────────────────────────────────────────────────────────── */
function PostItem({
  item,
  likesCount,
  commentsCount,
  liked,
  saved,
  onToggleLike,
  onToggleSave,
  onToggleFollow,
  onComment,
  onOptions,
  followingBusy = false,
  isBusinessProfile,
  executeFollowAction,
  isVisible = false,
  screenFocused = true,
  playingPostId,
  returnTo,
  shareCount,
  taggedPeople,
  hideDonationButton = false,
  isTrustPost = false,
  onLocationUpdate,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const heartScale = useRef(new Animated.Value(1)).current;
  const doubleTapHeartScale = useRef(new Animated.Value(0)).current;
  const [localCommentsCount, setLocalCommentsCount] = useState(commentsCount || 0);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const listRef = useRef(null);
  const videoRefsMap = useRef({});
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [userProfile, setUserProfile] = useState('');
  const [currentUserProfileType, setCurrentUserProfileType] = useState('user');
  const isCompanyProfile = userProfile === 'company';
  const DragonflyIcon = getDragonflyIcon(totalFollowers, isCompanyProfile);
  const [donation, setDonation] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoStates, setVideoStates] = useState({});
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [isZooming, setIsZooming] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showBuyersModal, setShowBuyersModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesUsers, setLikesUsers] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [showTaggedPeopleModal, setShowTaggedPeopleModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState({});
  const [slideHeights, setSlideHeights] = useState(() => {
    const containerWidth = Dimensions.get('window').width;
    const initial = {};
    (item?.media || []).forEach((m, index) => {
      const h = resolveFeedMediaHeight(m, containerWidth);
      if (h != null) initial[index] = h;
    });
    return initial;
  });
  const [totalDonation, setTotalDonation] = useState(0);
  const [isLoadingDonation, setIsLoadingDonation] = useState(false);
  const [trustPanelVisible, setTrustPanelVisible] = useState(false);
  const [trustScoreVisible, setTrustScoreVisible] = useState(false);
  const [trustLoading, setTrustLoading] = useState(false);
  const [trustScoreLoading, setTrustScoreLoading] = useState(false);
  const [trustVote, setTrustVote] = useState(null);
  const [hasSubmittedTrustVote, setHasSubmittedTrustVote] = useState(false);
  const [trustVoteStatusLoading, setTrustVoteStatusLoading] = useState(false);
  const [trustScore, setTrustScore] = useState(null);
  const [trustCommentModalVisible, setTrustCommentModalVisible] = useState(false);
  const [trustCommentModalType, setTrustCommentModalType] = useState(null);
  const [localLiked, setLocalLiked] = useState(liked);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount || 0);

  useEffect(() => { setLocalLiked(liked); }, [liked]);
  useEffect(() => { setLocalLikesCount(likesCount || 0); }, [likesCount]);
  const { t } = useLanguage();
  const showTrustControls = isTruthyTrustPost(isTrustPost) || isTruthyTrustPost(item?.isTrustPost);

  const currentUserIdStr = useMemo(() => (userId != null ? String(userId) : ''), [userId]);
  const itemUserIdStr = useMemo(() => {
    const raw = item?.UserId ?? item?.userId ?? item?.UserID ?? '';
    return raw != null ? String(raw) : '';
  }, [item?.UserID, item?.UserId, item?.userId]);

  const getDaysLeftFromEndTime = endTime => {
    if (!endTime) return 0;
    try {
      const now = new Date();
      const endDate = new Date(endTime);
      const diffTime = endDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (error) {
      console.error('Error calculating days left:', error);
      return 0;
    }
  };

  const [daysLeft, setDaysLeft] = useState(() => getDaysLeftFromEndTime(item?.end_time));
  const [walletAddress, setWalletAddress] = useState('');
  const [targetWalletAddress, setTargetWalletAddress] = useState('');
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [locationValue, setLocationValue] = useState(
    typeof item?.location === 'string' ? item.location : '',
  );
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);

  const usernameText = item?.username || t('postItem.unknownUser');
  const captionValue = item?.caption?.trim() || '';
  const previewCaptionLength = Math.max(40, 120 - usernameText.length);
  const hasExpandableCaption = captionValue.length > previewCaptionLength;
  const collapsedCaption = hasExpandableCaption
    ? `${captionValue.slice(0, previewCaptionLength).trimEnd()}... `
    : captionValue;

  useEffect(() => {
    setExpanded(false);
    setTrustPanelVisible(false);
    setTrustScoreVisible(false);
    setTrustVote(null);
    setHasSubmittedTrustVote(false);
    setTrustVoteStatusLoading(false);
    setTrustScore(null);
    setLocationValue(typeof item?.location === 'string' ? item.location : '');
  }, [item?.caption, item?.id, item?.UserId, item?.location]);

  const mintedDateTime = useMemo(
    () => formatMintedDateTime(resolveMintTimestamp(item)),
    [item?.createdAt, item?.created_at, item?.mintedAt, item?.minted_at, item?.updatedAt, item?.updated_at],
  );
  const mintLabelKey = useMemo(() => getMintLabelKey(item), [item]);
  const isPostOwner = Boolean(
    currentUserIdStr && itemUserIdStr && currentUserIdStr === itemUserIdStr,
  );
  const supportsLocation = useMemo(
    () => postSupportsLocation({
      type: item?.type,
      postType: item?.postType,
      raiseAmount: item?.raiseAmount,
    }),
    [item?.type, item?.postType, item?.raiseAmount],
  );
  const locationDisplayText = locationValue.trim()
    ? locationValue.trim()
    : isPostOwner
      ? t('postItem.locationPlaceholder')
      : '';

  const navigation = useNavigation();
  const shareRef = useRef(null);
  const postFeedYoutubeRef = useRef(null);
  const postFeedMp3Ref = useRef(null);
  const postFeedMusicDurRef = useRef(180);
  const shouldPlayAudioRef = useRef(false);
  const dispatch = useDispatch();
  const toast = useToast();
  const { startSupportPayment } = useWalletConnectSupport();
  const { text } = useAppTheme();
  const isMountedRef = useRef(true);
  const route = useRoute();

  const handleOpenLocationEditor = useCallback(() => {
    if (!supportsLocation || !isPostOwner || !item?.id) return;
    setLocationModalVisible(true);
  }, [supportsLocation, isPostOwner, item?.id]);

  const handleSaveLocation = useCallback(async (nextLocationValue) => {
    if (!item?.id || locationSaving) return;

    const nextLocation = String(nextLocationValue || '').trim();
    setLocationSaving(true);
    try {
      const response = await editPost(item.id, { location: nextLocation });
      if (response?.statusCode && response.statusCode >= 400) {
        throw new Error(response?.message || t('postItem.locationSaveError'));
      }

      setLocationValue(nextLocation);
      onLocationUpdate?.(item.id, nextLocation);
      setLocationModalVisible(false);
      showToastMessage(toast, 'success', t('postItem.locationSaved'));
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('postItem.locationSaveError'),
      );
    } finally {
      setLocationSaving(false);
    }
  }, [item?.id, locationSaving, onLocationUpdate, t, toast]);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [dataFetched, setDataFetched] = useState(false);
  const modalProfileType = normalizeProfileType(userProfile || item?.profile);

  if (!item || !item.id) {
    console.warn('PostItem received invalid item:', item);
    return null;
  }

  const width = Dimensions.get('window').width;

  // FIX: safeMedia and mediaLength declared BEFORE any useMemo/useCallback that references them
  const safeMedia = item.media || [];
  const mediaLength = safeMedia.length;

  // FIX: isVideoUrl declared BEFORE mediaHeight useMemo
  const isVideoUrl = useCallback(url => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().split('?')[0];
    return ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'm4v'].some(ext =>
      lower.endsWith(`.${ext}`),
    );
  }, []);

  const getSlideHeight = useCallback(
    index => slideHeights[index] ?? DEFAULT_FEED_MEDIA_HEIGHT,
    [slideHeights],
  );
  const currentMediaHeight = getSlideHeight(currentIndex);

  const mediaMeasureKey = useMemo(
    () => (item?.media || []).map(m => `${m?.url || ''}:${m?.thumbnail || ''}`).join('|'),
    [item?.media],
  );

  useEffect(() => {
    let cancelled = false;
    const mediaList = item?.media || [];
    if (!mediaList.length) return undefined;

    const synced = {};
    mediaList.forEach((m, index) => {
      const h = resolveFeedMediaHeight(m, width);
      if (h != null) synced[index] = h;
    });
    setSlideHeights(synced);

    (async () => {
      const measured = {};
      await Promise.all(
        mediaList.map(async (m, index) => {
          measured[index] = await measureFeedMediaItemHeight(m, isVideoUrl, width);
        }),
      );
      if (cancelled) return;
      setSlideHeights(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(measured).forEach(([idx, h]) => {
          const i = Number(idx);
          if (next[i] !== h) {
            next[i] = h;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [item?.id, mediaMeasureKey, isVideoUrl, width]);

  const parsedPostMeta = useMemo(() => parsePostMeta(item?.postMeta), [item?.postMeta]);

  const postMusic = useMemo(
    () => getPostMusicForSlide(item, currentIndex, parsedPostMeta),
    [currentIndex, parsedPostMeta, item?.id, item?.music, item?.youtubeMusicMeta, item?.postMeta, item?.media],
  );

  const taggedUsers = useMemo(() => {
    const source = Array.isArray(taggedPeople || item?.taggedPeople)
      ? (taggedPeople || item?.taggedPeople)
      : [];

    const looksLikeUuid = (value = '') =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value).trim());

    return source
      .filter(Boolean)
      .map((person, index) => {
        // Handle primitives (strings/numbers) coming from API payloads.
        if (typeof person === 'string' || typeof person === 'number') {
          const rawValue = String(person).trim();
          if (!rawValue) return { id: `tagged-${index}`, username: t('postItem.unknownUser') };

          // Sometimes backend sends tagged user IDs (UUIDs) instead of usernames.
          if (looksLikeUuid(rawValue)) {
            return {
              id: rawValue,
              userId: rawValue,
              username: '',
              fullName: '',
              avatar: null,
            };
          }

          const username = rawValue.replace(/^@+/, '');
          return { id: `tagged-${index}-${username}`, username };
        }

        const usernameCandidate = String(
          person?.username ??
          person?.userName ??
          person?.tag ??
          person?.handle ??
          person?.label ??
          person?.value ??
          '',
        )
          .trim()
          .replace(/^@+/, '');

        return {
          id: person?.id || person?.userId || person?._id || `tagged-${index}`,
          username: usernameCandidate || t('postItem.unknownUser'),
          fullName: String(person?.fullName ?? person?.name ?? person?.displayName ?? '').trim(),
          avatar: person?.avatar || person?.image || person?.userImage || person?.profilePicture || null,
        };
      });
  }, [item?.taggedPeople, taggedPeople, t]);

  const calculateDaysLeft = useCallback(() => {
    return getDaysLeftFromEndTime(item?.end_time);
  }, [item.end_time]);

  useEffect(() => {
    setDaysLeft(calculateDaysLeft());
    const timer = setInterval(() => {
      setDaysLeft(calculateDaysLeft());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [calculateDaysLeft]);

  useEffect(() => {
    setLocalCommentsCount(commentsCount || 0);
  }, [commentsCount]);

  const fetchTotalDonation = useCallback(async () => {
    if (!item.id) return;
    setIsLoadingDonation(true);
    try {
      const response = await getTotalDonationAmount({ postId: item.id });
      if (response.statusCode === 200) {
        setTotalDonation(response.data?.totalDonation || 0);
      }
    } catch (error) {
      console.error('Error fetching total donation:', error);
      setTotalDonation(0);
    } finally {
      setIsLoadingDonation(false);
    }
  }, [item.id]);

  const handleDonationSuccess = useCallback(() => {
    fetchTotalDonation();
  }, [fetchTotalDonation]);

  const fetchAllData = useCallback(async () => {
    if (!item?.UserId) return;
    try {
      const [dashboardResponse, profileResponse] = await Promise.allSettled([
        getUserDashboard(item.UserId),
        getUserCredentials(item.UserId),
      ]);

      if (dashboardResponse.status === 'fulfilled') {
        const data = dashboardResponse.value;
        if (data?.statusCode === 200) {
          setTotalFollowers(data.data?.dashboardData?.totalFollowers || 0);
        }
      }

      if (profileResponse.status === 'fulfilled') {
        const data = profileResponse.value;
        if (data?.statusCode === 200) {
          const userDataToSet =
            data.data?.user || data.data || data;
          setUserProfile(userDataToSet.profile || '');
          setTargetWalletAddress(getSupportRecipientWalletAddress(userDataToSet) || '');
          setIsKycVerified(userDataToSet?.kyc === true);
          setIsSubscriptionActive(
            String(userDataToSet?.subscriptionStatus || '').toUpperCase() === 'ACTIVE',
          );
        }
      }
    } catch (error) {
      console.error('Error in fetchAllData:', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? t('postItem.errorLoadUserData'),
      );
    }
  }, [item?.UserId, toast, t]);

  const restoreUserId = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      const currentUserId = userId ? String(userId) : null;
      const newUserId = id ? String(id) : null;
      if (newUserId !== currentUserId) setUserId(newUserId);
    } catch (error) {
      console.error('Error restoring userId:', error);
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('profile');
        if (!mounted) return;
        setCurrentUserProfileType(normalizeProfileType(storedProfile));
      } catch {
        // ignore; keep default
      }
    })();
    return () => { mounted = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const initializeData = async () => {
        try {
          const id = await AsyncStorage.getItem('userId');
          const storedWalletAddress = await AsyncStorage.getItem('walletAddress');
          if (isActive) setUserId(id ? String(id) : null);
          if (isActive) setWalletAddress(storedWalletAddress || '');

          if (item?.UserId && !dataFetched) {
            await fetchAllData();
            setDataFetched(true);
          }

          const days = calculateDaysLeft();
          if (isActive) setDaysLeft(days);

          if (!dataFetched) await fetchTotalDonation();
        } catch (error) {
          console.error('Error initializing PostItem data:', error);
        }
      };
      initializeData();
      return () => { isActive = false; };
    }, [item?.UserId, calculateDaysLeft, fetchTotalDonation, fetchAllData, dataFetched]),
  );

  // FIX: safeVideoPause declared before the useEffect that uses it in its cleanup
  const safeVideoPause = useCallback(index => {
    try {
      const ref = videoRefsMap.current[index];
      if (ref && typeof ref.pause === 'function') ref.pause();
    } catch (error) {
      console.warn(`Error pausing video at index ${index}:`, error);
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.keys(videoRefsMap.current).forEach(idx => safeVideoPause(parseInt(idx)));
      videoRefsMap.current = {};
    };
  }, [safeVideoPause]);

  const creatorWalletAddress = useMemo(
    () =>
      targetWalletAddress ||
      item?.walletAddress ||
      item?.walletId ||
      item?.wallet ||
      item?.userWalletAddress ||
      item?.creatorWalletAddress ||
      item?.vendorWalletAddress ||
      item?.receiverWalletAddress ||
      null,
    [targetWalletAddress, item],
  );

  const recipientWalletAddress = useMemo(
    () => getSupportRecipientWalletAddress({ ...item, walletAddress: creatorWalletAddress }),
    [item, creatorWalletAddress],
  );
  const canSupport = !!creatorWalletAddress;

  const supporterProfile = useMemo(
    () =>
      typeof isBusinessProfile === 'boolean'
        ? isBusinessProfile
          ? 'company'
          : 'user'
        : currentUserProfileType,
    [isBusinessProfile, currentUserProfileType],
  );
  const recipientProfile = useMemo(
    () => normalizeProfileType(userProfile || item?.profile),
    [userProfile, item?.profile],
  );

  const handleSupportNow = useCallback(async () => {
    if (!canSupport) {
      Alert.alert(
        t('postItem.walletNotConnectedTitle'),
        t('postItem.walletNotConnectedMessage'),
      );
      return;
    }
    setSupportDisclaimerVisible(false);
    const receiverId = item?.UserId ?? item?.userId ?? item?.UserID ?? '';
    await startSupportPayment(recipientWalletAddress, {
      senderId: userId != null ? String(userId) : '',
      receiverId: receiverId !== '' ? String(receiverId) : '',
      chain: 'POLYGON',
    });
  }, [canSupport, recipientWalletAddress, startSupportPayment, userId, item, t]);

  const handleOpenSupportDisclaimer = useCallback(() => {
    if (!isSupportAllowed({ supporterProfile, recipientProfile })) {
      Alert.alert(
        t('postItem.supportUnavailableTitle'),
        t('postItem.supportUnavailableMessage'),
      );
      setModalVisible(false);
      return;
    }
    setModalVisible(false);
    setSupportDisclaimerVisible(true);
  }, [supporterProfile, recipientProfile, t]);

  const wasPostActiveRef = useRef(false);
  useEffect(() => {
    const hasPlayingTarget = playingPostId !== undefined && playingPostId !== null;
    const isPostActive =
      isVisible &&
      screenFocused &&
      (!hasPlayingTarget || String(playingPostId) === String(item.id));

    if (isPostActive && !wasPostActiveRef.current) setIsMuted(true);
    wasPostActiveRef.current = isPostActive;
  }, [isVisible, screenFocused, playingPostId, item.id]);

  const isCurrentSlideVideo = useMemo(() => {
    const m = safeMedia[currentIndex];
    if (!m) return false;
    return m.type === 'video' || isVideoUrl(m.url);
  }, [safeMedia, currentIndex, isVideoUrl]);

  const playbackEligible = useMemo(
    () =>
      screenFocused &&
      isVisible &&
      (playingPostId != null && playingPostId !== ''
        ? String(playingPostId) === String(item.id)
        : true),
    [screenFocused, isVisible, playingPostId, item.id],
  );

  useLayoutEffect(() => {
    if (playbackEligible) return;
    setIsMuted(true);
    safeVideoPause(currentIndex);
    try {
      postFeedMp3Ref.current?.pause?.();
      void postFeedYoutubeRef.current?.pauseVideo?.();
    } catch (_) { }
  }, [playbackEligible, currentIndex, safeVideoPause]);

  const handleUserProfile = useCallback(
    (id) => {
      const targetId = id != null ? String(id).trim() : '';
      if (!targetId) return;

      const currentRoute = route?.name || 'Home';
      const returnToPayload =
        currentRoute === 'PostView'
          ? { tab: 'ProfileMain', screen: 'PostView', params: route?.params }
          : currentRoute;

      void navigateToUserProfile(navigation, targetId, {
        loggedInUserId: currentUserIdStr,
        returnTo: returnToPayload,
      });
    },
    [currentUserIdStr, navigation, route?.name, route?.params],
  );

  const normalizeExternalUrl = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    // Already has a scheme (http://, https://, etc.) or common native schemes.
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const hasNativeScheme = /^(mailto:|tel:|sms:|whatsapp:)/i.test(raw);
    if (hasScheme || hasNativeScheme) return raw;

    // If user saved "www.example.com" or "example.com", make it a valid URL.
    return `https://${raw.replace(/^\/+/, '')}`;
  }, []);

  const handleOpenExternalLink = useCallback(async (value) => {
    const normalized = normalizeExternalUrl(value);
    if (!normalized) return;

    const isWebLink = /^https?:\/\//i.test(normalized);
    const urlToOpen = isWebLink ? encodeURI(normalized) : normalized;

    try {
      const supported = await Linking.canOpenURL(urlToOpen);
      if (!supported) {
        Alert.alert(t('optionsModal.errorGeneric'), t('battleInProgress.tryAgain'));
        return;
      }
      await Linking.openURL(urlToOpen);
    } catch (error) {
      Alert.alert(
        t('optionsModal.errorGeneric'),
        error?.message || t('battleInProgress.tryAgain'),
      );
    }
  }, [normalizeExternalUrl, t]);

  const formatNumber = useCallback(n => {
    if (typeof n !== 'number') n = Number(n) || 0;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }, []);

  const currencyPrefix = useMemo(() => {
    const currencyCode = String(item?.currency || '').toUpperCase();
    const currencySymbols = {
      USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', NZD: 'NZ$',
      JPY: '¥', CNY: '¥', KRW: '₩', SGD: 'S$', HKD: 'HK$', AED: 'د.إ', SAR: 'ر.س',
    };
    return currencySymbols[currencyCode] || (currencyCode ? `${currencyCode} ` : '$');
  }, [item?.currency]);

  const buyerList = useMemo(
    () =>
      Array.isArray(item.boughtBy)
        ? item.boughtBy
        : Array.isArray(item.buyers)
          ? item.buyers
          : [],
    [item.boughtBy, item.buyers],
  );

  const displayBuyerList = useMemo(() => {
    if (!buyerList || buyerList.length === 0 || !userId) return buyerList;
    const currentUserIdStr = String(userId);
    return buyerList.filter(buyer => {
      const buyerIdStr = buyer?.id
        ? String(buyer.id)
        : buyer?.userId
          ? String(buyer.userId)
          : null;
      return buyerIdStr !== currentUserIdStr;
    });
  }, [buyerList, userId]);

  const animateHeart = useCallback(() => {
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [heartScale]);

  const handleLike = useCallback(() => {
    const newLiked = !localLiked;
    setLocalLiked(newLiked);
    setLocalLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
    onToggleLike?.(item.id);
    animateHeart();
  }, [localLiked, onToggleLike, item.id, animateHeart]);

  const parseLikeListUsers = useCallback(response => {
    const payload = response?.data ?? response;
    const list = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.likes)
          ? payload.likes
          : [];
    return list.map((entry, index) => ({
      id: entry?.userId ?? entry?.user?.id ?? entry?.likedBy ?? entry?.id ?? `like-${index}`,
      username:
        entry?.userName ??
        entry?.username ??
        entry?.displayName ??
        entry?.user?.userName ??
        entry?.user?.username ??
        '',
      fullName:
        entry?.fullName ??
        entry?.name ??
        entry?.displayName ??
        entry?.user?.fullName ??
        entry?.user?.name ??
        '',
      avatar:
        entry?.image ??
        entry?.avatar ??
        entry?.userImage ??
        entry?.profilePicture ??
        entry?.user?.image ??
        entry?.user?.avatar ??
        null,
      profile: entry?.profile ?? entry?.user?.profile ?? 'user',
    }));
  }, []);

  const handleViewLikes = useCallback(async () => {
    if (!item?.id || localLikesCount <= 0 || likesLoading) return;

    setLikesLoading(true);
    try {
      const res = await getPostlikes(String(item.id));
      setLikesUsers(parseLikeListUsers(res));
      setShowLikesModal(true);
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || t('postItem.loadLikesError'),
      );
    } finally {
      setLikesLoading(false);
    }
  }, [item?.id, localLikesCount, likesLoading, parseLikeListUsers, toast, t]);

  const unwrapTrustPayload = useCallback(response => {
    const payload = response?.data ?? response;
    return payload?.data ?? payload?.result ?? payload?.trustScore ?? payload?.score ?? payload;
  }, []);

  const getTrustVoteId = useCallback(vote => (
    vote?.id ??
    vote?._id ??
    vote?.voteId ??
    vote?.trustVoteId ??
    vote?.PostTrustVoteId ??
    null
  ), []);

  const pickTrustPercent = useCallback((source, keys) => {
    if (!source || typeof source !== 'object') return 0;
    for (const key of keys) {
      const candidates = [
        source[key],
        source[`${key}Percent`],
        source[`${key}Percentage`],
        source[`${key}_percent`],
        source[`${key}_percentage`],
      ];
      for (const value of candidates) {
        const numberValue = Number(value);
        if (Number.isFinite(numberValue)) return Math.max(0, Math.min(100, numberValue));
      }
    }
    return 0;
  }, []);

  const normalizedTrustScore = useMemo(() => {
    const source = trustScore || {};
    const percentages = source.percentages || {};
    const counts = source.counts || {};
    const agree = pickTrustPercent(
      { ...source, ...percentages },
      [...TRUST_SCORE_KEYS.agree, 'agreeVote', 'agreeVotePercentage'],
    );
    const notSure = pickTrustPercent(
      { ...source, ...percentages },
      [...TRUST_SCORE_KEYS.not_sure, 'notSureVote', 'notSureVotePercentage'],
    );
    const disagree = pickTrustPercent(
      { ...source, ...percentages },
      [...TRUST_SCORE_KEYS.disagree, 'disagreeVote', 'disagreeVotePercentage'],
    );
    const total = agree + notSure + disagree;
    const overallCandidates = [
      source.score,
      source.trustScore,
      source.percentage,
      source.percent,
      source.communityTrustScore,
      source.overall,
      percentages.agreeVotePercentage,
    ];
    const overallRaw = overallCandidates.find(value => Number.isFinite(Number(value)));
    const overall = Number.isFinite(Number(overallRaw))
      ? Math.max(0, Math.min(100, Number(overallRaw)))
      : (total > 0 ? agree : 0);

    return {
      agree,
      notSure,
      disagree,
      overall,
      totalVotes: Number(source.total) || 0,
      agreeVotes: Number(counts.agreeVoteCount) || 0,
      notSureVotes: Number(counts.notSureVoteCount) || 0,
      disagreeVotes: Number(counts.disagreeVoteCount) || 0,
    };
  }, [pickTrustPercent, trustScore]);

  const refreshTrustScore = useCallback(async () => {
    if (!item?.id) return;
    setTrustScoreLoading(true);
    try {
      const response = await getTrustScrore({ postId: item.id });
      console.log(response, 'getTrustScroregetTrustScroregetTrustScroregetTrustScroregetTrustScrore')
      setTrustScore(unwrapTrustPayload(response));
    } catch (error) {
      console.log('Failed to fetch trust score:', error);
      showToastMessage(toast, 'danger', t('postItem.trustLoadError'));
    } finally {
      setTrustScoreLoading(false);
    }
  }, [item?.id, toast, unwrapTrustPayload]);

  const loadTrustVoteDetail = useCallback(async () => {
    if (!item?.id) return;
    setTrustVoteStatusLoading(true);
    try {
      const response = await getvotesDetail({ postId: item.id });
      const { hasSubmittedVote, vote } = parseTrustVoteDetailResponse(response);
      setHasSubmittedTrustVote(hasSubmittedVote);
      setTrustVote(vote);
      if (hasSubmittedVote) {
        setTrustPanelVisible(false);
        setTrustCommentModalVisible(false);
      }
    } catch (error) {
      console.log('Failed to fetch trust vote detail:', error);
    } finally {
      setTrustVoteStatusLoading(false);
    }
  }, [item?.id]);

  useEffect(() => {
    if (!showTrustControls || !item?.id) return;
    loadTrustVoteDetail();
  }, [showTrustControls, item?.id, loadTrustVoteDetail]);

  useEffect(() => {
    if (!showTrustControls || !item?.id || !isVisible) return;
    refreshTrustScore();
  }, [showTrustControls, item?.id, isVisible, refreshTrustScore]);

  const handleTrustIconPress = useCallback(() => {
    if (hasSubmittedTrustVote || trustVoteStatusLoading) return;
    setTrustScoreVisible(false);
    setTrustPanelVisible(prev => !prev);
  }, [hasSubmittedTrustVote, trustVoteStatusLoading]);

  const handleTrustScorePress = useCallback(async () => {
    const nextVisible = !trustScoreVisible;
    setTrustPanelVisible(false);
    setTrustScoreVisible(nextVisible);
    if (nextVisible) {
      await refreshTrustScore();
    }
  }, [refreshTrustScore, trustScoreVisible]);

  const handleTrustVote = useCallback(async (type) => {
    if (hasSubmittedTrustVote || trustVote) return;
    setTrustPanelVisible(false);
    setTrustCommentModalType(type);
    setTrustCommentModalVisible(true);
  }, [hasSubmittedTrustVote, trustVote]);

  const handleTrustVoteWithComment = useCallback(async (comment) => {
    if (!item?.id || trustLoading || hasSubmittedTrustVote || trustVote) return;
    setTrustCommentModalVisible(false);
    setTrustLoading(true);
    try {
      const response = await voteTrust({
        postId: item.id,
        voteType: trustCommentModalType,  // 'agree' | 'not_sure' | 'disagree'
        comment: comment || '',
      });

      // Only unwrap after confirming response shape
      const payload = response?.data?.data ?? response?.data ?? response;
      setHasSubmittedTrustVote(true);
      setTrustVote({ ...(payload || {}), type: trustCommentModalType });
      setTrustScoreVisible(true);
      await refreshTrustScore();
      if (comment?.trim()) {
        setLocalCommentsCount(prev => prev + 1);
      }
    } catch (error) {
      console.log('voteTrust error:', error?.response?.data);
      showToastMessage(toast, 'danger', t('postItem.trustSubmitError'));
    } finally {
      setTrustLoading(false);
      setTrustCommentModalType(null);
    }
  }, [hasSubmittedTrustVote, item?.id, trustCommentModalType, trustLoading, trustVote, refreshTrustScore, toast, t]);


  const handleTrustUndo = useCallback(async () => {
    const voteId = getTrustVoteId(trustVote);
    if (!voteId || trustLoading) return;
    setTrustLoading(true);
    try {
      await unVote({ voteId });
      setHasSubmittedTrustVote(false);
      setTrustVote(null);
      await refreshTrustScore();
    } catch (error) {
      console.log('Failed to remove trust vote:', error);
      showToastMessage(toast, 'danger', t('postItem.trustUndoError'));
    } finally {
      setTrustLoading(false);
    }
  }, [getTrustVoteId, refreshTrustScore, toast, trustLoading, trustVote]);

  const playDoubleTapHeartBurst = useCallback(() => {
    setShowDoubleTapHeart(true);
    doubleTapHeartScale.setValue(0);
    Animated.sequence([
      Animated.spring(doubleTapHeartScale, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }),
      Animated.delay(400),
      Animated.timing(doubleTapHeartScale, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowDoubleTapHeart(false));
  }, [doubleTapHeartScale]);

  const handleMediaDoubleTapLike = useCallback(() => {
    if (isZooming) return;
    const newLiked = !localLiked;
    setLocalLiked(newLiked);
    setLocalLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
    onToggleLike?.(item.id);
    animateHeart();
    if (newLiked) {
      playDoubleTapHeartBurst();
    }
  }, [isZooming, localLiked, onToggleLike, item.id, animateHeart, playDoubleTapHeartBurst]);

  const doubleTapLikeGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .maxDistance(20)
        .onEnd(() => { runOnJS(handleMediaDoubleTapLike)(); }),
    [handleMediaDoubleTapLike],
  );

  const goalAmount = useMemo(() => {
    const parsedGoal = Number(item?.raiseAmount);
    return Number.isFinite(parsedGoal) && parsedGoal > 0 ? parsedGoal : 0;
  }, [item?.raiseAmount]);

  const currentRaised = useMemo(() => {
    const parsedRaised = Number(totalDonation);
    return Number.isFinite(parsedRaised) && parsedRaised > 0 ? parsedRaised : 0;
  }, [totalDonation]);

  const progressPercent = useMemo(
    () => (goalAmount > 0 ? (currentRaised / goalAmount) * 100 : 0),
    [goalAmount, currentRaised],
  );

  const progressBarColor = useMemo(
    () => getProgressBarColor(progressPercent, item?.profile),
    [progressPercent, item?.profile],
  );

  const isGoalAmountRaised = goalAmount > 0 && currentRaised >= goalAmount;
  const isCampaignDaysCompleted = goalAmount > 0 && !!item?.end_time && daysLeft <= 0;

  const progressStatusLabel = isGoalAmountRaised
    ? t('postItem.goalAmountRaised')
    : isCampaignDaysCompleted
      ? t('postItem.daysCompleted')
      : '';

  const onMomentumEnd = useCallback(e => {
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const index = Math.round(x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  }, [currentIndex]);

  const handleOpenReel = useCallback(
    mediaItem => {
      const uniqueKey = Date.now().toString();
      const allMediaUrls = Array.isArray(item?.media)
        ? item.media.map(m => m?.url).filter(Boolean)
        : [];

      const params = {
        item: {
          ...item,
          image: mediaItem?.url,
          images:
            allMediaUrls.length > 0
              ? allMediaUrls
              : mediaItem?.url
                ? [mediaItem.url]
                : [],
          isVideo: true,
          type: 'video',
          mediaType: 'video',
          userName: item?.userName || item?.username || t('postItem.unknownUser'),
          userImage: item?.userImage || item?.avatar || null,
          userId: item?.userId || item?.UserId || null,
        },
        key: uniqueKey,
        returnTo: route?.name || returnTo,
        returnParams: route?.params || {},
        // Explicit nested return target (prevents "NAVIGATE ... not handled" warnings).
        returnToTab: (() => {
          const names = navigation.getState?.()?.routeNames || [];
          if (names.includes('Profile')) return 'ProfileMain';
          if (names.includes('Home')) return 'HomeMain';
          return 'HomeMain';
        })(),
        returnToScreen: (() => {
          const names = navigation.getState?.()?.routeNames || [];
          if (names.includes('Profile')) return 'Profile';
          if (names.includes('Home')) return 'Home';
          return 'Home';
        })(),
      };

      // Prefer navigating within the nearest navigator that actually owns `FlipsScreen`
      // so back navigation returns to the current screen automatically.
      // let targetNavigation = navigation;
      // while (targetNavigation) {
      //   const routeNames = targetNavigation.getState?.()?.routeNames || [];
      //   if (routeNames.includes('FlipsScreen')) {
      //     targetNavigation.navigate('FlipsScreen', params);
      //     return;
      //   }
      //   targetNavigation = targetNavigation.getParent?.();
      // }

      // navigation.navigate('ProfileMain', { screen: 'FlipsScreen', params });
    },
    [item, navigation, returnTo, route?.name, route?.params, t],
  );

  const handleFollowPress = useCallback(async () => {
    if (!itemUserIdStr || !currentUserIdStr || itemUserIdStr === currentUserIdStr || followingBusy) return;
    const shouldFollow = !item.follow;
    const followHandler = executeFollowAction || onToggleFollow;
    if (!followHandler) return;
    const result = await followHandler(item.UserId, shouldFollow, item.userTokenAddress);
    const success = typeof result === 'boolean' ? result : true;
    if (!success || !shouldFollow) return;
    if (isSupportAllowed({ supporterProfile, recipientProfile })) {
      setModalVisible(true);
    }
  }, [
    currentUserIdStr,
    followingBusy,
    item?.UserId,
    item.follow,
    item.userTokenAddress,
    itemUserIdStr,
    executeFollowAction, onToggleFollow, supporterProfile, recipientProfile,
  ]);

  const renderMedia = useCallback(
    ({ item: mediaItem, index }) => {
      const isVideo = mediaItem.type === 'video' || isVideoUrl(mediaItem.url);
      const isPaused = videoStates[index] ?? false;
      const isVideoReady = !!videoLoaded[index];
      const shouldPlay = index === currentIndex && playbackEligible && !isZooming;

      const slideH = getSlideHeight(index);
      const preview = getPostSlidePreviewState({
        mediaUri: mediaItem.url,
        fallbackImage: mediaItem,
        parsedPostMeta,
        slideIndex: index,
        rootItem: item,
        isVideoSlide: isVideo,
      });
      const { overlayBundle, showOverlays: hasSlideOverlays } = preview;

      return (
        <View style={[styles.mediaContainer, { height: slideH }]}>
          {isVideo ? (
            <View style={{ width, height: slideH }}>
              {!isVideoReady && mediaItem.thumbnail && (
                <Image
                  source={{ uri: mediaItem.thumbnail }}
                  style={{ width, height: slideH, position: 'absolute' }}
                  resizeMode="cover"
                />
              )}
              <TapGestureHandler
                numberOfTaps={1}
                maxDist={12}
                onHandlerStateChange={({ nativeEvent }) => {
                  if (nativeEvent?.state === State.END) handleOpenReel(mediaItem);
                }}
              >
                <View collapsable={false} style={{ width, height: slideH }}>
                  <InstagramZoomableVideo
                    uri={mediaItem.url}
                    thumbnailUri={mediaItem.thumbnail}
                    videoHeight={slideH}
                    paused={!shouldPlay}
                    muted={isMuted}
                    repeat
                    onVideoRef={ref => { if (ref) videoRefsMap.current[index] = ref; }}
                    onLoadStart={() => setVideoLoaded(prev => ({ ...prev, [index]: false }))}
                    onLoad={() => setVideoLoaded(prev => ({ ...prev, [index]: true }))}
                    onError={error => console.log('Video error:', error)}
                    bufferConfig={{
                      minBufferMs: 2000,
                      maxBufferMs: 10000,
                      bufferForPlaybackMs: 1000,
                      bufferForPlaybackAfterRebufferMs: 2000,
                    }}
                    maxBitRate={1200000}
                    onZoomChange={zoomed => {
                      setIsZooming(zoomed);
                      setScrollEnabled(!zoomed);
                    }}
                    simultaneousHandlers={listRef}
                  />
                  {hasSlideOverlays ? (
                    <PostMediaTextOverlays
                      textOverlays={overlayBundle.textOverlays}
                      overlayImages={overlayBundle.overlayImages}
                      musicSticker={overlayBundle.musicSticker}
                      width={width}
                      height={slideH}
                      canvasWidth={overlayBundle.canvasWidth}
                      canvasHeight={overlayBundle.canvasHeight}
                    />
                  ) : null}
                  <View
                    pointerEvents="none"
                    style={[styles.videoOverlay, styles.videoOverlayTransparent]}
                    collapsable={false}
                  >
                    {isPaused ? (
                      <View style={styles.playButtonContainer}>
                        <Icon name="play" size={32} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                </View>
              </TapGestureHandler>
              <TouchableOpacity
                style={styles.speakerButton}
                onPress={() => setIsMuted(prev => !prev)}>
                <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width, height: slideH }}>
              <InstagramZoomableImage
                uri={mediaItem.url}
                height={slideH}
                onZoomChange={zoomed => {
                  setIsZooming(zoomed);
                  setScrollEnabled(!zoomed);
                }}
              />
              {hasSlideOverlays ? (
                <PostMediaTextOverlays
                  textOverlays={overlayBundle.textOverlays}
                  overlayImages={overlayBundle.overlayImages}
                  musicSticker={overlayBundle.musicSticker}
                  width={width}
                  height={slideH}
                  canvasWidth={overlayBundle.canvasWidth}
                  canvasHeight={overlayBundle.canvasHeight}
                />
              ) : null}
            </View>
          )}
        </View>
      );
    },
    [currentIndex, handleOpenReel, isVideoUrl, videoStates, isZooming, isMuted,
      playbackEligible, getSlideHeight, videoLoaded, width, parsedPostMeta],
  );

  const shouldPlayPostFeedMusic =
    Boolean(postMusic) && playbackEligible && !isZooming && !isCurrentSlideVideo;
  const shouldPlayAudio = shouldPlayPostFeedMusic && !isMuted;

  useEffect(() => {
    shouldPlayAudioRef.current = shouldPlayAudio;
  }, [shouldPlayAudio]);

  useEffect(() => {
    if (postMusic?.kind !== 'youtube') return;
    if (!isMuted && postFeedYoutubeRef.current?.unMute) {
      postFeedYoutubeRef.current?.unMute?.();
    }
  }, [isMuted, postMusic?.kind]);

  useEffect(() => {
    if (postMusic?.kind !== 'youtube') return;
    if (shouldPlayAudio) return;
    (async () => {
      try { await postFeedYoutubeRef.current?.pauseVideo?.(); } catch (_) { }
    })();
  }, [shouldPlayAudio, postMusic?.kind]);

  useEffect(() => {
    if (!postMusic) return;
    return () => {
      try {
        postFeedYoutubeRef.current?.pauseVideo?.();
        postFeedMp3Ref.current?.pause?.();
      } catch (_) { }
    };
  }, [postMusic?.kind, postMusic?.videoId, postMusic?.audioUrl, item.id]);

  useEffect(() => {
    if (postMusic?.kind !== 'youtube' || !screenFocused) return;
    const trim = postMusic.trim;
    const tick = setInterval(() => {
      (async () => {
        try {
          if (!shouldPlayAudioRef.current) return;
          const cur = await postFeedYoutubeRef.current?.getCurrentTime?.();
          if (typeof cur !== 'number' || Number.isNaN(cur)) return;
          const dur = postFeedMusicDurRef.current || 180;
          const { start: playStart, end: playEnd, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(trim, dur);
          const margin = Math.min(0.35, Math.max(0.08, (playEnd - playStart) * 0.02));
          if (hasOverlap && playEnd > playStart && cur >= playEnd - margin) {
            await postFeedYoutubeRef.current?.seekTo?.(playStart, true);
          }
        } catch (_) { }
      })();
    }, 320);
    return () => clearInterval(tick);
  }, [
    postMusic?.kind, postMusic?.videoId, postMusic?.trim?.start,
    postMusic?.trim?.end, screenFocused, item?.id,
  ]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => handleUserProfile(item.UserId)}
            style={styles.avatarContainer}>
            <HexAvatar
              uri={item.avatar}
              size={42}
              borderWidth={2}
              borderColor={item?.profile === 'company' ? '#C9A15a' : '#5a2d82'}
            />
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <TouchableOpacity
              onPress={() => handleUserProfile(item.UserId)}
              style={styles.userRow}>
              <Text
                style={[
                  styles.username,
                  { color: item?.profile === 'user' ? '#5a2d82' : '#C9A15a' },
                ]}>
                {item.username}
              </Text>
              {isKycVerified && (
                <View style={styles.dragonflyIcon}>
                  <DragonflyIcon width={18} height={18} />
                </View>
              )}
            </TouchableOpacity>
            {supportsLocation && (isPostOwner || locationValue.trim()) ? (
              <TouchableOpacity
                onPress={handleOpenLocationEditor}
                disabled={!isPostOwner}
                activeOpacity={isPostOwner ? 0.7 : 1}
                style={styles.locationRow}>
                <Icon name="location-sharp" size={13} color="#E53935" style={styles.locationIcon} />
                <Text
                  style={[
                    styles.locationText,
                    !locationValue.trim() && styles.locationPlaceholderText,
                  ]}
                  numberOfLines={1}>
                  {locationDisplayText}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.priceSection} />

          <TouchableOpacity
            onPress={() => onOptions?.(item.id)}
            style={styles.moreButton}>
            <Feather name="more-vertical" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Media */}
        <View style={[styles.mediaWrapper, { height: currentMediaHeight }]}>
          {postMusic?.kind === 'mp3' ? (
            <Video
              ref={postFeedMp3Ref}
              key={`feed_mp3_${item.id}_${postMusic.audioUrl}_${currentIndex}`}
              source={{ uri: postMusic.audioUrl }}
              style={styles.hiddenPostAudio}
              paused={!shouldPlayAudio}
              muted={!shouldPlayAudio}
              repeat={false}
              volume={shouldPlayAudio ? 1 : 0}
              resizeMode="contain"
              controls={false}
              playWhenInactive={false}
              ignoreSilentSwitch="ignore"
              onLoad={e => {
                const d = e?.duration > 0 ? e.duration : 180;
                postFeedMusicDurRef.current = d;
                const { start, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(postMusic.trim, d);
                const seekTo = hasOverlap ? start : 0;
                setTimeout(() => postFeedMp3Ref.current?.seek?.(seekTo), 80);
              }}
              onProgress={({ currentTime }) => {
                const dur = postFeedMusicDurRef.current || 180;
                const { start: ps, end: pe, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(
                  postMusic.trim, dur,
                );
                const margin = Math.min(0.35, Math.max(0.08, (pe - ps) * 0.02));
                if (hasOverlap && pe > ps && currentTime >= pe - margin) {
                  postFeedMp3Ref.current?.seek?.(ps);
                }
              }}
            />
          ) : null}

          {postMusic?.kind === 'youtube' && !isMuted ? (
            <View style={styles.hiddenPostYoutube} pointerEvents="none" collapsable={false}>
              <YoutubePlayer
                ref={postFeedYoutubeRef}
                key={`feed_yt_${item.id}_${postMusic.videoId}`}
                height={200}
                width={200}
                videoId={postMusic.videoId}
                play={!isMuted}
                mute={false}
                volume={!isMuted ? 100 : 0}
                initialPlayerParams={{ controls: false, modestbranding: true, rel: false }}
                onReady={async () => {
                  try {
                    if (isMuted) await postFeedYoutubeRef.current?.mute?.();
                    const d = await postFeedYoutubeRef.current?.getDuration?.();
                    if (typeof d === 'number' && d > 0) {
                      postFeedMusicDurRef.current = d;
                    } else if (
                      postMusic.durationSec != null &&
                      Number.isFinite(Number(postMusic.durationSec))
                    ) {
                      postFeedMusicDurRef.current = Number(postMusic.durationSec);
                    }
                    const dur = postFeedMusicDurRef.current || 180;
                    const { start: ps, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(postMusic.trim, dur);
                    await postFeedYoutubeRef.current?.seekTo?.(hasOverlap ? ps : 0, true);
                  } catch (_) { }
                }}
                onChangeState={state => { }}
              />
            </View>
          ) : null}

          {taggedUsers.length > 0 && (
            <TouchableOpacity
              style={styles.tagButton}
              onPress={() => setShowTaggedPeopleModal(true)}
              activeOpacity={0.8}>
              <Feather name="tag" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          <GestureDetector gesture={doubleTapLikeGesture}>
            <FlatList
              ref={listRef}
              data={safeMedia}
              keyExtractor={(_, i) => `media-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={scrollEnabled && safeMedia.length > 1}
              onMomentumScrollEnd={onMomentumEnd}
              decelerationRate="fast"
              snapToInterval={width}
              snapToAlignment="start"
              disableIntervalMomentum={true}
              directionalLockEnabled
              nestedScrollEnabled
              renderItem={renderMedia}
              removeClippedSubviews={false}
              maxToRenderPerBatch={2}
              windowSize={3}
              initialNumToRender={1}
              extraData={`${currentIndex}-${currentMediaHeight}`}
              style={{ height: currentMediaHeight }}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
            />
          </GestureDetector>

          {showDoubleTapHeart && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.doubleTapHeartBurst,
                { transform: [{ scale: doubleTapHeartScale }] },
              ]}>
              <Icon name="heart" size={100} color="#ff3040" />
            </Animated.View>
          )}

          {item.media && item.media.length > 1 && (
            <>
              <View style={styles.mediaCounter}>
                <Text style={styles.mediaCounterText}>
                  {currentIndex + 1}/{item.media.length}
                </Text>
              </View>
              <View style={styles.dotsContainer}>
                {item.media.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      { backgroundColor: idx === currentIndex ? text : 'rgba(255,255,255,0.5)' },
                    ]}
                  />
                ))}
              </View>
            </>
          )}

          {postMusic && !isCurrentSlideVideo && (
            <TouchableOpacity
              style={styles.speakerButton}
              onPress={() => setIsMuted(prev => !prev)}
              accessibilityLabel={
                isMuted
                  ? t('postItem.unmuteMusic')
                  : t('postItem.muteMusic')
              }>
              <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <View style={styles.leftActions}>
            <View style={[styles.actionButton, styles.likeActionGroup]}>
              <TouchableOpacity
                onPress={handleLike}
                style={styles.likeIconButton}
                accessibilityLabel={localLiked ? t('postItem.unlikePost') : t('postItem.likePost')}
                accessibilityRole="button">
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Thumbup
                    width={24}
                    height={24}
                    style={[
                      styles.actionSvgIcon,
                      !localLiked && styles.actionSvgIconInactive,
                    ]}
                  />
                </Animated.View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleViewLikes}
                disabled={localLikesCount <= 0 || likesLoading}
                style={styles.likeCountButton}
                accessibilityLabel={t('postItem.viewLikes')}
                accessibilityRole="button"
                accessibilityState={{ disabled: localLikesCount <= 0 }}>
                {likesLoading ? (
                  <ActivityIndicator size="small" color="#6B7280" style={styles.likeCountLoader} />
                ) : (
                  <Text
                    style={[
                      styles.actionCount,
                      localLikesCount > 0 && styles.actionCountClickable,
                    ]}>
                    {localLikesCount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => onComment?.(item.id, item.UserId)}
              style={styles.actionButton}>
              <Comments width={22} height={22} style={styles.actionSvgIcon} />
              <Text style={styles.actionCount}>{localCommentsCount || 0}</Text>
            </TouchableOpacity>

            {item.visibleTo !== "PRIVATE_CIRCLE" &&
              <TouchableOpacity
                onPress={() => {
                  setSelectedPostId(item);
                  requestAnimationFrame(() => shareRef.current?.open?.());
                }}
                style={styles.actionButton}>
                <ShareIcom width={22} height={22} style={styles.actionSvgIcon} />
                <Text style={styles.actionCount}>{t('flips.shareLabel')}</Text>
              </TouchableOpacity>
            }

            {showTrustControls && (
              <>
                {!hasSubmittedTrustVote && !trustVote && (
                  <TouchableOpacity
                    onPress={handleTrustIconPress}
                    disabled={trustVoteStatusLoading}
                    style={[
                      styles.actionButton,
                      trustVoteStatusLoading && styles.trustActionDisabled,
                    ]}
                    activeOpacity={trustVoteStatusLoading ? 1 : 0.85}
                    accessibilityLabel="Open trust vote"
                    accessibilityState={{ disabled: trustVoteStatusLoading }}>
                    <View style={styles.trustActionIcon}>
                      <Icon name="shield-checkmark" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.actionCount}>
                      {t('postItem.trust')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/*
                  Trust SCORE summary — an additional button, shown only once
                  backend data is available. Does not replace the vote button above.
                */}
                {trustScore && (
                  <>
                    {/* <View style={styles.trustHeaderDivider} /> */}
                    <TouchableOpacity
                      onPress={handleTrustScorePress}
                      style={styles.trustScoreActionButton}
                      activeOpacity={0.85}>
                      <View style={styles.trustScoreActionTextWrap}>
                        <View style={styles.trustScoreActionTitleRow}>
                          <Text
                            style={[
                              styles.trustScoreActionTitle,
                              (hasSubmittedTrustVote || trustVote) && styles.trustScoreActionTitleVoted,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="clip">
                            {t('postItem.trustScore')}
                          </Text>
                          <Icon name="information-circle-outline" size={10} color="#6B7280" />
                          <Text
                            style={[
                              styles.trustScoreValue,
                              (hasSubmittedTrustVote || trustVote) && styles.trustScoreValueVoted,
                            ]}
                            numberOfLines={1}>
                            {Math.round(normalizedTrustScore.overall)}%
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.trustScoreActionSub,
                            (hasSubmittedTrustVote || trustVote) && styles.trustScoreActionSubVoted,
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail">
                          {t('postItem.communityTrustScore')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>

          {itemUserIdStr && currentUserIdStr && itemUserIdStr !== currentUserIdStr && (
            <TouchableOpacity
              onPress={handleFollowPress}
              disabled={followingBusy}
              style={[
                styles.followButton,
                item.follow && styles.followingButton,
                { backgroundColor: item?.profile === 'user' ? '#5a2d82' : '#C9A15a' },
              ]}>
              {followingBusy ? (
                <ActivityIndicator size="small" color={item.follow ? text : '#FFFFFF'} />
              ) : (
                <Text style={[styles.followButtonText, item.follow && styles.followingButtonText]}>
                  {item.follow ? t('postItem.followed') : t('postItem.follow')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {!!mintedDateTime && (
          <View style={styles.mintedSection}>
            <Icon name="calendar-outline" size={14} color="#6B7280" style={styles.mintedIcon} />
            <Text style={styles.mintedText}>
              {t(mintLabelKey, { dateTime: mintedDateTime })}
            </Text>
          </View>
        )}

        {showTrustControls && trustPanelVisible && !hasSubmittedTrustVote && (
          <View style={styles.trustVotePanel}>
            <View style={styles.trustIntro}>
              <View style={styles.trustIntroIcon}>
                <Icon name="shield-checkmark" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.trustIntroTextWrap}>
                <Text style={styles.trustTitle}>{t('postItem.communityTrustScore')}</Text>
                <Text style={styles.trustBodyText}>{t('postItem.trustBodyText')}</Text>
                <Text style={styles.trustMutedText}>{t('postItem.trustMutedText')}</Text>
              </View>
            </View>
            <View style={styles.trustOptionsRow}>
              {TRUST_OPTIONS.map(option => {
                const selected = trustVote?.type === option.type;
                const optionDisabled = hasSubmittedTrustVote || trustLoading || trustVoteStatusLoading;
                return (
                  <TouchableOpacity
                    key={option.type}
                    style={[
                      styles.trustOptionButton,
                      selected && styles.trustOptionSelected,
                      optionDisabled && styles.trustOptionDisabled,
                    ]}
                    onPress={() => handleTrustVote(option.type)}
                    disabled={optionDisabled}
                    activeOpacity={optionDisabled ? 1 : 0.85}>
                    <Feather name={option.icon} size={17} color={option.color} />
                    <Text style={styles.trustOptionLabel}>{t(option.labelKey)}</Text>
                    <Text style={styles.trustOptionDetail} numberOfLines={1}>{t(option.detailKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {trustLoading ? <ActivityIndicator size="small" color="#059669" /> : null}
          </View>
        )}

        {showTrustControls && trustScoreVisible && (
          <View style={styles.trustScorePanel}>
            {trustScoreLoading ? (
              <ActivityIndicator size="small" color="#059669" />
            ) : (
              <>
                <View style={styles.trustProgressTrack}>
                  <View
                    style={[
                      styles.trustProgressFill,
                      {
                        width: `${normalizedTrustScore.overall > 0
                          ? Math.max(2, normalizedTrustScore.overall)
                          : 0
                          }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trustProgressValue}>{Math.round(normalizedTrustScore.overall)}%</Text>
                <View style={styles.trustMetricRow}>
                  <View style={styles.trustMetricItem}>
                    <View style={[styles.trustMetricIconBadge, { backgroundColor: '#059669' }]}>
                      <Icon name="checkmark" size={12} color="#fff" />
                    </View>
                    <Text style={styles.trustMetricLabel}>{t('postItem.trustApprove')}</Text>
                    <Text style={[styles.trustMetricPercent, { color: '#059669' }]}>
                      {Math.round(normalizedTrustScore.agree)}%
                    </Text>
                    <Text style={styles.trustMetricVotes}>
                      {t('postItem.trustVotes', { count: normalizedTrustScore.agreeVotes })}
                    </Text>
                    <Text style={styles.trustMetricSub}>{t('postItem.weightedByReputation')}</Text>
                  </View>
                  <View style={styles.trustMetricDivider} />
                  <View style={styles.trustMetricItem}>
                    <View style={[styles.trustMetricIconBadge, { backgroundColor: '#F59E0B' }]}>
                      <Icon name="help" size={12} color="#fff" />
                    </View>
                    <Text style={styles.trustMetricLabel}>{t('postItem.trustUnsure')}</Text>
                    <Text style={[styles.trustMetricPercent, { color: '#F59E0B' }]}>
                      {Math.round(normalizedTrustScore.notSure)}%
                    </Text>
                    <Text style={styles.trustMetricVotes}>
                      {t('postItem.trustVotes', { count: normalizedTrustScore.notSureVotes })}
                    </Text>
                    <Text style={styles.trustMetricSub}>{t('postItem.weightedByReputation')}</Text>
                  </View>
                  <View style={styles.trustMetricDivider} />
                  <View style={styles.trustMetricItem}>
                    <View style={[styles.trustMetricIconBadge, { backgroundColor: '#DC2626' }]}>
                      <Icon name="close" size={12} color="#fff" />
                    </View>
                    <Text style={styles.trustMetricLabel}>{t('postItem.trustDisagree')}</Text>
                    <Text style={[styles.trustMetricPercent, { color: '#DC2626' }]}>
                      {Math.round(normalizedTrustScore.disagree)}%
                    </Text>
                    <Text style={styles.trustMetricVotes}>
                      {t('postItem.trustVotes', { count: normalizedTrustScore.disagreeVotes })}
                    </Text>
                    <Text style={styles.trustMetricSub}>{t('postItem.weightedByReputation')}</Text>
                  </View>
                </View>
                {getTrustVoteId(trustVote) ? (
                  <TouchableOpacity
                    style={styles.trustUndoButton}
                    onPress={handleTrustUndo}
                    disabled={trustLoading}
                    activeOpacity={0.85}>
                    <Text style={styles.trustUndoText}>{t('postItem.trustUndoVote')}</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        )}

        {/* Buyers / followers row */}
        {(() => {
          const itemUserId = item?.UserId ? String(item.UserId) : null;
          const currentUserId = userId ? String(userId) : null;
          return itemUserId && itemUserId !== currentUserId;
        })() && (
            <>
              {displayBuyerList.length > 0 && (
                <TouchableOpacity
                  style={styles.buyersSection}
                  activeOpacity={0.8}
                  onPress={() => setShowBuyersModal(true)}>
                  <View style={styles.avatarsContainer}>
                    {displayBuyerList.slice(0, 3).map((buyer, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.buyerAvatarWrapper,
                          { marginLeft: idx > 0 ? -10 : 0, zIndex: 3 - idx, elevation: 3 - idx },
                        ]}>
                        <HexAvatar
                          uri={buyer.avatar}
                          size={28}
                          borderWidth={1.5}
                          borderColor={item?.profile === 'company' ? '#C9A15a' : '#5a2d82'}
                        />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.buyersText} numberOfLines={1}>
                    {t('postItem.followedBy')}{' '}
                    <Text
                      style={[
                        styles.buyerName,
                        { color: item?.profile === 'user' ? '#5a2d82' : '#C9A15a' },
                      ]}>
                      {displayBuyerList[0]?.username || '—'}
                    </Text>
                    {displayBuyerList.length > 1 && (
                      <Text style={{ color: item?.profile === 'user' ? '#5a2d82' : '#C9A15a' }}>
                        {' '}{t('postItem.andOthers', { count: formatNumber(displayBuyerList.length - 1) })}
                      </Text>
                    )}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

        {/* Caption */}
        <View style={styles.captionSection}>
          {!!captionValue && (
            <>
              {expanded ? (
                <Text style={styles.captionRow}>
                  <Text
                    onPress={() => handleUserProfile(item.UserId)}
                    style={[
                      styles.captionUsername,
                      { color: item?.profile === 'user' ? '#5a2d82' : '#C9A15a' },
                    ]}>
                    {usernameText}{' '}
                  </Text>
                  <Text style={styles.captionText}>{captionValue}</Text>
                </Text>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={hasExpandableCaption ? () => setExpanded(true) : undefined}
                  disabled={!hasExpandableCaption}>
                  <Text
                    style={styles.captionRow}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                  >
                    <Text
                      onPress={() => handleUserProfile(item.UserId)}
                      style={[
                        styles.captionUsername,
                        { color: item?.profile === 'user' ? '#5a2d82' : '#C9A15a' },
                      ]}>
                      {usernameText}{' '}
                    </Text>
                    <Text style={styles.captionText}>{collapsedCaption}</Text>
                    {hasExpandableCaption ? (
                      <Text style={styles.captionMoreText}>{t('postItem.seeMore')}</Text>
                    ) : null}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {hasExpandableCaption && expanded && (
            <Text style={styles.captionToggleText} onPress={() => setExpanded(false)}>
              {t('postItem.seeLess')}
            </Text>
          )}

          {item.link ? (
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleOpenExternalLink(item.link)}>
              <Text style={styles.linkText}>
                {t('postItem.linkPrefix')} - {item.link}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Donation / progress section */}
        {goalAmount > 0 && (
          <View style={styles.progressSection}>
            {progressStatusLabel ? (
              <View style={styles.progressStatusBadge}>
                <Text style={styles.progressStatusBadgeText}>{progressStatusLabel}</Text>
              </View>
            ) : null}

            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(progressPercent, 100)}%`,
                      backgroundColor: progressBarColor,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressStatsContainer}>
                <View style={styles.statAtStart}>
                  <Text style={styles.statValueSmall}>
                    {isLoadingDonation
                      ? '...'
                      : t('postItem.funded', {
                        percent: Math.min(progressPercent, 100).toFixed(1),
                      })}
                  </Text>
                </View>
                <View style={styles.statAtCenter}>
                  <Text style={styles.statValueSmall}>
                    {isLoadingDonation
                      ? t('postItem.loading')
                      : t('postItem.raised', {
                        current: `${currencyPrefix}${formatNumber(currentRaised)}`,
                        goal: `${currencyPrefix}${formatNumber(goalAmount)}`,
                      })}
                  </Text>
                </View>
                <View style={styles.statAtEnd}>
                  <Text style={styles.statValueSmall}>
                    {t('postItem.daysLeft', { count: daysLeft || 0 })}
                  </Text>
                </View>
              </View>

              {!hideDonationButton &&
                !isGoalAmountRaised &&
                itemUserIdStr &&
                currentUserIdStr &&
                itemUserIdStr !== currentUserIdStr &&
                daysLeft > 0 &&
                item?.end_time && (
                  <TouchableOpacity
                    onPress={() => setDonation(true)}
                    style={[{
                      backgroundColor: item?.profile === 'user' ? '#5a2d82' : '#C9A15a',
                      width: '25%',
                      left: '74%',
                      marginBottom: 5,
                      marginTop: -10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                    }]}>
                    <Text style={styles.followButtonText}>
                      {t('postItem.donate')}
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        )}
      </View>

      <MissionSupportScreen
        visible={donation}
        onClose={() => setDonation(false)}
        item={item}
        onDonationSuccess={handleDonationSuccess}
      />
      <ShareModal ref={shareRef} post={selectedPostId || item} postId={item?.id} />
      <BuyersListModal
        visible={showBuyersModal}
        onClose={() => setShowBuyersModal(false)}
        buyers={displayBuyerList}
        profileType={modalProfileType}
        onUserPress={id => { setShowBuyersModal(false); handleUserProfile(id); }}
      />
      <BuyersListModal
        visible={showTaggedPeopleModal}
        onClose={() => setShowTaggedPeopleModal(false)}
        users={taggedUsers}
        title={t('postItem.taggedPeople')}
        enableSearch={false}
        showChevron={false}
        emptyTitle={t('postItem.noTaggedPeople')}
        emptyText={t('postItem.noTaggedPeopleText')}
        onUserPress={(id, item) => {
          setShowTaggedPeopleModal(false);
          const resolvedId =
            item?.id ||
            item?.userId ||
            item?._id ||
            id;
          handleUserProfile(resolvedId);
        }}
      />
      <BuyersListModal
        visible={showLikesModal}
        onClose={() => setShowLikesModal(false)}
        users={likesUsers}
        title={t('postItem.likedBy')}
        searchPlaceholder={t('postItem.searchLikes')}
        emptyTitle={t('postItem.noLikesYet')}
        emptyText={t('postItem.noLikesYetText')}
        onUserPress={(id, likeItem) => {
          setShowLikesModal(false);
          const resolvedId =
            likeItem?.id ||
            likeItem?.userId ||
            likeItem?._id ||
            id;
          handleUserProfile(resolvedId);
        }}
      />
      <SupportCreatorModal
        visible={modalVisible}
        creatorName={item?.username || t('postItem.defaultCreatorName')}
        onClose={() => setModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={item?.username || t('postItem.defaultCreatorName')}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
        canSupport={canSupport}
      />
      <TrustCommentModal
        visible={trustCommentModalVisible && !hasSubmittedTrustVote}
        voteType={trustCommentModalType}
        onClose={() => setTrustCommentModalVisible(false)}
        onSubmit={handleTrustVoteWithComment}
      />

      {supportsLocation ? (
        <PostLocationModal
          visible={locationModalVisible}
          initialValue={locationValue}
          saving={locationSaving}
          onClose={() => setLocationModalVisible(false)}
          onSave={handleSaveLocation}
        />
      ) : null}
    </View>
  );
}

export default React.memo(PostItem, (prev, next) => {
  if (prev.item?.id !== next.item?.id) return false;
  if (prev.liked !== next.liked) return false;
  if (prev.saved !== next.saved) return false;
  if (prev.likesCount !== next.likesCount) return false;
  if (prev.commentsCount !== next.commentsCount) return false;
  if (prev.followingBusy !== next.followingBusy) return false;
  if (prev.isVisible !== next.isVisible) return false;
  if (prev.screenFocused !== next.screenFocused) return false;
  if (prev.playingPostId !== next.playingPostId) return false;
  if (prev.item?.follow !== next.item?.follow) return false;
  if (prev.isTrustPost !== next.isTrustPost) return false;
  if (prev.item?.isTrustPost !== next.item?.isTrustPost) return false;
  if (prev.shareCount !== next.shareCount) return false;
  if (prev.item?.location !== next.item?.location) return false;
  if (prev.item?.createdAt !== next.item?.createdAt) return false;
  return true;
});

const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: 18,
    position: 'relative',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontWeight: '700',
    fontSize: 16,
    marginRight: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    maxWidth: '100%',
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#4B5563',
    flexShrink: 1,
  },
  locationPlaceholderText: {
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  dragonflyIcon: {
    marginTop: 1,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  triangleIcon: {
    marginRight: 6,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  moreButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  mediaWrapper: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  doubleTapHeartBurst: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 6,
  },
  mediaContainer: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomVideoPrewarmHost: {
    position: 'absolute',
    width: 2,
    height: 2,
    opacity: 0,
    overflow: 'hidden',
    left: 0,
    top: 0,
    zIndex: -1,
  },
  zoomVideoPrewarmVideo: {
    width: 2,
    height: 2,
  },
  zoomVideoLoading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  zoomVideoLoadingBackdrop: {
    backgroundColor: '#000',
  },
  postMedia: {
    width: width,
    aspectRatio: 1,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  videoOverlayTransparent: {},
  playButtonContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  videoIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  mediaCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tagButton: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  trustActionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustActionDisabled: {
    opacity: 0.45,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  trustVotePanel: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  trustIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  trustIntroIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  trustIntroTextWrap: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  trustBodyText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#374151',
  },
  trustMutedText: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    color: '#6B7280',
  },
  trustOptionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  trustOptionButton: {
    flex: 1,
    minHeight: 62,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 3,
  },
  trustOptionSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  trustOptionDisabled: {
    opacity: 0.45,
  },
  trustOptionLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
  },
  trustOptionDetail: {
    marginTop: 2,
    fontSize: 9,
    color: '#6B7280',
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
  },
  actionButton: {
    marginRight: 10,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeActionGroup: {
    minWidth: 36,
  },
  likeIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 24,
    marginTop: 2,
  },
  likeCountLoader: {
    marginTop: 0,
  },
  actionSvgIcon: { opacity: 1 },
  actionSvgIconInactive: { opacity: 0.7 },
  actionCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  actionCountClickable: {
    color: '#374151',
  },
  mintedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  mintedIcon: {
    marginRight: 6,
  },
  mintedText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  trustScoreActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 100,
    maxWidth: 200,
    paddingHorizontal: 6,
  },
  trustHeaderDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
    marginRight: 14,
  },
  trustMetricIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  trustScoreActionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  trustScoreActionTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  trustScoreActionTitleRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  trustScoreActionTitle: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Nunito-SemiBold',
    color: '#6B7280',
    marginRight: 2,
    flexShrink: 1,
    maxWidth: 100,

  },
  trustScoreActionTitleVoted: {
    fontSize: 13,
    fontWeight: '700',
  },
  trustScoreValue: {
    marginLeft: 2,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'Nunito-SemiBold',
    color: '#10B981',
  },
  trustScoreValueVoted: {
    fontSize: 12,
    fontWeight: '800',
  },
  trustScoreActionSub: {
    marginTop: 1,
    fontSize: 8,
    fontFamily: 'Nunito-Regular',
    color: '#6B7280',
  },
  trustScoreActionSubVoted: {
    fontSize: 10,
    fontWeight: '600',
  },
  trustScorePanel: {
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trustProgressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginRight: 42,
  },
  trustProgressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#059669',
  },
  trustProgressValue: {
    position: 'absolute',
    top: 7,
    right: 8,
    fontSize: 13,
    fontWeight: '900',
    color: '#10B981',
    marginLeft: 10
  },
  trustMetricRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 12,
  },
  trustMetricItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  trustMetricLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
  },
  trustMetricPercent: {
    fontSize: 10,
    fontWeight: '900',
  },
  trustMetricVotes: {
    marginTop: 1,
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  trustMetricSub: {
    marginTop: 2,
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  trustMetricDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  trustUndoButton: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
  },
  trustUndoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#5a2d82',
    marginLeft: 8,
  },
  followingButtonText: {
    color: '#fff',
  },
  followingButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buyersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginTop: -10,
  },
  avatarsContainer: {
    flexDirection: 'row',
    marginRight: 8,
    overflow: 'visible',
  },
  buyerAvatarWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  buyersText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
    flexShrink: 1,
  },
  buyerName: {
    fontWeight: '600',
  },
  captionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  captionRow: {
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
  },
  captionText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '400',
    lineHeight: 20,
  },
  captionMoreText: {
    color: '#999',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  captionToggleText: {
    color: '#999',
    marginTop: 2,
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 3,
  },
  progressSection: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  progressBarWrapper: {
    position: 'relative',
  },
  progressStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    width: '100%',
  },
  progressStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 50,
    borderRadius: 5,
  },
  progressBarFill: {
    height: '100%',
  },
  progressStatsContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  statAtStart: {
    alignItems: 'flex-start',
  },
  statAtCenter: {
    alignItems: 'center',
  },
  statAtEnd: {
    alignItems: 'flex-end',
  },
  statValueSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statLabelSmall: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666',
    letterSpacing: 0.3,
  },
  hiddenPostAudio: {
    position: 'absolute',
    width: 2,
    height: 2,
    opacity: 0,
    left: 0,
    top: 0,
    zIndex: 0,
    pointerEvents: 'none',
  },
  hiddenPostYoutube: {
    position: 'absolute',
    width: 200,
    height: 200,
    opacity: 0.02,
    left: -220,
    top: 0,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  speakerButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  linkText: {
    fontWeight: '600',
  },
  gestureModalRoot: {
    flex: 1,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: 500,
    resizeMode: 'contain',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
