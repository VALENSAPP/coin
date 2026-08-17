import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useToast } from 'react-native-toast-notifications';
import { sendMessage as sendChatMessage } from '../../../services/chatMessage';
import ShareModal from '../../../components/modals/ShareModal';

import { showToastMessage } from '../../../components/displaytoastmessage';
import {
  createHighlight,
  getHighlight,
  getHighlightList,
  getHighlightUserId,
  removeHighlight,
  updateHighlight,
} from '../../../services/highlightStory';
import { useAppTheme } from '../../../theme/useApptheme';
import { useBusinessProfileTheme } from '../../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../../theme/ThemeContext';
import { useLanguage } from '../../../i18n';

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(201,161,90,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const HIGHLIGHT_QUICK_REACTIONS = ['\u{1F602}', '\u{1F60D}', '\u{1F525}', '\u{1F44F}', '\u{1F44D}', '\u{1F64C}'];

const isVideoMedia = value => {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const normalized = value.toLowerCase().trim();
  return (
    normalized.endsWith('.mp4') ||
    normalized.endsWith('.mov') ||
    normalized.endsWith('.avi') ||
    normalized.endsWith('.mkv') ||
    normalized.endsWith('.webm') ||
    normalized.endsWith('.m4v') ||
    normalized.includes('/video/') ||
    normalized.includes('video')
  );
};

const normalizeHighlightMedia = media => {
  if (!Array.isArray(media)) {
    return [];
  }

  return media
    .flatMap((item, index) => {
      if (typeof item === 'string') {
      return [{
        id: `media_${index}`,
        uri: item,
        type: isVideoMedia(item) ? 'video' : 'image',
        storyId: null,
        ownerId: null,
        }];
      }

      const nestedStoryMedia = Array.isArray(item?.story?.media)
        ? item.story.media
        : Array.isArray(item?.media)
          ? item.media
          : [];

      if (nestedStoryMedia.length) {
        return nestedStoryMedia
          .filter(value => typeof value === 'string' && value.trim())
          .map((uri, mediaIndex) => ({
            id: item?.id || item?._id || `${item?.story?.id || item?.storyId || 'media'}_${index}_${mediaIndex}`,
            uri,
            type: isVideoMedia(uri) ? 'video' : 'image',
            storyId:
              item?.storyId ||
              item?.story?.id ||
              item?.story?._id ||
              item?.story_id ||
              item?.id ||
              item?._id ||
              null,
            ownerId: item?.userId || item?.ownerId || item?.user?.id || item?.story?.userId || item?.story?.user?.id || null,
          }));
      }

      const uri = [
        item?.uri,
        item?.url,
        item?.storyUrl,
        item?.thumbnail,
        typeof item?.media === 'string' ? item.media : null,
        typeof item?.story === 'string' ? item.story : null,
      ].find(value => typeof value === 'string' && value.trim());

      if (!uri) {
        return [];
      }

      return [{
        id: item?.id || item?._id || `media_${index}`,
        uri,
        type: item?.type || (isVideoMedia(uri) ? 'video' : 'image'),
        storyId:
          item?.storyId ||
          item?.story?.id ||
          item?.story?._id ||
          item?.story_id ||
          item?.id ||
          item?._id ||
          null,
        ownerId: item?.userId || item?.ownerId || item?.user?.id || item?.story?.userId || item?.story?.user?.id || null,
      }];
    })
    .filter(Boolean);
};

const normalizeHighlightItem = (item, index = 0) => {
  const stories = normalizeHighlightMedia(
    item?.stories ||
    item?.storyList ||
    item?.media ||
    item?.items ||
    item?.storyHighlights,
  );

  return {
    id: item?.id || item?._id || `highlight_${index}`,
    title: item?.title || item?.name || `Highlight ${index + 1}`,
    coverImage:
      item?.coverImage ||
      item?.thumbnail ||
      item?.image ||
      stories[0]?.uri ||
      null,
    stories,
    storyCount: stories.length,
    ownerId: item?.userId || item?.ownerId || item?.user?.id || item?.createdBy || null,
  };
};

const normalizeHighlightsResponse = rawData => {
  const list = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.data)
      ? rawData.data
      : Array.isArray(rawData?.highlights)
        ? rawData.highlights
        : rawData
          ? [rawData]
          : [];

  return list
    .map((item, index) => normalizeHighlightItem(item, index))
    .filter(item => item.id);
};

const mergeHighlights = (...collections) => {
  const merged = new Map();

  collections.flat().forEach(item => {
    if (!item?.id) {
      return;
    }

    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      return;
    }

    merged.set(item.id, {
      ...existing,
      ...item,
      title: item.title || existing.title,
      coverImage: item.coverImage || existing.coverImage,
      stories: item.stories?.length ? item.stories : existing.stories,
      storyCount: item.storyCount ?? existing.storyCount,
    });
  });

  return Array.from(merged.values());
};

const HighlightsScreen = ({ navigation, route }) => {
  const routeUserId = route?.params?.userId;
  const readOnly = Boolean(route?.params?.readOnly);
  const profileType = route?.params?.profileType;
  const screenTitle = route?.params?.title;
  const initialHighlights = useMemo(
    () => normalizeHighlightsResponse(route?.params?.preloadedHighlights || route?.params?.highlights),
    [route?.params?.highlights, route?.params?.preloadedHighlights],
  );
  const [loading, setLoading] = useState(initialHighlights.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [highlights, setHighlights] = useState(initialHighlights);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStories, setViewerStories] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [selectedShareStory, setSelectedShareStory] = useState(null);
  const shareRef = React.useRef(null);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [managerVisible, setManagerVisible] = useState(false);
  const [managerMode, setManagerMode] = useState('create');
  const [highlightTitle, setHighlightTitle] = useState('');
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [removingStory, setRemovingStory] = useState(false);

  const toast = useToast();
  const ownTheme = useBusinessProfileTheme();
  const visitorTheme = useAppTheme(
    String(profileType || '').toLowerCase() === 'company' ? 'company' : undefined,
  );
  const {
    bgStyle,
    textStyle,
    cardStyle,
    text,
    accent,
    card,
    border,
    mutedText,
    mutedTextStyle,
    icon,
  } = readOnly ? visitorTheme : ownTheme;
  const { isDarkMode } = useThemeContext();
  const surface = isDarkMode ? withAlpha(accent, 0.14) : '#f3f4f6';
  const { t } = useLanguage();

  const fetchHighlights = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }

      const userId = routeUserId || await AsyncStorage.getItem('userId');
      if (!userId) {
        setHighlights([]);
        return;
      }

      if (readOnly) {
        const userResponse = await getHighlightUserId({ params: { userId } }).catch(() => null);
        const userHighlights = normalizeHighlightsResponse(userResponse?.data);
        setHighlights(userHighlights);
        Promise.allSettled(
          userHighlights.map(async hl => {
            const res = await getHighlight({ highlightId: hl.id });
            console.log(res,'getHighlightgetHighlightgetHighlightgetHighlightgetHighlight')
            const detail = normalizeHighlightsResponse(res?.data)[0];
            return detail ? { ...hl, ...detail } : hl;
          }),
        ).then(results => {
          const hydrated = results
            .map(result => (result.status === 'fulfilled' ? result.value : null))
            .filter(Boolean);
          if (hydrated.length) {
            setHighlights(prev => {
              const merged = new Map(prev.map(item => [item.id, item]));
              hydrated.forEach(item => merged.set(item.id, { ...merged.get(item.id), ...item }));
              return Array.from(merged.values());
            });
          }
        });
        setLoading(false);
        return;
      }

      const [userResponse, listResponse] = await Promise.all([
        getHighlightUserId({ params: { userId } }).catch(() => null),
        getHighlightList({ params: { userId } }).catch(() => null),
      ]);

      const userHighlights = normalizeHighlightsResponse(userResponse?.data);
      const listHighlights = normalizeHighlightsResponse(listResponse?.data);
      const merged = mergeHighlights(userHighlights, listHighlights);

      // Fetch details immediately so stories and storyCount are visible
      const detailedHighlights = await Promise.all(
        merged.map(async (hl) => {
          try {
            const res = await getHighlight({ highlightId: hl.id });
            const detail = normalizeHighlightsResponse(res?.data)[0];
            return detail ? { ...hl, ...detail } : hl;
          } catch (e) {
            return hl;
          }
        })
      );

      setHighlights(detailedHighlights);
    } catch (error) {
      console.error('Error fetching highlights:', error);
      setHighlights([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [readOnly, routeUserId]);

  const hasLoadedRef = useRef(false);

  // Refetch every time the screen regains focus (e.g. returning from the
  // Archive screen after adding a Drop to a highlight). The first focus shows
  // the loading state; subsequent focuses refresh silently in the background.
  useFocusEffect(
    useCallback(() => {
      fetchHighlights(hasLoadedRef.current);
      hasLoadedRef.current = true;

      if (route?.params?.refreshOnFocus) {
        navigation.setParams({ refreshOnFocus: undefined });
      }
    }, [fetchHighlights, navigation, route?.params?.refreshOnFocus]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHighlights(true);
  }, [fetchHighlights]);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerStories([]);
    setViewerIndex(0);
    setReplyText('');
    setReplySending(false);
    setActiveHighlight(null);
    setLoadingDetail(false);
  }, []);

  const openCreateModal = useCallback(() => {
    if (readOnly) return;
    setManagerMode('create');
    setHighlightTitle('');
    setManagerVisible(true);
  }, [readOnly]);

  const openEditModal = useCallback(() => {
    if (!activeHighlight || readOnly) return;
    const currentActive = activeHighlight;
    closeViewer();
    setTimeout(() => {
      setManagerMode('edit');
      setHighlightTitle(currentActive.title || '');
      setManagerVisible(true);
    }, 150);
  }, [activeHighlight, readOnly, closeViewer]);

  const closeManagerModal = useCallback(() => {
    setManagerVisible(false);
    setHighlightTitle('');
    setSavingHighlight(false);
  }, []);

  const openViewer = useCallback(async highlight => {
    setActiveHighlight(highlight);
    setViewerStories(highlight?.stories || []);
    setViewerIndex(0);
    setViewerVisible(true);
    setLoadingDetail(true);

    try {
      try {
        const id = await AsyncStorage.getItem('userId');
        setCurrentUserId(id ? String(id) : null);
      } catch (_e) {}
      const response = await getHighlight({ highlightId: highlight.id });
      const detail = normalizeHighlightsResponse(response?.data)[0];
      if (detail?.stories?.length) {
        setActiveHighlight(detail);
        setViewerStories(detail.stories || []);
        setViewerIndex(0);
        setHighlights(prev =>
          prev.map(item => (item.id === detail.id ? { ...item, ...detail } : item)),
        );
      }
    } catch (error) {
      console.error('Error fetching highlight detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const nextStory = useCallback(() => {
    setViewerIndex(current => {
      if (current < viewerStories.length - 1) {
        return current + 1;
      }
      closeViewer();
      return current;
    });
  }, [closeViewer, viewerStories.length]);

  const prevStory = useCallback(() => {
    setViewerIndex(current => {
      if (current > 0) return current - 1;
      closeViewer();
      return current;
    });
  }, [closeViewer]);

  const currentStory = viewerStories[viewerIndex];
  const highlightOwnerId = currentStory?.ownerId || activeHighlight?.ownerId || routeUserId;
  const canReplyToHighlight = Boolean(
    currentStory &&
    highlightOwnerId &&
    currentUserId &&
    String(highlightOwnerId) !== String(currentUserId),
  );
  const totalStories = useMemo(
    () => highlights.reduce((sum, item) => sum + (item.storyCount || 0), 0),
    [highlights],
  );

  const openArchiveForExistingHighlight = useCallback(
    highlightId => {
      closeViewer();
      setTimeout(() => {
        navigation.navigate('ArchiveScreen', {
          selectionMode: 'highlight',
          presetHighlightId: highlightId,
          refreshTarget: 'HighlightsScreen',
        });
      }, 150);
    },
    [navigation, closeViewer],
  );

  const handleCreateOrUpdateHighlight = useCallback(async () => {
    const trimmedTitle = highlightTitle.trim();
    if (!trimmedTitle) {
      showToastMessage(toast, 'danger', t('highlights.nameRequired'));
      return;
    }

    try {
      setSavingHighlight(true);

      if (managerMode === 'create') {
        const response = await createHighlight({
          title: trimmedTitle,
          name: trimmedTitle,
        });

        const createdId =
          response?.data?.data?.id ||
          response?.data?.data?._id ||
          response?.data?.id ||
          response?.data?._id;

        showToastMessage(toast, 'success', response?.data?.message || t('highlights.created'));
        closeManagerModal();
        await fetchHighlights(true);

        if (createdId) {
          openArchiveForExistingHighlight(createdId);
        }
        return;
      }

      if (!activeHighlight?.id) {
        showToastMessage(toast, 'danger', t('highlights.notFound'));
        return;
      }

      const response = await updateHighlight({
        highlightId: activeHighlight.id,
        id: activeHighlight.id,
        title: trimmedTitle,
        name: trimmedTitle,
      });

      showToastMessage(toast, 'success', response?.data?.message || t('highlights.updated'));
      closeManagerModal();

      setActiveHighlight(prev => (prev ? { ...prev, title: trimmedTitle } : prev));
      setHighlights(prev =>
        prev.map(item =>
          item.id === activeHighlight.id ? { ...item, title: trimmedTitle } : item,
        ),
      );
    } catch (error) {
      console.error('Error saving highlight:', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || t('highlights.saveFailed'),
      );
    } finally {
      setSavingHighlight(false);
    }
  }, [
    activeHighlight,
    closeManagerModal,
    fetchHighlights,
    highlightTitle,
    managerMode,
    openArchiveForExistingHighlight,
    t,
    toast,
  ]);

  const handleRemoveCurrentStory = useCallback(() => {
    if (!activeHighlight?.id || !currentStory) return;

    Alert.alert(t('highlights.removeDropAlert'), t('highlights.removeDropMessage'), [
      { text: t('highlights.cancel'), style: 'cancel' },
      {
        text: t('highlights.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            setRemovingStory(true);

            const payload = {
              highlightId: activeHighlight.id,
              id: activeHighlight.id,
              storyId: currentStory.storyId || currentStory.id,
              story: currentStory.storyId || currentStory.id,
              storyUrl: currentStory.uri,
              media: currentStory.uri,
            };

            const response = await removeHighlight(payload);
            showToastMessage(toast, 'success', response?.data?.message || t('highlights.dropRemoved'));

            const nextStories = viewerStories.filter((_, index) => index !== viewerIndex);
            const nextHighlight = {
              ...activeHighlight,
              stories: nextStories,
              storyCount: nextStories.length,
              coverImage: nextStories[0]?.uri || activeHighlight.coverImage,
            };

            if (!nextStories.length) {
              closeViewer();
            } else {
              setActiveHighlight(nextHighlight);
              setViewerStories(nextStories);
              setViewerIndex(current => Math.max(0, Math.min(current, nextStories.length - 1)));
            }

            setHighlights(prev =>
              prev
                .map(item =>
                  item.id === activeHighlight.id ? nextHighlight : item,
                )
                .filter(item => (item.storyCount || 0) > 0),
            );
          } catch (error) {
            console.error('Error removing highlight Drops:', error);
            showToastMessage(
              toast,
              'danger',
              error?.response?.data?.message || t('highlights.removeDropFailed'),
            );
          } finally {
            setRemovingStory(false);
          }
        },
      },
    ]);
  }, [activeHighlight, closeViewer, currentStory, t, toast, viewerIndex, viewerStories]);

  const onToggleLike = useCallback((ownerId, storyId, nextLiked) => {
    // Highlights use archived Drops. The live-story endpoint rejects them with
    // "Story not found", so this is intentionally a local viewer reaction.
    const key = `${ownerId}:${storyId}`;
    setLikes(prev => {
      const curr = prev[key] || { liked: false, count: 0 };
      let count = curr.count || 0;
      if (nextLiked && !curr.liked) count += 1;
      if (!nextLiked && curr.liked && count > 0) count -= 1;
      return { ...prev, [key]: { liked: nextLiked, count } };
    });
  }, []);

  const onAddComment = useCallback(async (ownerId, storyId, text) => {
    const cleanText = String(text || '').trim();
    if (!cleanText) return false;
    try {
      if (!ownerId || !currentUserId || String(ownerId) === String(currentUserId)) return false;
      await sendChatMessage({ senderId: currentUserId, receiverId: ownerId, message: cleanText, type: 'CHAT' });
      const key = `${ownerId}:${storyId}`;
      setComments(prev => ({ ...prev, [key]: [...(prev[key] || []), { user: 'you', text: cleanText, ts: Date.now() }] }));
      return true;
    } catch (_e) {
      showToastMessage(toast, 'danger', 'Could not send your reply.');
    }
    return false;
  }, [currentUserId, toast]);

  const sendHighlightReply = useCallback(async (message) => {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage || !currentStory?.storyId || !highlightOwnerId || replySending) return;

    setReplySending(true);
    try {
      const sent = await onAddComment(highlightOwnerId, currentStory.storyId, cleanMessage);
                  console.log(sent,'sentsentsentsentsenth')

      if (sent) setReplyText('');
    } finally {
      setReplySending(false);
    }
  }, [currentStory?.storyId, highlightOwnerId, onAddComment, replySending]);

  const renderBubble = item => (
    <TouchableOpacity
      key={item.id}
      style={styles.bubbleItem}
      activeOpacity={0.9}
      onPress={() => openViewer(item)}
      onLongPress={
        readOnly
          ? undefined
          : () => {
            setActiveHighlight(item);
            setHighlightTitle(item.title || '');
            setManagerMode('edit');
            setManagerVisible(true);
          }
      }
    >
      <View style={[styles.bubbleOuter, { borderColor: border, backgroundColor: card }]}>
        <View style={[styles.bubbleInner, { backgroundColor: border }]}>
          {item.coverImage ? (
            <Image source={{ uri: item.coverImage }} style={styles.bubbleImage} />
          ) : (
            <View style={[styles.bubbleFallback, { backgroundColor: accent }]}>
              <Icon name="images-outline" size={22} color="#fff" />
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.bubbleLabel, textStyle]} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  const renderPreviewThumb = (story, index, total) => {
    if (!story) {
      return <View key={`empty_${index}`} style={[styles.previewTile, styles.previewEmpty, { backgroundColor: surface }]} />;
    }

    return (
      <View
        key={story.id || `${index}`}
        style={[
          styles.previewTile,
          { backgroundColor: border },
          total === 1 && styles.previewTileFull,
          total === 2 && index === 0 && styles.previewTileTall,
          total === 2 && index === 1 && styles.previewTileTall,
        ]}
      >
        {story.type === 'video' ? (
          <View style={styles.videoThumb}>
            <Icon name="play" size={18} color="#fff" />
          </View>
        ) : (
          <Image source={{ uri: story.uri }} style={styles.previewImage} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={card}
      />

      <View style={[styles.header, cardStyle, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>
          {readOnly
            ? `${screenTitle || t('highlights.titleReadOnly')} ${t('highlights.titleReadOnly')}`
            : t('highlights.title')}
        </Text>
        {readOnly ? (
          <View style={styles.headerAction} />
        ) : (
          <TouchableOpacity onPress={openCreateModal} style={styles.headerAction}>
            <Icon name="add" size={24} color={icon} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
          />
        }
      >
        <View style={[styles.introCard, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[styles.introTitle, textStyle]}>
            {readOnly
              ? `${screenTitle || t('highlights.titleReadOnly')} ${t('highlights.manageSubtitleReadOnly')}`
              : t('highlights.manageTitle')}
          </Text>
          <Text style={[styles.introText, mutedTextStyle]}>
            {readOnly ? t('highlights.readOnlyDesc') : t('highlights.manageDesc')}
          </Text>

          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: surface }]}>
              <Text style={[styles.statValue, textStyle]}>{highlights.length}</Text>
              <Text style={[styles.statLabel, mutedTextStyle]}>{t('highlights.statHighlights')}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: surface }]}>
              <Text style={[styles.statValue, textStyle]}>{totalStories}</Text>
              <Text style={[styles.statLabel, mutedTextStyle]}>{t('highlights.statDrops')}</Text>
            </View>
            {!readOnly ? (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.managePill, { backgroundColor: accent }]}
                onPress={openCreateModal}
              >
                <Icon name="add-circle-outline" size={16} color="#fff" />
                <Text style={styles.managePillText}>{t('highlights.create')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.bubblesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {!readOnly ? (
              <TouchableOpacity activeOpacity={0.9} style={styles.bubbleItem} onPress={openCreateModal}>
                <View style={[styles.newBubbleOuter, { borderColor: border }]}>
                  <View style={[styles.newBubbleInner, { backgroundColor: surface }]}>
                    <Icon name="add" size={30} color={accent} />
                  </View>
                </View>
                <Text style={[styles.bubbleLabel, textStyle]} numberOfLines={1}>
                  {t('highlights.new')}
                </Text>
              </TouchableOpacity>
            ) : null}
            {highlights.map(renderBubble)}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>{t('highlights.sectionTitle')}</Text>
          <Text style={[styles.sectionMeta, mutedTextStyle]}>
            {highlights.length
              ? `${highlights.length} ${t('highlights.statHighlights')}`
              : t('highlights.noGroups')}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={[styles.loadingText, textStyle]}>{t('highlights.loading')}</Text>
          </View>
        ) : highlights.length ? (
          highlights.map(item => {
            const previewStories = item.stories.slice(0, 3);

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.92}
                style={[styles.collectionCard, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}
                onPress={() => openViewer(item)}
                onLongPress={
                  readOnly
                    ? undefined
                    : () => {
                      setActiveHighlight(item);
                      setHighlightTitle(item.title || '');
                      setManagerMode('edit');
                      setManagerVisible(true);
                    }
                }
              >
                <View style={styles.collectionTopRow}>
                  <View style={styles.collectionIdentity}>
                    <View style={[styles.collectionAvatarOuter, { borderColor: border, backgroundColor: card }]}>
                      <View style={[styles.collectionAvatarInner, { backgroundColor: border }]}>
                        {item.coverImage ? (
                          <Image source={{ uri: item.coverImage }} style={styles.collectionAvatarImage} />
                        ) : (
                          <View style={[styles.bubbleFallback, { backgroundColor: accent }]}>
                            <Icon name="images-outline" size={20} color="#fff" />
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.collectionTextWrap}>
                      <Text style={[styles.collectionTitle, textStyle]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.collectionMeta, mutedTextStyle]}>
                        {item.storyCount}{' '}
                        {item.storyCount === 1
                          ? t('highlights.dropsSaved_one', { count: item.storyCount })
                          : t('highlights.dropsSaved_other', { count: item.storyCount })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.collectionActions}>
                    {!readOnly ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.collectionAddButton, { backgroundColor: surface }]}
                        onPress={() => openArchiveForExistingHighlight(item.id)}
                      >
                        <Icon name="add" size={14} color={accent} />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[styles.watchButton, { backgroundColor: accent }]}
                      onPress={() => openViewer(item)}
                    >
                      <Icon name="play" size={14} color="#fff" />
                      <Text style={styles.watchButtonText}>{t('highlights.watch')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.previewRow}>
                  {previewStories.map((story, index) =>
                    renderPreviewThumb(story, index, previewStories.length),
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={[styles.emptyCard, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.emptyCircle, { backgroundColor: surface, borderColor: border }]}>
              <Icon name="add" size={28} color={accent} />
            </View>
            <Text style={[styles.emptyTitle, textStyle]}>
              {readOnly ? t('highlights.emptyTitleReadOnly') : t('highlights.emptyTitle')}
            </Text>
            <Text style={[styles.emptyText, mutedTextStyle]}>
              {readOnly ? t('highlights.emptyDescReadOnly') : t('highlights.emptyDesc')}
            </Text>
            {!readOnly ? (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.emptyButton, { backgroundColor: accent }]}
                onPress={openCreateModal}
              >
                <Text style={styles.emptyButtonText}>{t('highlights.createButton')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Story viewer modal */}
      <Modal visible={viewerVisible} transparent={false} animationType="fade" onRequestClose={closeViewer}>
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
                <TouchableOpacity onPress={closeViewer} style={styles.viewerBackButton}>
                  <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
            <View style={styles.viewerTitleWrap}>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {activeHighlight?.title || t('highlights.titleReadOnly')}
              </Text>
              <Text style={styles.viewerSubtitle}>
                {viewerStories.length ? `${viewerIndex + 1} of ${viewerStories.length}` : ''}
              </Text>
            </View>
            <View style={styles.viewerHeaderActions}>
              {currentStory ? (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedShareStory(currentStory);
                    try { shareRef.current?.open?.(); } catch (_e) {}
                  }}
                  style={[styles.viewerAddButton, { marginRight: 8 }]}
                >
                  <Icon name="share-outline" size={18} color="#fff" />
                </TouchableOpacity>
              ) : null}
              {currentStory ? (
                <TouchableOpacity
                  onPress={() => {
                    const ownerId = activeHighlight?.id || 'highlight';
                    const sid = currentStory?.storyId || currentStory?.id;
                    const key = `${ownerId}:${sid}`;
                    const nextLiked = !(likes[key]?.liked === true);
                    onToggleLike(ownerId, sid, nextLiked);
                  }}
                  style={[styles.viewerAddButton, { marginRight: 8 }]}
                >
                  <Icon name={likes[`${activeHighlight?.id || 'highlight'}:${currentStory?.storyId || currentStory?.id}`]?.liked ? 'heart' : 'heart-outline'} size={18} color="#fff" />
                </TouchableOpacity>
              ) : null}
              {!readOnly ? (
                <>
                  <TouchableOpacity
                    onPress={() => activeHighlight?.id && openArchiveForExistingHighlight(activeHighlight.id)}
                    style={styles.viewerAddButton}
                  >
                    <Icon name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openEditModal} style={styles.viewerAddButton}>
                      <Icon name="create-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>

          {loadingDetail && !currentStory ? (
            <View style={styles.viewerLoading}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : !currentStory ? (
            <View style={styles.viewerLoading}>
              <Text style={styles.viewerEmptyText}>{t('highlights.noDropsAvailable')}</Text>
            </View>
          ) : (
            <Pressable
              style={styles.viewerMedia}
              android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
              onPress={(e) => {
                const x = e.nativeEvent.locationX || 0;
                const w = Dimensions.get('window').width || 360;
                const leftZone = w * 0.3;
                if (x < leftZone) prevStory(); else nextStory();
              }}
            >
              {currentStory?.type === 'video' ? (
                <Video
                  source={{ uri: currentStory?.uri }}
                  style={styles.fullMedia}
                  resizeMode="contain"
                  repeat
                  muted={false}
                  volume={1}
                  ignoreSilentSwitch="ignore"
                  playWhenInactive={false}
                />
              ) : (
                <Image
                  source={{ uri: currentStory?.uri }}
                  style={styles.fullMedia}
                  resizeMode="contain"
                />
              )}
            </Pressable>
          )}

          {canReplyToHighlight ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.storyReplyBar}
            >
              <View style={styles.storyReactionRow}>
                {HIGHLIGHT_QUICK_REACTIONS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.storyReactionButton}
                    activeOpacity={0.75}
                    disabled={replySending}
                    onPress={() => sendHighlightReply(emoji)}
                    accessibilityRole="button"
                    accessibilityLabel={`React ${emoji}`}
                  >
                    <Text style={styles.storyReactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.storyReplyRow}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Add a reply…"
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  style={styles.storyReplyInput}
                  returnKeyType="send"
                  editable={!replySending}
                  onSubmitEditing={() => sendHighlightReply(replyText)}
                  accessibilityLabel="Reply to this Drop"
                />
                <TouchableOpacity
                  style={[styles.storyReplySendButton, (!replyText.trim() || replySending) && styles.storyReplySendButtonDisabled]}
                  activeOpacity={0.8}
                  disabled={!replyText.trim() || replySending}
                  onPress={() => sendHighlightReply(replyText)}
                  accessibilityRole="button"
                  accessibilityLabel="Send reply"
                >
                  {replySending ? <ActivityIndicator size="small" color="#111827" /> : <Icon name="send" size={18} color="#111827" />}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : null}

          {currentStory && !readOnly ? (
            <View style={styles.viewerFooter}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[
                  styles.viewerFooterButton,
                  { backgroundColor: accent },
                  removingStory && styles.viewerFooterButtonDisabled,
                ]}
                onPress={handleRemoveCurrentStory}
                disabled={removingStory}
              >
                {removingStory ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.viewerFooterButtonText}>{t('highlights.removeDrop')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      <ShareModal
        ref={shareRef}
        story={selectedShareStory}
        onClose={() => { try { shareRef.current?.close?.(); } catch (_e) {} setSelectedShareStory(null); }}
      />

      {/* Create / Edit modal */}
      <Modal visible={managerVisible && !readOnly} transparent animationType="fade" onRequestClose={closeManagerModal}>
        <View style={styles.managerOverlay}>
          <View style={[styles.managerCard, cardStyle, { borderColor: border, borderWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.managerTitle, textStyle]}>
              {managerMode === 'create' ? t('highlights.createModalTitle') : t('highlights.editModalTitle')}
            </Text>
            <Text style={[styles.managerSubtitle, mutedTextStyle]}>
              {managerMode === 'create' ? t('highlights.createModalDesc') : t('highlights.editModalDesc')}
            </Text>

            <TextInput
              value={highlightTitle}
              onChangeText={setHighlightTitle}
              placeholder={t('highlights.highlightNamePlaceholder')}
              placeholderTextColor={mutedText}
              style={[
                styles.managerInput,
                textStyle,
                {
                  borderColor: border,
                  backgroundColor: surface,
                },
              ]}
              maxLength={40}
            />

            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.managerPrimaryButton,
                { backgroundColor: accent },
                savingHighlight && styles.managerPrimaryButtonDisabled,
              ]}
              onPress={handleCreateOrUpdateHighlight}
              disabled={savingHighlight}
            >
              {savingHighlight ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.managerPrimaryText}>
                  {managerMode === 'create' ? t('highlights.createAndAdd') : t('highlights.saveChanges')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.managerSecondaryButton, { backgroundColor: surface }]}
              onPress={closeManagerModal}
            >
              <Text style={[styles.managerSecondaryText, textStyle]}>{t('highlights.cancelModal')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  headerAction: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 32,
  },
  introCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    padding: 18,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  introText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  statPill: {
    minWidth: 74,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
  },
  managePill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  managePillText: {
    marginLeft: 6,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  bubblesSection: {
    marginTop: 18,
    paddingLeft: 16,
  },
  bubbleItem: {
    width: 82,
    marginRight: 12,
    alignItems: 'center',
  },
  bubbleOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    padding: 3,
  },
  bubbleInner: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
  },
  bubbleImage: {
    width: '100%',
    height: '100%',
  },
  bubbleFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBubbleOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 3,
  },
  newBubbleInner: {
    flex: 1,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleLabel: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionMeta: {
    fontSize: 12,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
  },
  collectionCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
  },
  collectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  collectionAvatarOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    padding: 2,
  },
  collectionAvatarInner: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  collectionAvatarImage: {
    width: '100%',
    height: '100%',
  },
  collectionTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  collectionMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  collectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collectionAddButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  watchButtonText: {
    marginLeft: 5,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  previewTile: {
    width: '31.5%',
    aspectRatio: 0.82,
    borderRadius: 14,
    overflow: 'hidden',
  },
  previewTileFull: {
    width: '100%',
  },
  previewTileTall: {
    width: '48.8%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewEmpty: {},
  videoThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  emptyCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
  },
  emptyCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 18,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  viewerBackButton: {
    paddingRight: 12,
  },
  viewerTitleWrap: {
    flex: 1,
  },
  viewerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  viewerSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  viewerHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerAddButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginLeft: 8,
  },
  viewerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerEmptyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  viewerMedia: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerFooter: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  viewerFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  viewerFooterButtonDisabled: {
    opacity: 0.7,
  },
  viewerFooterButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  fullMedia: {
    width: '100%',
    height: '100%',
  },
  storyReplyBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  storyReactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  storyReactionButton: {
    width: 42,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  storyReactionEmoji: {
    fontSize: 20,
  },
  storyReplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 5,
    minHeight: 50,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  storyReplyInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 10,
    maxHeight: 90,
  },
  storyReplySendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  storyReplySendButtonDisabled: {
    opacity: 0.45,
  },
  managerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  managerCard: {
    borderRadius: 20,
    padding: 18,
  },
  managerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  managerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
  },
  managerInput: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  managerPrimaryButton: {
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerPrimaryButtonDisabled: {
    opacity: 0.75,
  },
  managerPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  managerSecondaryButton: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default HighlightsScreen;
