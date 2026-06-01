import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useToast } from 'react-native-toast-notifications';
import { editPost } from '../../../services/post';
import { showToastMessage } from '../../../components/displaytoastmessage';
import { useAppTheme } from '../../../theme/useApptheme';
import { getAllUser } from '../../../services/users';
import { getposts } from '../../../services/home';
import { useLanguage } from '../../../i18n';

const { width } = Dimensions.get('window');

const isVideoUrl = url => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().split('?')[0];
  return ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp', '.m4v'].some(ext =>
    lower.endsWith(ext),
  );
};

const normalizeMedia = post => {
  const images = Array.isArray(post?.images) ? post.images : [];
  return images.map((raw, index) => {
    const url = typeof raw === 'string' ? raw : raw?.url || raw?.uri || '';
    const thumbnail =
      typeof raw === 'object' ? raw?.thumbnail || raw?.poster || '' : '';

    return {
      id: `${post?.id || 'post'}-media-${index}`,
      url,
      thumbnail,
      type: isVideoUrl(url) ? 'video' : 'image',
    };
  });
};

export default function EditPostScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();

  const post = useMemo(() => route?.params?.post || {}, [route?.params?.post]);
  const onSave = route?.params?.onSave;
  const initialLocation = typeof post?.location === 'string' ? post.location : '';
  const initialTaggedPeople = useMemo(
    () =>
      Array.isArray(post?.taggedPeople)
        ? post.taggedPeople
            .map(person => {
              if (typeof person === 'string') return person;
              return person?.username || person?.userName || person?.name || person?.id || '';
            })
            .filter(Boolean)
            .map(person => person.replace(/^@+/, ''))
        : typeof post?.taggedPeople === 'string'
          ? post.taggedPeople
              .split(',')
              .map(person => person.trim().replace(/^@+/, ''))
              .filter(Boolean)
          : [],
    [post?.taggedPeople],
  );

  const [caption, setCaption] = useState(post?.caption || '');
  const [location, setLocation] = useState(initialLocation);
  const [tagSearch, setTagSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playingById, setPlayingById] = useState({});
  const [mutedById] = useState({});
  const [showLocationEditor, setShowLocationEditor] = useState(Boolean(initialLocation));
  const [showTaggedPeopleEditor, setShowTaggedPeopleEditor] = useState(
    initialTaggedPeople.length > 0,
  );
  const [selectedTaggedPeople, setSelectedTaggedPeople] = useState(initialTaggedPeople);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [knownLocations, setKnownLocations] = useState([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const media = useMemo(() => normalizeMedia(post), [post]);
  const userSearchTimeoutRef = useRef(null);
  const activeSearchRequestIdRef = useRef(0);

  const locationSummary = location.trim();
  const taggedPeopleList = useMemo(() => selectedTaggedPeople, [selectedTaggedPeople]);
  const taggedPeopleSummary = taggedPeopleList.join(', ');
  const locationSuggestions = useMemo(() => {
    const query = locationSummary.toLowerCase();
    if (!query) {
      return knownLocations.slice(0, 6);
    }
    return knownLocations
      .filter(item => item.toLowerCase().includes(query))
      .slice(0, 6);
  }, [knownLocations, locationSummary]);

  const hasChanges = useMemo(() => {
    return (
      caption.trim() !== String(post?.caption || '').trim() ||
      locationSummary !== initialLocation.trim() ||
      taggedPeopleSummary !== initialTaggedPeople.join(', ')
    );
  }, [
    caption,
    initialLocation,
    initialTaggedPeople,
    locationSummary,
    post?.caption,
    taggedPeopleSummary,
  ]);

  useEffect(() => {
    const loadKnownLocations = async () => {
      try {
        setIsLoadingLocations(true);
        const response = await getposts();
        const posts = Array.isArray(response?.data) ? response.data : [];
        const uniqueLocations = Array.from(
          new Set(
            posts
              .map(item => (typeof item?.location === 'string' ? item.location.trim() : ''))
              .filter(Boolean),
          ),
        );
        setKnownLocations(uniqueLocations);
      } catch (error) {
        setKnownLocations([]);
      } finally {
        setIsLoadingLocations(false);
      }
    };

    loadKnownLocations();
  }, []);

  useEffect(() => {
    if (userSearchTimeoutRef.current) {
      clearTimeout(userSearchTimeoutRef.current);
    }

    if (!showTaggedPeopleEditor || !tagSearch.trim()) {
      activeSearchRequestIdRef.current = 0;
      setUserSuggestions([]);
      setIsSearchingUsers(false);
      return undefined;
    }

    userSearchTimeoutRef.current = setTimeout(async () => {
      const requestId = Date.now();
      activeSearchRequestIdRef.current = requestId;
      setIsSearchingUsers(true);

      try {
        const response = await getAllUser({ userName: tagSearch.trim() });
        if (activeSearchRequestIdRef.current !== requestId) return;

        const users = Array.isArray(response?.data?.users) ? response.data.users : [];
        setUserSuggestions(
          users.filter(user => {
            const username = String(user?.userName || user?.username || '').trim();
            return username && !selectedTaggedPeople.includes(username);
          }),
        );
      } catch (error) {
        if (activeSearchRequestIdRef.current === requestId) {
          setUserSuggestions([]);
        }
      } finally {
        if (activeSearchRequestIdRef.current === requestId) {
          setIsSearchingUsers(false);
        }
      }
    }, 400);

    return () => {
      if (userSearchTimeoutRef.current) {
        clearTimeout(userSearchTimeoutRef.current);
      }
    };
  }, [selectedTaggedPeople, showTaggedPeopleEditor, tagSearch]);

  const handleSelectUser = useCallback(user => {
    const username = String(user?.userName || user?.username || '').trim().replace(/^@+/, '');
    if (!username) return;

    setSelectedTaggedPeople(prev => (prev.includes(username) ? prev : [...prev, username]));
    setTagSearch('');
    setUserSuggestions([]);
  }, []);

  const handleRemoveTaggedPerson = useCallback(username => {
    setSelectedTaggedPeople(prev => prev.filter(person => person !== username));
  }, []);

  const handleSave = useCallback(async () => {
    const nextCaption = caption.trim();

    if (!hasChanges) {
      navigation.goBack();
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await editPost(post?.id, {
        caption: nextCaption,
        location: locationSummary,
        taggedPeople: taggedPeopleSummary,
      });
      if (response?.statusCode && response.statusCode >= 400) {
        throw new Error(response?.message || t('editPost.updateFailed'));
      }

      const updatedFromApi =
        response?.data?.data ||
        response?.data ||
        response ||
        {};

      const updatedPost = {
        ...post,
        ...updatedFromApi,
        caption: updatedFromApi?.caption ?? nextCaption,
        location: updatedFromApi?.location ?? locationSummary,
        taggedPeople: updatedFromApi?.taggedPeople ?? taggedPeopleList,
      };

      onSave?.(updatedPost);
      showToastMessage(
        toast,
        'success',
        response?.data?.message || response?.message || t('editPost.postUpdated'),
      );
      navigation.goBack();

    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.data?.message || error?.message || t('editPost.updateFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    caption,
    hasChanges,
    locationSummary,
    navigation,
    onSave,
    post,
    t,
    taggedPeopleList,
    taggedPeopleSummary,
    toast,
  ]);

  const renderMediaItem = useCallback(
    ({ item }) => (
      <View style={styles.mediaSlide}>
        {item.type === 'video' ? (
          <View style={styles.videoWrap}>
            <Video
              source={{ uri: item.url }}
              style={styles.media}
              resizeMode='cover'
              paused={!playingById[item.id]}
              muted={mutedById[item.id] ?? true}
              repeat
            />
            {!playingById[item.id] && item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                style={styles.posterOverlay}
                resizeMode='cover'
              />
            ) : null}
            <TouchableOpacity
              style={styles.centerPlayButton}
              activeOpacity={0.9}
              onPress={() =>
                setPlayingById(prev => ({
                  ...prev,
                  [item.id]: !prev[item.id],
                }))
              }
            >
              <Icon
                name={playingById[item.id] ? 'pause' : 'play'}
                size={32}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        ) : (
          <Image source={{ uri: item.url }} style={styles.media} resizeMode="contain" />
        )}
      </View>
    ),
    [mutedById, playingById],
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Icon name="close" size={26} color="#111" />
          </TouchableOpacity>
          <Text style={[styles.title, textStyle]}>{t('editPost.screenTitle')}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting}
            style={styles.headerButton}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={text} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  hasChanges ? { color: text } : styles.saveTextDisabled,
                ]}
              >
                {t('editPost.doneButton')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mediaSection}>
            <FlatList
              data={media}
              keyExtractor={item => item.id}
              renderItem={renderMediaItem}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaList}
            />
          </View>

          <View style={styles.editorSection}>
            <Text style={[styles.label, textStyle]}>{t('editPost.captionLabel')}</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={t('editPost.captionPlaceholder')}
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              style={[styles.input, bgStyle, textStyle]}
              editable={!isSubmitting}
              maxLength={2200}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.metaRow}
              onPress={() => setShowTaggedPeopleEditor(prev => !prev)}
            >
              <View style={styles.metaRowLeft}>
                <Icon name="person-add-outline" size={20} color="#111827" />
                <Text style={[styles.metaLabel, textStyle]}>{t('editPost.tagPeople')}</Text>
              </View>
              <View style={styles.metaRowRight}>
                {!!taggedPeopleList.length && (
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {t('editPost.taggedCount', { count: taggedPeopleList.length })}
                  </Text>
                )}
                <Icon
                  name={showTaggedPeopleEditor ? 'chevron-up' : 'chevron-forward'}
                  size={18}
                  color="#6b7280"
                />
              </View>
            </TouchableOpacity>

            {showTaggedPeopleEditor ? (
              <View style={styles.editorInputWrap}>
                <TextInput
                  value={tagSearch}
                  onChangeText={setTagSearch}
                  placeholder={t('editPost.searchPeoplePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  style={[styles.metaInput, styles.tagInput, textStyle]}
                  editable={!isSubmitting}
                  autoCapitalize="none"
                  maxLength={250}
                />
                {isSearchingUsers ? (
                  <ActivityIndicator size="small" color={text} style={styles.metaLoader} />
                ) : null}
                {userSuggestions.length ? (
                  <View style={styles.suggestionList}>
                    {userSuggestions.map(user => {
                      const username = String(user?.userName || user?.username || '').trim();
                      const displayName = String(user?.name || user?.fullName || '').trim();
                      return (
                        <TouchableOpacity
                          key={String(user?.id || username)}
                          style={styles.userSuggestionRow}
                          activeOpacity={0.8}
                          onPress={() => handleSelectUser(user)}
                        >
                          <View style={styles.userAvatar}>
                            {user?.image ? (
                              <Image
                                source={{ uri: user.image }}
                                style={styles.userAvatarImage}
                              />
                            ) : (
                              <Icon name="person-outline" size={16} color="#6b7280" />
                            )}
                          </View>
                          <View style={styles.userCopy}>
                            <Text style={styles.userTitle}>{`@${username}`}</Text>
                            {!!displayName && (
                              <Text style={styles.userSubtitle}>{displayName}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
                {taggedPeopleList.length ? (
                  <View style={styles.tagChipWrap}>
                    {taggedPeopleList.map(person => (
                      <TouchableOpacity
                        key={person}
                        style={styles.tagChip}
                        activeOpacity={0.8}
                        onPress={() => handleRemoveTaggedPerson(person)}
                      >
                        <Text style={styles.tagChipText}>{`@${person}`}</Text>
                        <Icon name="close" size={14} color="#1f2937" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveTextDisabled: {
    color: '#9ca3af',
  },
  mediaSection: {
    marginTop: 10,
  },
  mediaList: {
    backgroundColor: '#fff',
  },
  mediaSlide: {
    width,
    height: width,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width,
    height: width,
  },
  posterOverlay: {
    position: 'absolute',
    width,
    height: width,
  },
  videoWrap: {
    width,
    height: width * 1,
    backgroundColor: '#fff',
  },
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 68,
    height: 68,
    marginLeft: -34,
    marginTop: -34,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bottomMuteButton: {
    position: 'absolute',
    resizeMode: 20,
    bottom: 16,
    // alignSelf: 'center',
    minWidth: 44,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  editorSection: {
    padding: 16,
    marginTop: '5%'
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  input: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  metaCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  metaRow: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '48%',
  },
  metaLabel: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  metaValue: {
    marginRight: 6,
    fontSize: 13,
    color: '#6b7280',
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  metaInput: {
    minHeight: 48,
    marginHorizontal: 14,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  editorInputWrap: {
    paddingBottom: 14,
  },
  tagInput: {
    marginBottom: 10,
  },
  metaLoader: {
    marginBottom: 10,
  },
  suggestionList: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#111827',
  },
  userSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
  },
  userCopy: {
    marginLeft: 12,
    flex: 1,
  },
  userTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  userSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  tagChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipText: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
    marginRight: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
  },
});
