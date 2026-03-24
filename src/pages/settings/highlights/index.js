import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useToast } from 'react-native-toast-notifications';

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
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `media_${index}`,
          uri: item,
          type: isVideoMedia(item) ? 'video' : 'image',
          storyId: null,
        };
      }

      const uri =
        item?.uri ||
        item?.url ||
        item?.media ||
        item?.storyUrl ||
        item?.thumbnail;

      if (!uri) {
        return null;
      }

      return {
        id: item?.id || item?._id || `media_${index}`,
        uri,
        type: item?.type || (isVideoMedia(uri) ? 'video' : 'image'),
        storyId: item?.storyId || item?.story || item?.story_id || item?.id || item?._id || null,
      };
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStories, setViewerStories] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [activeHighlight, setActiveHighlight] = useState(null);
  const [managerVisible, setManagerVisible] = useState(false);
  const [managerMode, setManagerMode] = useState('create');
  const [highlightTitle, setHighlightTitle] = useState('');
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [removingStory, setRemovingStory] = useState(false);

  const toast = useToast();
  const { bgStyle, textStyle, cardStyle, text: themeText, card } = useAppTheme();

  const fetchHighlights = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }

      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        setHighlights([]);
        return;
      }

      const [userResponse, listResponse] = await Promise.all([
        getHighlightUserId({ params: { userId } }).catch(() => null),
        getHighlightList({ params: { userId } }).catch(() => null),
      ]);

      const userHighlights = normalizeHighlightsResponse(userResponse?.data);
      const listHighlights = normalizeHighlightsResponse(listResponse?.data);
      setHighlights(mergeHighlights(userHighlights, listHighlights));
    } catch (error) {
      console.error('Error fetching highlights:', error);
      setHighlights([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  useEffect(() => {
    if (route?.params?.refreshOnFocus) {
      fetchHighlights(true);
      navigation.setParams({ refreshOnFocus: undefined });
    }
  }, [fetchHighlights, navigation, route?.params?.refreshOnFocus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHighlights(true);
  }, [fetchHighlights]);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerStories([]);
    setViewerIndex(0);
    setActiveHighlight(null);
    setLoadingDetail(false);
  }, []);

  const openCreateModal = useCallback(() => {
    setManagerMode('create');
    setHighlightTitle('');
    setManagerVisible(true);
  }, []);

  const openEditModal = useCallback(() => {
    if (!activeHighlight) {
      return;
    }

    setManagerMode('edit');
    setHighlightTitle(activeHighlight.title || '');
    setManagerVisible(true);
  }, [activeHighlight]);

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

  const currentStory = viewerStories[viewerIndex];
  const totalStories = useMemo(
    () => highlights.reduce((sum, item) => sum + (item.storyCount || 0), 0),
    [highlights],
  );

  const openArchiveForExistingHighlight = useCallback(
    highlightId => {
      navigation.navigate('ArchiveScreen', {
        selectionMode: 'highlight',
        presetHighlightId: highlightId,
        refreshTarget: 'HighlightsScreen',
      });
    },
    [navigation],
  );

  const handleCreateOrUpdateHighlight = useCallback(async () => {
    const trimmedTitle = highlightTitle.trim();
    if (!trimmedTitle) {
      showToastMessage(toast, 'danger', 'Please enter a highlight name');
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

        showToastMessage(toast, 'success', response?.data?.message || 'Highlight created');
        closeManagerModal();
        await fetchHighlights(true);

        if (createdId) {
          openArchiveForExistingHighlight(createdId);
        }
        return;
      }

      if (!activeHighlight?.id) {
        showToastMessage(toast, 'danger', 'Highlight not found');
        return;
      }

      const response = await updateHighlight({
        highlightId: activeHighlight.id,
        id: activeHighlight.id,
        title: trimmedTitle,
        name: trimmedTitle,
      });

      showToastMessage(toast, 'success', response?.data?.message || 'Highlight updated');
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
        error?.response?.data?.message || 'Failed to save highlight',
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
    toast,
  ]);

  const handleRemoveCurrentStory = useCallback(() => {
    if (!activeHighlight?.id || !currentStory) {
      return;
    }

    Alert.alert('Remove story', 'Remove this story from the highlight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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
            showToastMessage(toast, 'success', response?.data?.message || 'Story removed');

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
            console.error('Error removing highlight story:', error);
            showToastMessage(
              toast,
              'danger',
              error?.response?.data?.message || 'Failed to remove story',
            );
          } finally {
            setRemovingStory(false);
          }
        },
      },
    ]);
  }, [activeHighlight, closeViewer, currentStory, toast, viewerIndex, viewerStories]);

  const renderBubble = item => (
    <TouchableOpacity
      key={item.id}
      style={styles.bubbleItem}
      activeOpacity={0.9}
      onPress={() => openViewer(item)}
      onLongPress={() => {
        setActiveHighlight(item);
        setHighlightTitle(item.title || '');
        setManagerMode('edit');
        setManagerVisible(true);
      }}
    >
      <View style={styles.bubbleOuter}>
        <View style={styles.bubbleInner}>
          {item.coverImage ? (
            <Image source={{ uri: item.coverImage }} style={styles.bubbleImage} />
          ) : (
            <View style={styles.bubbleFallback}>
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
      return <View key={`empty_${index}`} style={[styles.previewTile, styles.previewEmpty]} />;
    }

    return (
      <View
        key={story.id || `${index}`}
        style={[
          styles.previewTile,
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
      <StatusBar barStyle="dark-content" backgroundColor={cardStyle?.backgroundColor || '#fff'} />

      <View style={[styles.header, cardStyle]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={themeText || '#202020'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>Drops Highlights</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.headerAction}>
          <Icon name="add" size={24} color={themeText || '#202020'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeText || '#202020'}
          />
        }
      >
        <View style={[styles.introCard, { backgroundColor: card || '#fff' }]}>
          <Text style={[styles.introTitle, textStyle]}>Manage your drops highlights</Text>
          <Text style={styles.introText}>
            Create highlight covers, rename them, add archived drops, open full detail, and remove
            drops when you need to clean things up.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{highlights.length}</Text>
              <Text style={styles.statLabel}>Highlights</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{totalStories}</Text>
              <Text style={styles.statLabel}>Drops</Text>
            </View>
            <TouchableOpacity activeOpacity={0.9} style={styles.managePill} onPress={openCreateModal}>
              <Icon name="add-circle-outline" size={16} color="#fff" />
              <Text style={styles.managePillText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bubblesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity activeOpacity={0.9} style={styles.bubbleItem} onPress={openCreateModal}>
              <View style={styles.newBubbleOuter}>
                <View style={styles.newBubbleInner}>
                  <Icon name="add" size={30} color="#262626" />
                </View>
              </View>
              <Text style={[styles.bubbleLabel, textStyle]} numberOfLines={1}>
                New
              </Text>
            </TouchableOpacity>

            {highlights.map(renderBubble)}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, textStyle]}>Your highlight parts</Text>
          <Text style={styles.sectionMeta}>
            {highlights.length ? `${highlights.length} saved groups` : 'No groups yet'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={themeText || '#202020'} />
            <Text style={[styles.loadingText, textStyle]}>Loading highlights...</Text>
          </View>
        ) : highlights.length ? (
          highlights.map(item => {
            const previewStories = item.stories.slice(0, 3);

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.92}
                style={[styles.collectionCard, { backgroundColor: card || '#fff' }]}
                onPress={() => openViewer(item)}
                onLongPress={() => {
                  setActiveHighlight(item);
                  setHighlightTitle(item.title || '');
                  setManagerMode('edit');
                  setManagerVisible(true);
                }}
              >
                <View style={styles.collectionTopRow}>
                  <View style={styles.collectionIdentity}>
                    <View style={styles.collectionAvatarOuter}>
                      <View style={styles.collectionAvatarInner}>
                        {item.coverImage ? (
                          <Image source={{ uri: item.coverImage }} style={styles.collectionAvatarImage} />
                        ) : (
                          <View style={styles.bubbleFallback}>
                            <Icon name="images-outline" size={20} color="#fff" />
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.collectionTextWrap}>
                      <Text style={[styles.collectionTitle, textStyle]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.collectionMeta}>
                        {item.storyCount} drop{item.storyCount === 1 ? '' : 's'} saved in this highlight
                      </Text>
                    </View>
                  </View>

                  <View style={styles.collectionActions}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.collectionAddButton}
                      onPress={() => openArchiveForExistingHighlight(item.id)}
                    >
                      <Icon name="add" size={14} color="#262626" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.watchButton}
                      onPress={() => openViewer(item)}
                    >
                      <Icon name="play" size={14} color="#fff" />
                      <Text style={styles.watchButtonText}>Watch</Text>
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
          <View style={[styles.emptyCard, { backgroundColor: card || '#fff' }]}>
            <View style={styles.emptyCircle}>
              <Icon name="add" size={28} color="#262626" />
            </View>
            <Text style={[styles.emptyTitle, textStyle]}>Create your first highlight</Text>
            <Text style={styles.emptyText}>
              Create a highlight name first, then select archived drops and save them into different
              highlight parts.
            </Text>
            <TouchableOpacity activeOpacity={0.9} style={styles.emptyButton} onPress={openCreateModal}>
              <Text style={styles.emptyButtonText}>Create Highlight</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={viewerVisible} transparent={false} animationType="fade" onRequestClose={closeViewer}>
        <View style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity onPress={closeViewer} style={styles.viewerBackButton}>
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.viewerTitleWrap}>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {activeHighlight?.title || 'Highlight'}
              </Text>
              <Text style={styles.viewerSubtitle}>
                {viewerStories.length ? `${viewerIndex + 1} of ${viewerStories.length}` : ''}
              </Text>
            </View>
            <View style={styles.viewerHeaderActions}>
              <TouchableOpacity
                onPress={() => activeHighlight?.id && openArchiveForExistingHighlight(activeHighlight.id)}
                style={styles.viewerAddButton}
              >
                <Icon name="add" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={openEditModal} style={styles.viewerAddButton}>
                <Icon name="create-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {loadingDetail && !currentStory ? (
            <View style={styles.viewerLoading}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : !currentStory ? (
            <View style={styles.viewerLoading}>
              <Text style={styles.viewerEmptyText}>No drops available in this highlight.</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.viewerMedia} activeOpacity={1} onPress={nextStory}>
              {currentStory?.type === 'video' ? (
                <Video
                  source={{ uri: currentStory?.uri }}
                  style={styles.fullMedia}
                  resizeMode="contain"
                  repeat
                />
              ) : (
                <Image
                  source={{ uri: currentStory?.uri }}
                  style={styles.fullMedia}
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>
          )}

          {currentStory ? (
            <View style={styles.viewerFooter}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.viewerFooterButton, removingStory && styles.viewerFooterButtonDisabled]}
                onPress={handleRemoveCurrentStory}
                disabled={removingStory}
              >
                {removingStory ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.viewerFooterButtonText}>Remove Drop</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={managerVisible} transparent animationType="fade" onRequestClose={closeManagerModal}>
        <View style={styles.managerOverlay}>
          <View style={[styles.managerCard, { backgroundColor: card || '#fff' }]}>
            <Text style={[styles.managerTitle, textStyle]}>
              {managerMode === 'create' ? 'Create Drops Highlight' : 'Edit Drops Highlight'}
            </Text>
            <Text style={styles.managerSubtitle}>
              {managerMode === 'create'
                ? 'Give your highlight a name, then add archived drops into it.'
                : 'Update the highlight name for this saved group.'}
            </Text>

            <TextInput
              value={highlightTitle}
              onChangeText={setHighlightTitle}
              placeholder="Highlight name"
              placeholderTextColor="#9ca3af"
              style={[styles.managerInput, { color: themeText || '#202020' }]}
              maxLength={40}
            />

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.managerPrimaryButton, savingHighlight && styles.managerPrimaryButtonDisabled]}
              onPress={handleCreateOrUpdateHighlight}
              disabled={savingHighlight}
            >
              {savingHighlight ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.managerPrimaryText}>
                  {managerMode === 'create' ? 'Create and Add Stories' : 'Save Changes'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} style={styles.managerSecondaryButton} onPress={closeManagerModal}>
              <Text style={styles.managerSecondaryText}>Cancel</Text>
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#e6e6e6',
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
    color: '#202020',
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
    color: '#202020',
  },
  introText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  statPill: {
    minWidth: 74,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202020',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
  },
  managePill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
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
    borderColor: '#d1d5db',
    padding: 3,
    backgroundColor: '#fff',
  },
  bubbleInner: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: '#d1d5db',
  },
  bubbleImage: {
    width: '100%',
    height: '100%',
  },
  bubbleFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#64748b',
  },
  newBubbleOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9ca3af',
    padding: 3,
  },
  newBubbleInner: {
    flex: 1,
    borderRadius: 34,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#202020',
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
    color: '#202020',
  },
  sectionMeta: {
    fontSize: 12,
    color: '#6b7280',
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
    borderColor: '#d1d5db',
    padding: 2,
    backgroundColor: '#fff',
  },
  collectionAvatarInner: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#d1d5db',
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
    color: '#202020',
  },
  collectionMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
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
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
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
    backgroundColor: '#e5e7eb',
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
  previewEmpty: {
    backgroundColor: '#f3f4f6',
  },
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#202020',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: '#6b7280',
  },
  emptyButton: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: '#262626',
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
    color: '#202020',
  },
  managerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#6b7280',
  },
  managerInput: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: '#f9fafb',
  },
  managerPrimaryButton: {
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
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
    backgroundColor: '#f3f4f6',
  },
  managerSecondaryText: {
    color: '#202020',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default HighlightsScreen;
