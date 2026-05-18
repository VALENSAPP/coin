import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from 'react-native-toast-notifications';

import { showToastMessage } from '../../../components/displaytoastmessage';
import { addHighlight, getHighlightUserId } from '../../../services/highlightStory';
import { getStoryByUser } from '../../../services/stories';
import { useAppTheme } from '../../../theme/useApptheme';
import { useLanguage } from '../../../i18n';

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

const formatGroupDate = dateValue => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const buildDateSearchIndex = dateValue => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const shortLabel = formatGroupDate(dateValue).toLowerCase();

  return [`${yyyy}-${mm}-${dd}`, `${dd}-${mm}-${yyyy}`, shortLabel, `${dd}/${mm}/${yyyy}`].join(' ');
};

const normalizeStoriesResponse = rawStories => {
  const list = Array.isArray(rawStories)
    ? rawStories
    : rawStories
      ? [rawStories]
      : [];

  const groupedStories = new Map();

  list.forEach(story => {
    const storyDate = story?.createdAt || story?.updatedAt || Date.now();
    const parsedDate = new Date(storyDate);
    const dateKey = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : parsedDate.toISOString().slice(0, 10);
    const mediaItems = Array.isArray(story?.media) ? story.media : [];

    const transformedMedia = mediaItems
      .filter(Boolean)
      .map((uri, index) => ({
        id: `${story?.id || story?._id || dateKey}_${index}`,
        storyId: story?.id || story?._id || null,
        storyIndex: index,
        type: isVideoMedia(uri) ? 'video' : 'image',
        uri: String(uri).trim(),
        createdAt: storyDate,
        caption: story?.caption || story?.text || '',
      }));

    if (!transformedMedia.length) {
      return;
    }

    const existingGroup = groupedStories.get(dateKey) || [];
    groupedStories.set(dateKey, [...existingGroup, ...transformedMedia]);
  });

  return Array.from(groupedStories.entries())
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .map(([date, stories]) => ({
      date,
      dateLabel: formatGroupDate(date),
      searchIndex: buildDateSearchIndex(date),
      stories,
    }));
};

const normalizeHighlightOptions = rawData => {
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
    .map((item, index) => ({
      id: item?.id || item?._id || `highlight_${index}`,
      title: item?.title || item?.name || `Highlight ${index + 1}`,
      coverImage: item?.coverImage || item?.thumbnail || item?.image || null,
    }))
    .filter(item => item.id);
};

const ArchiveScreen = ({ navigation, route }) => {
  const [archiveGroups, setArchiveGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [viewerVisible, setViewerVisible] = useState(false);
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [highlightOptions, setHighlightOptions] = useState([]);
  const [highlightPickerVisible, setHighlightPickerVisible] = useState(false);
  const [selectedStoryForHighlight, setSelectedStoryForHighlight] = useState(null);
  const [submittingHighlightId, setSubmittingHighlightId] = useState(null);
  const [manualHighlightMode, setManualHighlightMode] = useState(
    route?.params?.selectionMode === 'highlight',
  );

  const toast = useToast();
  const { bgStyle, textStyle, cardStyle, text: themeText } = useAppTheme();
  const { t } = useLanguage();

  const isHighlightRouteMode = route?.params?.selectionMode === 'highlight';
  const isHighlightSelectionMode = isHighlightRouteMode || manualHighlightMode;
  const presetHighlightId = route?.params?.presetHighlightId;
  const refreshTarget = route?.params?.refreshTarget;

  const fetchArchiveStories = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }

      const userId = await AsyncStorage.getItem('userId');

      if (!userId) {
        setArchiveGroups([]);
        return;
      }

      const response = await getStoryByUser(userId, { time: 'all' });
      const groupedData = normalizeStoriesResponse(response?.data);
      setArchiveGroups(groupedData);
    } catch (error) {
      console.error('Error fetching archive stories:', error);
      setArchiveGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchHighlightOptions = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');

      if (!userId) {
        setHighlightOptions([]);
        return;
      }

      const response = await getHighlightUserId({ params: { userId } });
      setHighlightOptions(normalizeHighlightOptions(response?.data));
    } catch (error) {
      console.error('Error fetching highlight options:', error);
      setHighlightOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchArchiveStories();
  }, [fetchArchiveStories]);

  useEffect(() => {
    if (isHighlightSelectionMode) {
      fetchHighlightOptions();
    }
  }, [fetchHighlightOptions, isHighlightSelectionMode]);

  const toggleHighlightMode = useCallback(() => {
    if (isHighlightRouteMode) {
      navigation.goBack();
      return;
    }
    setManualHighlightMode(prev => !prev);
  }, [isHighlightRouteMode, navigation]);

  const filteredArchiveGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return archiveGroups;
    }
    return archiveGroups.filter(group => group.searchIndex.includes(query));
  }, [archiveGroups, searchText]);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    setStories([]);
    setCurrentIndex(0);
  }, []);

  const nextStory = useCallback(() => {
    setCurrentIndex(prevIndex => {
      if (prevIndex < stories.length - 1) {
        return prevIndex + 1;
      }
      closeViewer();
      return prevIndex;
    });
  }, [closeViewer, stories.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchArchiveStories(true);
    if (isHighlightSelectionMode) {
      fetchHighlightOptions();
    }
  }, [fetchArchiveStories, fetchHighlightOptions, isHighlightSelectionMode]);

  const closeHighlightPicker = useCallback(() => {
    setHighlightPickerVisible(false);
    setSelectedStoryForHighlight(null);
    setSubmittingHighlightId(null);
  }, []);

  const handleAddStoryToHighlight = useCallback(async (highlightId, storyOverride = null) => {
    const targetStory = storyOverride || selectedStoryForHighlight;

    if (!targetStory) {
      return;
    }

    if (!targetStory.storyId) {
      Alert.alert(t('archive.dropUnavailable'), t('archive.dropUnavailableMsg'));
      return;
    }

    try {
      setSubmittingHighlightId(highlightId);

      const payload = {
        highlightId,
        storyId: targetStory.storyId,
        story: targetStory.storyId,
        media: targetStory.uri,
        storyUrl: targetStory.uri,
        storyIndex: targetStory.storyIndex,
      };

      const response = await addHighlight(payload);
      const success = response?.success || response?.data?.success;

      if (success) {
        showToastMessage(toast, 'success', response?.data?.message || t('archive.dropAdded'));
        closeHighlightPicker();
        if (refreshTarget) {
          navigation.navigate(refreshTarget, { refreshOnFocus: true });
          return;
        }
        if (isHighlightRouteMode) {
          navigation.goBack();
        } else {
          setManualHighlightMode(false);
        }
        return;
      }

      showToastMessage(toast, 'danger', t('archive.alreadyAdded'));
    } catch (error) {
      console.error('Error adding Drops to highlight:', error);
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || t('archive.addFailed'),
      );
    } finally {
      setSubmittingHighlightId(null);
    }
  }, [closeHighlightPicker, isHighlightRouteMode, navigation, refreshTarget, selectedStoryForHighlight, t, toast]);

  const handleStoryPress = useCallback((storiesArray, index, item) => {
    if (isHighlightSelectionMode) {
      if (presetHighlightId) {
        setSelectedStoryForHighlight(item);
        handleAddStoryToHighlight(presetHighlightId, item);
        return;
      }
      setSelectedStoryForHighlight(item);
      setHighlightPickerVisible(true);
      return;
    }
    setStories(storiesArray);
    setCurrentIndex(index);
    setViewerVisible(true);
  }, [handleAddStoryToHighlight, isHighlightSelectionMode, presetHighlightId]);

  const renderStoryItem = useCallback(
    ({ item, index, storiesArray }) => (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.85}
        onPress={() => handleStoryPress(storiesArray, index, item)}
        style={styles.storyItem}
      >
        {item.type === 'video' ? (
          <View style={styles.videoPreview}>
            <Icon name="play-circle" size={28} color="#fff" />
            <Text style={styles.videoPreviewText}>{t('archive.videoDrop')}</Text>
          </View>
        ) : (
          <Image source={{ uri: item.uri }} style={styles.storyImage} />
        )}
        {item.type === 'video' ? (
          <View style={styles.videoBadge}>
            <Icon name="play" size={12} color="#fff" />
          </View>
        ) : null}
        {isHighlightSelectionMode ? (
          <View style={styles.highlightSelectBadge}>
            <Icon name="add-circle" size={20} color="#fff" />
          </View>
        ) : null}
      </TouchableOpacity>
    ),
    [handleStoryPress, isHighlightSelectionMode, t]
  );

  const renderDateGroup = useCallback(
    ({ item }) => (
      <View style={styles.section}>
        <Text style={[styles.dateText, textStyle]}>{item.dateLabel}</Text>
        <View style={styles.grid}>
          {item.stories.map((story, index) =>
            renderStoryItem({ item: story, index, storiesArray: item.stories })
          )}
        </View>
      </View>
    ),
    [renderStoryItem, textStyle]
  );

  const currentStory = stories[currentIndex];
  const hasArchiveStories = filteredArchiveGroups.length > 0;
  const isSearching = searchText.trim().length > 0;

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={cardStyle?.backgroundColor || '#fff'} />

      <View style={[styles.header, cardStyle]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={themeText || '#262626'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>
          {isHighlightSelectionMode ? t('archive.selectDropTitle') : t('archive.title')}
        </Text>
        <TouchableOpacity onPress={toggleHighlightMode} style={styles.headerActionButton}>
          <Text style={[styles.headerActionText, { color: themeText || '#262626' }]}>
            {isHighlightSelectionMode ? t('archive.done') : t('archive.select')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchWrapper, cardStyle]}>
        {isHighlightSelectionMode ? (
          <View style={styles.selectionBanner}>
            <View style={styles.selectionBannerIcon}>
              <Icon name="albums-outline" size={16} color="#fff" />
            </View>
            <View style={styles.selectionBannerTextWrap}>
              <Text style={styles.selectionBannerTitle}>{t('archive.addDropToHighlight')}</Text>
              <Text style={styles.selectionBannerText}>{t('archive.addDropHint')}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={18} color="#8e8e93" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t('archive.searchPlaceholder')}
            placeholderTextColor="#8e8e93"
            style={[styles.searchInput, { color: themeText || '#262626' }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={18} color="#8e8e93" />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.searchHint}>{t('archive.searchHint')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeText || '#262626'} />
          <Text style={[styles.loadingText, textStyle]}>{t('archive.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredArchiveGroups}
          keyExtractor={item => item.date}
          renderItem={renderDateGroup}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeText || '#262626'}
            />
          }
          contentContainerStyle={hasArchiveStories ? styles.listContent : styles.emptyContainer}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon
                name={isSearching ? 'search-outline' : 'archive-outline'}
                size={42}
                color="#8e8e93"
              />
              <Text style={[styles.emptyTitle, textStyle]}>
                {isSearching ? t('archive.noMatchingDates') : t('archive.noArchivedDrops')}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isSearching ? t('archive.noMatchingSubtitle') : t('archive.emptySubtitle')}
              </Text>
            </View>
          }
        />
      )}

      {/* Story viewer modal */}
      <Modal
        visible={viewerVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeViewer} style={styles.modalBackButton}>
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('archive.archivedDropTitle')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <TouchableOpacity style={styles.mediaViewer} activeOpacity={1} onPress={nextStory}>
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
        </View>
      </Modal>

      {/* Highlight picker modal */}
      <Modal
        visible={highlightPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={closeHighlightPicker}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={closeHighlightPicker} />
          <View style={[styles.pickerSheet, cardStyle]}>
            <View style={styles.pickerHandle} />
            <Text style={[styles.pickerTitle, textStyle]}>{t('archive.chooseHighlight')}</Text>
            <Text style={styles.pickerSubtitle}>{t('archive.chooseHighlightSubtitle')}</Text>

            {selectedStoryForHighlight ? (
              <View style={styles.selectedStoryRow}>
                {selectedStoryForHighlight.type === 'video' ? (
                  <View style={styles.selectedStoryVideoThumb}>
                    <Icon name="play" size={18} color="#fff" />
                  </View>
                ) : (
                  <Image source={{ uri: selectedStoryForHighlight.uri }} style={styles.selectedStoryThumb} />
                )}
                <View style={styles.selectedStoryTextWrap}>
                  <Text style={[styles.selectedStoryTitle, textStyle]}>{t('archive.selectedDrop')}</Text>
                  <Text style={styles.selectedStoryMeta}>
                    {selectedStoryForHighlight.type === 'video'
                      ? t('archive.videoDrop')
                      : t('archive.photoDrop')}
                  </Text>
                </View>
              </View>
            ) : null}

            <ScrollView
              style={styles.highlightOptionsList}
              contentContainerStyle={styles.highlightOptionsContent}
              showsVerticalScrollIndicator={false}
            >
              {highlightOptions.length ? (
                highlightOptions.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.88}
                    style={styles.highlightOptionRow}
                    onPress={() => handleAddStoryToHighlight(item.id)}
                    disabled={submittingHighlightId === item.id}
                  >
                    {item.coverImage ? (
                      <Image source={{ uri: item.coverImage }} style={styles.highlightOptionImage} />
                    ) : (
                      <View style={styles.highlightOptionFallback}>
                        <Icon name="images-outline" size={18} color="#fff" />
                      </View>
                    )}
                    <View style={styles.highlightOptionTextWrap}>
                      <Text style={[styles.highlightOptionTitle, textStyle]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.highlightOptionMeta}>{t('archive.tapToAdd')}</Text>
                    </View>
                    {submittingHighlightId === item.id ? (
                      <ActivityIndicator size="small" color={themeText || '#262626'} />
                    ) : (
                      <Icon name="chevron-forward" size={18} color="#8e8e93" />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noHighlightsWrap}>
                  <Icon name="albums-outline" size={28} color="#8e8e93" />
                  <Text style={[styles.noHighlightsTitle, textStyle]}>{t('archive.noHighlightsFound')}</Text>
                  <Text style={styles.noHighlightsText}>{t('archive.noHighlightsText')}</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.pickerCancelButton, { backgroundColor: themeText || '#262626' }]}
              onPress={closeHighlightPicker}
            >
              <Text style={styles.pickerCancelText}>{t('archive.cancel')}</Text>
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
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
  },
  headerSpacer: {
    width: 32,
  },
  headerActionButton: {
    minWidth: 50,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  selectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#eef6ff',
  },
  selectionBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
    marginRight: 10,
  },
  selectionBannerTextWrap: {
    flex: 1,
  },
  selectionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#262626',
  },
  selectionBannerText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f6f6f7',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
    marginLeft: 8,
  },
  searchHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#8e8e93',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 28,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 22,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  dateText: {
    marginBottom: 12,
    paddingHorizontal: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  storyItem: {
    width: '31.33%',
    marginHorizontal: '1%',
    marginBottom: 10,
    aspectRatio: 0.82,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ececec',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  videoPreview: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  videoPreviewText: {
    marginTop: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightSelectBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalBackButton: {
    padding: 4,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  mediaViewer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullMedia: {
    width: '100%',
    height: '100%',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerBackdrop: {
    flex: 1,
  },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    minHeight: 380,
    maxHeight: '78%',
  },
  pickerHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 14,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#262626',
  },
  pickerSubtitle: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#6b7280',
  },
  selectedStoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#f5f6f8',
  },
  selectedStoryThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ddd',
  },
  selectedStoryVideoThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  selectedStoryTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  selectedStoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#262626',
  },
  selectedStoryMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#6b7280',
  },
  highlightOptionsList: {
    marginTop: 8,
  },
  highlightOptionsContent: {
    paddingBottom: 8,
  },
  highlightOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  highlightOptionImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ddd',
  },
  highlightOptionFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#64748b',
  },
  highlightOptionTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  highlightOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
  },
  highlightOptionMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#8e8e93',
  },
  noHighlightsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
    paddingHorizontal: 24,
  },
  noHighlightsTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#262626',
  },
  noHighlightsText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#8e8e93',
  },
  pickerCancelButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
  },
  pickerCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ArchiveScreen;
