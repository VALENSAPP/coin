// components/chat/StoryViewerModal.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import Video from 'react-native-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import HexAvatar from '../home/story.js/HexAvatar';
import { getUserCredentials } from '../../services/post';
import { useLanguage } from '../../i18n';
import {
  normalizeStoryForViewer,
  resolveStoryAudioPayload,
  resolveStoryDurationMs,
  isStoryVideoUrl,
  splitStoryClipId,
} from '../../utils/storyAudioResolve';
import { hydrateStoryForViewer } from '../../utils/hydrateStoryForViewer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const storyYoutubeAudioStyle = {
  position: 'absolute',
  width: 200,
  height: 200,
  opacity: 0.02,
  left: -220,
  top: 0,
  zIndex: 5,
  overflow: 'hidden',
};

const pickNonEmpty = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

const unwrapUserProfileResponse = (response) => {
  const payload = response?.data ?? response ?? {};
  return (
    payload?.data?.user ||
    payload?.data?.profile ||
    payload?.data ||
    payload?.user ||
    payload?.profile ||
    payload
  );
};

const StoryViewerModal = ({ visible, story, onClose, userName, userImage }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [duration, setDuration] = useState(5);
  const [, setCurrentTime] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const youtubeRef = useRef(null);
  const directAudioRef = useRef(null);
  const directAudioDurationRef = useRef(0);
  const overlayAudioTimeRef = useRef(0);
  const isPausedRef = useRef(false);
  const visibleRef = useRef(false);
  const progressStartedRef = useRef(false);
  const mediaLoadedRef = useRef(false);

  // FIX: track how many seconds have elapsed so resume picks up from here
  const elapsedRef = useRef(0);
  const resumeStartedAtRef = useRef(null);

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [selfUserId, setSelfUserId] = useState(null);
  const [storyOwnerProfile, setStoryOwnerProfile] = useState(null);
  const [displayStory, setDisplayStory] = useState(null);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    (async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        setSelfUserId(id ? String(id) : null);
      } catch (_) {
        setSelfUserId(null);
      }
    })();
  }, []);

  const storyUserId = useMemo(() => {
    const candidate =
      story?.userId ||
      story?.UserId ||
      story?.user?._id ||
      story?.user?.id ||
      story?.user?.userId ||
      story?.senderId ||
      story?.sender?._id ||
      story?.sender?.id ||
      null;
    return candidate ? String(candidate) : null;
  }, [story]);

  useEffect(() => {
    let active = true;

    const fetchStoryOwnerProfile = async () => {
      if (!visible || !storyUserId) {
        if (active) setStoryOwnerProfile(null);
        return;
      }

      try {
        const response = await getUserCredentials(storyUserId);
        const rawUser = unwrapUserProfileResponse(response);

        if (!active) return;

        const displayName = pickNonEmpty(
          rawUser?.displayName,
          rawUser?.name,
          rawUser?.fullName,
          rawUser?.userName,
          rawUser?.username
        );
        const avatar = pickNonEmpty(
          rawUser?.image,
          rawUser?.avatar,
          rawUser?.profilePic,
          rawUser?.profilePicture,
          rawUser?.photoUrl,
          rawUser?.photoURL
        );

        setStoryOwnerProfile({ name: displayName, image: avatar });
      } catch (_error) {
        if (active) setStoryOwnerProfile(null);
      }
    };

    fetchStoryOwnerProfile();

    return () => {
      active = false;
    };
  }, [storyUserId, visible]);

  useEffect(() => {
    if (!visible || !story) {
      setDisplayStory(null);
      setHydrationComplete(false);
      return undefined;
    }

    let cancelled = false;
    setHydrationComplete(false);

    (async () => {
      try {
        const hydrated = await hydrateStoryForViewer(story, selfUserId);
        if (!cancelled) setDisplayStory(hydrated);
      } catch (_error) {
        if (!cancelled) setDisplayStory(normalizeStoryForViewer(story));
      } finally {
        if (!cancelled) setHydrationComplete(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, story, selfUserId]);

  const normalizedStory = useMemo(
    () => normalizeStoryForViewer(displayStory || story),
    [displayStory, story],
  );
  const storyUsername =
    pickNonEmpty(
      storyOwnerProfile?.name,
      userName,
      story?.userName,
      story?.username,
      story?.displayName,
      story?.user?.displayName,
      story?.user?.userName,
      story?.user?.username,
      story?.user?.name
    ) || t('storyViewer.unknownUser');

  const storyAvatar =
    storyOwnerProfile?.image ||
    userImage ||
    story?.userImage ||
    story?.avatar ||
    story?.profilePic ||
    story?.profilePicture ||
    story?.user?.image ||
    story?.user?.avatar ||
    story?.image ||
    FALLBACK_AVATAR;

  const isVideo =
    normalizedStory?.type === 'video' ||
    (normalizedStory?.uri && isStoryVideoUrl(normalizedStory.uri));

  const mediaUri = normalizedStory?.uri || null;

  const storyCaption = normalizedStory?.caption || normalizedStory?.text || '';

  const resolvedAudio = useMemo(
    () => resolveStoryAudioPayload(normalizedStory),
    [normalizedStory],
  );
  const youtubeVideoId = resolvedAudio.youtubeVideoId;
  const directAudioUrl = resolvedAudio.directUrl;
  const hasDirectAudio = typeof directAudioUrl === 'string' && directAudioUrl.length > 0;
  const hasOverlayAudio = hasDirectAudio || !!youtubeVideoId;
  const isYoutubeAudio = !hasDirectAudio && !!youtubeVideoId;
  const audioTrimStartSec = Math.max(0, Number(normalizedStory?.audioTrim?.start) || 0);
  const audioTrimEndSecRaw = Number(normalizedStory?.audioTrim?.end);
  const audioTrimEndSec =
    Number.isFinite(audioTrimEndSecRaw) && audioTrimEndSecRaw > audioTrimStartSec
      ? audioTrimEndSecRaw
      : null;
  const audioVolumePercent = Math.max(
    0,
    Math.min(100, Math.round((Number(normalizedStory?.volume) || 1) * 100)),
  );
  const shouldPlayStoryAudio = visible && !isPaused && hasOverlayAudio;
  const storySessionKey = useMemo(() => {
    const { baseId } = splitStoryClipId(story?.storyId || story?.id);
    const uri = story?.uri || story?.media?.[0] || '';
    return `${baseId || uri || 'story'}`;
  }, [story?.storyId, story?.id, story?.uri, story?.media]);

  const storyPlaybackKey = [
    normalizedStory?.id || normalizedStory?.storyId || mediaUri || 'story',
    youtubeVideoId || '',
    directAudioUrl || '',
  ].join(':');

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const pauseOverlayAudio = useCallback(() => {
    try { youtubeRef.current?.pauseVideo?.(); } catch (_e) { }
    try { youtubeRef.current?.mute?.(); } catch (_e) { }
    try { directAudioRef.current?.pause?.(); } catch (_e) { }
  }, []);

  const resolveOverlayAudioResumeSec = useCallback(() => {
    const saved = Number(overlayAudioTimeRef.current);
    if (Number.isFinite(saved) && saved >= audioTrimStartSec) {
      if (audioTrimEndSec != null && saved >= audioTrimEndSec) return audioTrimStartSec;
      return saved;
    }
    return audioTrimStartSec;
  }, [audioTrimEndSec, audioTrimStartSec]);

  const stopProgress = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    resumeStartedAtRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    stopProgress();
    pauseOverlayAudio();
    onClose();
  }, [onClose, pauseOverlayAudio, stopProgress]);

  // FIX: startProgress now resumes from elapsedRef instead of always starting at 0
  const startProgress = useCallback(
    (durationOverride) => {
      stopProgress();

      if (isVideo) return;

      const effectiveDuration = durationOverride ?? duration;
      // Record the wall-clock time we (re)started so we can measure incremental elapsed
      const resumeAt = Date.now();
      resumeStartedAtRef.current = resumeAt;

      timerRef.current = setInterval(() => {
        // Total elapsed = previously-accumulated + time since last resume
        const totalElapsed = elapsedRef.current + (Date.now() - resumeAt) / 1000;
        const progress = Math.min(totalElapsed / effectiveDuration, 1);

        setCurrentTime(totalElapsed);
        progressAnim.setValue(progress);

        if (progress >= 1) {
          stopProgress();
          handleClose();
        }
      }, 16);
    },
    [duration, handleClose, isVideo, progressAnim, stopProgress]
  );

  const beginStoryPlayback = useCallback(() => {
    if (progressStartedRef.current || !visibleRef.current || mediaError) return;
    progressStartedRef.current = true;

    const durationSec =
      resolveStoryDurationMs({ ...normalizedStory, type: isVideo ? 'video' : 'image' }) / 1000;
    setDuration(durationSec);

    if (!isVideo) {
      startProgress(durationSec);
    }
  }, [isVideo, mediaError, normalizedStory, startProgress]);

  const tryStartPlayback = useCallback(() => {
    if (
      !mediaLoadedRef.current ||
      !hydrationComplete ||
      progressStartedRef.current ||
      !visibleRef.current ||
      mediaError
    ) {
      return;
    }
    beginStoryPlayback();
  }, [beginStoryPlayback, hydrationComplete, mediaError]);

  const markMediaReady = useCallback(() => {
    mediaLoadedRef.current = true;
    setIsLoading(false);
    setMediaError(false);
    tryStartPlayback();
  }, [tryStartPlayback]);

  // Reset only when opening a different story — not when hydration adds audio metadata.
  useEffect(() => {
    if (!visible || !story) {
      mediaLoadedRef.current = false;
      progressStartedRef.current = false;
      return undefined;
    }

    mediaLoadedRef.current = false;
    progressStartedRef.current = false;
    setIsLoading(true);
    setMediaError(false);
    setIsPaused(false);
    setCurrentTime(0);
    elapsedRef.current = 0;
    overlayAudioTimeRef.current = 0;
    progressAnim.setValue(0);

    return undefined;
  }, [visible, storySessionKey, progressAnim]);

  // Start (or restart) playback once both media and hydrated metadata are ready.
  useEffect(() => {
    if (!visible || !hydrationComplete || !displayStory) return;
    overlayAudioTimeRef.current = Math.max(0, Number(normalizedStory?.audioTrim?.start) || 0);

    if (mediaLoadedRef.current) {
      setIsLoading(false);
      if (progressStartedRef.current && !isVideo) {
        elapsedRef.current = 0;
        progressStartedRef.current = false;
        progressAnim.setValue(0);
      }
      tryStartPlayback();
    }
  }, [
    displayStory,
    hydrationComplete,
    isVideo,
    normalizedStory?.audioTrim?.start,
    progressAnim,
    tryStartPlayback,
    visible,
  ]);

  useEffect(() => {
    if (visible && normalizedStory) {
      if (!mediaUri) {
        setMediaError(true);
        setIsLoading(false);
        stopProgress();
      }
    } else if (!visible) {
      stopProgress();
      pauseOverlayAudio();
    }

    return () => {
      if (!visible) {
        stopProgress();
        pauseOverlayAudio();
      }
    };
  }, [
    mediaUri,
    normalizedStory,
    pauseOverlayAudio,
    stopProgress,
    visible,
  ]);

  const handleVideoProgress = (data) => {
    if (data.currentTime && data.seekableDuration) {
      const progress = data.currentTime / data.seekableDuration;
      setCurrentTime(data.currentTime);
      progressAnim.setValue(progress);

      if (progress >= 0.99) {
        handleClose();
      }
    }
  };

  const handleVideoLoad = (data) => {
    if (data.duration) {
      setDuration(data.duration);
    }
    markMediaReady();
  };

  const handleImageLoad = () => {
    markMediaReady();
  };

  const handleMediaError = () => {
    mediaLoadedRef.current = false;
    setIsLoading(false);
    setMediaError(true);
    stopProgress();
    progressStartedRef.current = false;
    pauseOverlayAudio();
  };

  // FIX: use functional updater so we always read the real current value,
  // not a stale closure copy
  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const nowPaused = !prev;

      if (nowPaused) {
        if (resumeStartedAtRef.current) {
          elapsedRef.current += (Date.now() - resumeStartedAtRef.current) / 1000;
          resumeStartedAtRef.current = null;
        }
        stopProgress();
        pauseOverlayAudio();
      } else if (progressStartedRef.current) {
        startProgress();
      }

      return nowPaused;
    });
  }, [pauseOverlayAudio, startProgress, stopProgress]);

  const handleOpenStoryUserProfile = useCallback(() => {
    if (!storyUserId) return;

    handleClose();

    setTimeout(() => {
      if (selfUserId && String(storyUserId) === String(selfUserId)) {
        navigation.navigate('ProfileMain', { screen: 'Profile' });
        return;
      }

      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: String(storyUserId),
          username: storyUsername || '',
        },
      });
    }, 150);
  }, [handleClose, navigation, selfUserId, storyUserId, storyUsername]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          // Swipe down gesture
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 && gestureState.vy > 0.5) {
          handleClose();
        }
      },
    })
  ).current;

  if (!visible || !story) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <View style={styles.container} {...panResponder.panHandlers}>
        <View style={styles.mediaLayer}>
          <View style={styles.contentContainer}>
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}

            {mediaError ? (
              <View style={styles.mediaErrorContainer}>
                <Icon name="image-outline" size={48} color="rgba(255,255,255,0.7)" />
                <Text style={styles.mediaErrorText}>
                  {t('storyViewer.mediaUnavailable')}
                </Text>
              </View>
            ) : isVideo && mediaUri ? (
              <Video
                source={{ uri: mediaUri }}
                style={styles.media}
                resizeMode="contain"
                paused={isPaused || !visible}
                repeat={false}
                muted={hasOverlayAudio}
                volume={1}
                ignoreSilentSwitch="ignore"
                playWhenInactive={false}
                onLoad={handleVideoLoad}
                onProgress={handleVideoProgress}
                onError={handleMediaError}
                controls={false}
              />
            ) : mediaUri ? (
              <Image
                key={`story_image_${storySessionKey}_${mediaUri}`}
                source={{ uri: mediaUri }}
                style={styles.media}
                resizeMode="contain"
                onLoad={handleImageLoad}
                onLoadEnd={handleImageLoad}
                onError={handleMediaError}
              />
            ) : null}

            {isYoutubeAudio && shouldPlayStoryAudio ? (
              <View style={storyYoutubeAudioStyle} pointerEvents="none" collapsable={false}>
                <YoutubePlayer
                  ref={youtubeRef}
                  key={`modal_story_yt_${storyPlaybackKey}_${youtubeVideoId}`}
                  height={200}
                  width={200}
                  videoId={youtubeVideoId}
                  play
                  mute={false}
                  volume={audioVolumePercent}
                  initialPlayerParams={{ autoplay: true, controls: false, modestbranding: true, rel: false }}
                  onReady={async () => {
                    if (isPausedRef.current || !visibleRef.current) return;
                    try {
                      const resumeSec = resolveOverlayAudioResumeSec();
                      await youtubeRef.current?.setVolume?.(audioVolumePercent);
                      await youtubeRef.current?.unMuteVideo?.();
                      if (resumeSec > 0) await youtubeRef.current?.seekTo?.(resumeSec, true);
                      await youtubeRef.current?.playVideo?.();
                    } catch (_e) { }
                    if (mediaLoadedRef.current && hydrationComplete && !progressStartedRef.current && !isVideo) {
                      tryStartPlayback();
                    }
                  }}
                  onChangeState={state => {
                    if (isPausedRef.current || !visibleRef.current) {
                      if (state === 'playing') pauseOverlayAudio();
                      return;
                    }
                    if (state === 'ended') {
                      try {
                        youtubeRef.current?.seekTo?.(audioTrimStartSec, true);
                        if (!isPausedRef.current) youtubeRef.current?.playVideo?.();
                      } catch (_e) { }
                    }
                  }}
                  onError={e => console.warn('[StoryViewerModal] YouTube audio error', e)}
                />
              </View>
            ) : null}

            {hasDirectAudio && shouldPlayStoryAudio ? (
              <Video
                ref={directAudioRef}
                key={`modal_story_audio_${storyPlaybackKey}`}
                source={{ uri: directAudioUrl }}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                paused={false}
                muted={false}
                repeat={false}
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="ignore"
                volume={Math.max(0, Math.min(1, Number(normalizedStory?.volume) || 1))}
                onLoad={data => {
                  directAudioDurationRef.current = Number(data?.duration) || 0;
                  const resumeSec = resolveOverlayAudioResumeSec();
                  try { directAudioRef.current?.seek(resumeSec); } catch (_e) { }
                  if (mediaLoadedRef.current && hydrationComplete && !progressStartedRef.current && !isVideo) {
                    tryStartPlayback();
                  }
                }}
                onProgress={({ currentTime }) => {
                  overlayAudioTimeRef.current = currentTime;
                  const fallbackEnd = directAudioDurationRef.current || 0;
                  const end = audioTrimEndSec != null ? audioTrimEndSec : fallbackEnd;
                  if (end > 0 && currentTime >= end - 0.12) {
                    try { directAudioRef.current?.seek(audioTrimStartSec || 0); } catch (_e) { }
                  }
                  if (mediaLoadedRef.current && hydrationComplete && !progressStartedRef.current && !isVideo) {
                    tryStartPlayback();
                  }
                }}
                onEnd={() => {
                  try { directAudioRef.current?.seek(audioTrimStartSec || 0); } catch (_e) { }
                }}
                onError={e => console.warn('[StoryViewerModal] Direct audio error', e)}
              />
            ) : null}

            {isPaused && (
              <View style={styles.pauseIndicator}>
                <Icon name="play" size={60} color="rgba(255,255,255,0.8)" />
              </View>
            )}
          </View>
        </View>

        {storyCaption && storyCaption.trim() !== '' && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={[styles.captionContainer, styles.captionZ]}
          >
            <Text style={styles.captionText}>{storyCaption}</Text>
          </LinearGradient>
        )}

        <View style={[styles.badge, styles.badgeZ]}>
          <Text style={styles.badgeText}>
            {isVideo
              ? t('storyViewer.videoStoryBadge')
              : t('storyViewer.photoStoryBadge')}
          </Text>
        </View>

        <View style={styles.uiLayer} pointerEvents="box-none">
          <View style={[styles.progressBarContainer, { top: insets.top + 6 }]}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.userPressable}
                onPress={handleOpenStoryUserProfile}
                disabled={!storyUserId}
              >
                <HexAvatar uri={storyAvatar} size={44} borderWidth={2} borderColor="#fff" />
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {storyUsername}
                  </Text>
                  <Text style={styles.timeAgo}>
                    {formatTimeAgo(story.createdAt || new Date(), t)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={togglePause}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Play story' : 'Pause story'}
            >
              <Icon name={isPaused ? 'play' : 'pause'} size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const formatTimeAgo = (timestamp, t) => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return t('storyViewer.timeJustNow');
    if (diffInSeconds < 3600)
      return t('storyViewer.timeMinutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400)
      return t('storyViewer.timeHoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    return t('storyViewer.timeDaysAgo', { count: Math.floor(diffInSeconds / 86400) });
  } catch (error) {
    return t('storyViewer.timeRecently');
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
    backgroundColor: '#000',
  },
  uiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: 10000,
    elevation: 10000,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10001,
    elevation: 10001,
    minHeight: 92,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  contentContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  mediaErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  mediaErrorText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  pauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  captionText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  captionZ: {
    zIndex: 30,
  },
  badgeZ: {
    zIndex: 31,
  },
  badge: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBackButton: {
    position: 'absolute',
    right: 20,
    bottom: 42,
    zIndex: 30,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBackText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default StoryViewerModal;
