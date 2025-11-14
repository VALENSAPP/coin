import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Modal
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getAllUser } from '../../services/users';
import { getposts } from '../../services/home';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import Video from 'react-native-video';
import styles from './Style';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SearchScreen = () => {
  const dispatch = useDispatch();
  const toast = useToast();
  const navigation = useNavigation();

  const [userId, setUserId] = useState(null);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [posts, setPosts] = useState([]);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [previewPost, setPreviewPost] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isGrid, setIsGrid] = useState(false);

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    fetchUserId();
    fetchPosts();
  }, [fetchPosts]);

  /** 🔍 User search logic */
  const searchUsers = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setFilteredUsers([]);
      return;
    }

    try {
      dispatch(showLoader());

      const res = await getAllUser({ userName: searchQuery });
      if (res.statusCode === 200 || res.status === 200) {
        setFilteredUsers(res?.data?.users ?? []);
        console.log(res, 'responsse user profile')
      } else {
        setFilteredUsers([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setFilteredUsers([]);
    } finally {
      // dispatch(hideLoader());
    }
  }, [dispatch]);

  /** Debounce for search */
  const handleSearch = useCallback((text) => {
    setSearchText(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchUsers(text), 500);
  }, [searchUsers]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  /** 📸 Fetch posts (images + videos) */
  const fetchPosts = useCallback(async () => {
    try {
      dispatch(showLoader());
      const response = await getposts();
      console.log('Search response:', response);
      if (response?.statusCode === 200) {
        const postsData = response.data || [];
        // Transform posts: if a post has multiple images, create separate items for each
        const flattenedPosts = [];
        postsData.forEach((post) => {
          if (post?.images && Array.isArray(post.images) && post.images.length > 0) {
            // For each image in the post, create a grid item
            post.images.forEach((imageUrl, imgIndex) => {
              flattenedPosts.push({
                ...post,
                mediaUrl: imageUrl,
                imageIndex: imgIndex,
                isVideo: imageUrl?.toLowerCase().includes('.mp4') ||
                  imageUrl?.toLowerCase().includes('.mov') ||
                  imageUrl?.toLowerCase().includes('.avi') ||
                  post?.type === 'video' ||
                  post?.mediaType === 'video'
              });
            });
          } else if (post?.image) {
            // Handle single image field
            flattenedPosts.push({
              ...post,
              mediaUrl: post.image,
              isVideo: false
            });
          }
        });
        console.log('Flattened posts:', flattenedPosts.length);
        setPosts(flattenedPosts);
      } else {
        showToastMessage(toast, 'danger', response?.data?.message || 'Failed to fetch posts');
      }
    } catch (error) {
      console.log('Posts fetch error:', error);
      showToastMessage(toast, 'danger', error?.response?.message ?? 'Something went wrong');
    } finally {
      dispatch(hideLoader());
    }
  }, [dispatch, toast]);

  /** 🏗️ Masonry layout: Organize posts into columns with some items spanning 2 rows */
  const masonryLayout = useMemo(() => {
    if (posts.length === 0) return { columns: [[], [], []], maxHeight: 0 };

    const NUM_COLUMNS = 3;
    const ITEM_SPACING = 2;
    // Calculate based on full screen width with only spacing between items
    const BASE_ITEM_SIZE = (SCREEN_WIDTH - (ITEM_SPACING * (NUM_COLUMNS - 1))) / NUM_COLUMNS;
    const TALL_ITEM_SIZE = BASE_ITEM_SIZE * 2 + ITEM_SPACING; // 2 rows + spacing

    const columns = [[], [], []];
    const columnHeights = [0, 0, 0];

    posts.forEach((post, index) => {
      // Determine if this item should be tall (spanning 2 rows)
      // Pattern: Creates dynamic visual rhythm - roughly every 4th item
      // This makes posts at positions 0, 4, 8, 12, 16, etc. tall
      // The masonry algorithm will distribute these across columns naturally
      const shouldBeTall = index % 4 === 0;
      const itemHeight = shouldBeTall ? TALL_ITEM_SIZE : BASE_ITEM_SIZE;

      // Find the column with the minimum height
      let minHeightIndex = 0;
      for (let i = 1; i < NUM_COLUMNS; i++) {
        if (columnHeights[i] < columnHeights[minHeightIndex]) {
          minHeightIndex = i;
        }
      }

      // Add item to the column with minimum height
      columns[minHeightIndex].push({
        post,
        index,
        height: itemHeight,
        top: columnHeights[minHeightIndex],
        columnIndex: minHeightIndex,
        width: BASE_ITEM_SIZE,
        spacing: ITEM_SPACING,
      });

      // Update column height
      columnHeights[minHeightIndex] += itemHeight + ITEM_SPACING;
    });

    const maxHeight = Math.max(...columnHeights);

    return { columns, maxHeight, itemSize: BASE_ITEM_SIZE, spacing: ITEM_SPACING };
  }, [posts]);

  const masonryItems = useMemo(() => {
    if (!masonryLayout?.columns) return [];
    return masonryLayout.columns.flat();
  }, [masonryLayout]);

  /** 👤 Navigate to user profile */
  const handleUserProfile = (id) => {
    if (userId === id) {
      navigation.navigate('ProfileStack', { screen: 'FlipsScreen' });
    } else {
      navigation.navigate('ProfileStack', {
        screen: 'FlipsScreen',
        // params: { userId: id }
      });
    }
  };

  /** 🎬 Handle post press (image or video) */
  const handlePostPress = (item, isVideo) => {
    const postId = item.id;
    console.log(item, 'chck get post id')
    console.log(isVideo, 'isVideo--------------->>>>>>>>>')

    // if (!postId) {
    //   console.warn('No user ID found in post:', item);
    //   return;
    // }

    if (isVideo) {
      navigation.navigate('ProfileMain', {
        screen: 'FlipsScreen',
        params: {
          item: item
        }
      });
    }
    else {
     navigation.navigate('ProfileMain', {
      screen: 'PostView',
      params: {
        postData: [item],
        startIndex: 0,
      },
    });
    }
  };

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const firstVisible = viewableItems[0];
      const nextPlaying = firstVisible?.item?.index ?? firstVisible?.index ?? 0;
      setPlayingIndex(nextPlaying);
    }
  }, []);

  /** Normalize image URL */
  const normalizeImageUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (trimmed.startsWith('/')) {
      return `http://35.174.167.92:3002${trimmed}`;
    }
    return `http://35.174.167.92:3002/${trimmed}`;
  };

  const previewMediaUrl = useMemo(() => {
    if (!previewPost) return null;
    return normalizeImageUrl(
      previewPost?.mediaUrl ||
      previewPost?.image ||
      (Array.isArray(previewPost?.images) ? previewPost.images[0] : null)
    );
  }, [previewPost]);

  const previewIsVideo = useMemo(() => {
    if (!previewPost) return false;
    return (
      previewPost?.isVideo ||
      previewPost?.type === 'video' ||
      previewPost?.mediaType === 'video'
    );
  }, [previewPost]);

  const openPreview = useCallback((post) => {
    setPreviewPost(post);
    setPreviewVisible(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewPost(null);
  }, []);

  /** 🔲 UI — render masonry post item */
  const renderMasonryItem = useCallback((layoutItem) => {
    const { post, index, height, top, columnIndex, width, spacing } = layoutItem;
    const isVideo = post?.isVideo || post?.type === 'video' || post?.mediaType === 'video';
    const imageUrl = normalizeImageUrl(post?.mediaUrl || post?.image || (post?.images && post.images[0]));

    if (!imageUrl) {
      return null;
    }

    const left = columnIndex * (width + spacing);

    return (
      <TouchableOpacity
        key={`${post?.id || index}_${columnIndex}`}
        activeOpacity={0.8}
        onPress={() => handlePostPress(post, isVideo)}
        onLongPress={() => openPreview(post)}
        delayLongPress={220}
        style={[
          styles.masonryItem,
          {
            position: 'absolute',
            left,
            top,
            width,
            height,
          }
        ]}
      >
        {isVideo ? (
          <View style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Video
              source={{ uri: imageUrl }}
              style={styles.media}
              resizeMode="cover"
              repeat
              paused={playingIndex !== index}
              muted={true}
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
          />
        )}
      </TouchableOpacity>
    );
  }, [playingIndex, handlePostPress, openPreview]);

  /** 👥 Render empty state for search results */
  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="search-outline" size={60} color="#ddd" />
        <Text style={styles.emptyTitle}>No users found</Text>
        <Text style={styles.emptySubtitle}>Try searching for a different user</Text>
      </View>
    );
  }, []);

  /** 👤 Render list  for user search results */
  const renderListItem = useCallback(({ item }) => {
    console.log(item, "profileitemmm====>>>>>>>>>>>>>>>>>>>>")
    return (
      <TouchableOpacity
        style={styles.userListItem}
        onPress={() => handleUserProfile(item.id)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: normalizeImageUrl(item?.image ? item?.image : <Text style={{ color: "red", fontSize: 20 }}>No data found</Text>) }}
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item?.name || item?.userName}</Text>
          <Text style={styles.userHandle} numberOfLines={1}>@{item?.userName}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleUserProfile]);

  /** 📊 Render grid item for user search results */
  const renderGridItem = useCallback(({ item }) => {
    return (
      <TouchableOpacity
        style={styles.userGridItem}
        onPress={() => handleUserProfile(item.id)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: normalizeImageUrl(item?.profilePicture || item?.avatar) }}
          style={styles.userGridAvatar}
        />
        <Text style={styles.userGridName} numberOfLines={1}>{item?.name || item?.userName}</Text>
      </TouchableOpacity>
    );
  }, [handleUserProfile]);

  /** 📋 Render list header */
  const renderListHeader = useCallback(() => {
    return (
      <Text style={styles.sectionTitle}>Search Results</Text>
    );
  }, []);

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          {/* 🔍 Search bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={handleSearch}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Icon name="close-circle" size={20} color="#999" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>

          {searchText.trim().length > 0 ? (
            <View style={styles.resultsContainer}>
              {filteredUsers.length > 0 ? (
                <FlatList
                  data={filteredUsers}
                  keyExtractor={(item, idx) => String(item.id ?? idx)}
                  renderItem={isGrid ? renderGridItem : renderListItem}
                  showsVerticalScrollIndicator={false}
                  ListHeaderComponent={renderListHeader}
                  contentContainerStyle={styles.listContent}
                  numColumns={isGrid ? 2 : 1}
                  key={isGrid ? 'grid' : 'list'}
                  columnWrapperStyle={isGrid ? styles.gridRow : null}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                />
              ) : (
                renderEmptyState()
              )}
            </View>
          ) : null}


          {/* 🔲 Masonry Grid of posts — Show by default when no search is active */}
          {searchText.trim().length === 0 ? (
            posts.length > 0 ? (
              <View style={styles.masonryWrapper}>
                <FlatList
                  data={masonryItems}
                  renderItem={({ item }) => renderMasonryItem(item)}
                  keyExtractor={(item, idx) =>
                    item?.post?.id ? `${item.post.id}-${idx}-${item.columnIndex}` : `masonry-${idx}`
                  }
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.masonryContainer,
                    { height: masonryLayout.maxHeight }
                  ]}
                  removeClippedSubviews={true}
                  initialNumToRender={12}
                  windowSize={10}
                  viewabilityConfig={viewabilityConfig}
                  onViewableItemsChanged={handleViewableItemsChanged}
                />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="images-outline" size={60} color="#ddd" />
                <Text style={styles.emptyTitle}>No posts available</Text>
              </View>
            )
          ) : null}
        </View>
      </TouchableWithoutFeedback>

      {previewVisible && previewPost ? (
        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={closePreview}
          onDismiss={closePreview}
        >
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
                    />
                  ) : (
                    <Image
                      source={{ uri: previewMediaUrl }}
                      style={styles.previewMedia}
                      resizeMode="cover"
                    />
                  )
                ) : (
                  <View style={styles.previewFallback}>
                    <Text style={styles.previewFallbackText}>Preview unavailable</Text>
                  </View>
                )}
              </View>

              {/* <TouchableOpacity style={styles.previewCloseButton} onPress={closePreview}>
                {/* <Icon name="close" size={26} color="#fff" /> */}
              {/* </TouchableOpacity>  */}
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
};

// const localStyles = StyleSheet.create({
//   masonryWrapper: {
//     flex: 1,
//     width: SCREEN_WIDTH,
//     marginLeft: -12, // Offset container padding
//     marginRight: -12, // Offset container padding
//   },
//   masonryContainer: {
//     position: 'relative',
//     width: SCREEN_WIDTH,
//     paddingBottom: 10,
//   },
//   previewOverlay: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   previewBackdrop: {
//     position: 'absolute',
//     top: 0,
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: 'rgba(0,0,0,0.85)',
//   },
//   previewContent: {
//     width: '100%',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   previewMediaWrapper: {
//     width: SCREEN_WIDTH * 0.92,
//     maxHeight: SCREEN_HEIGHT * 0.85,
//     borderRadius: 18,
//     overflow: 'hidden',
//     backgroundColor: '#000',
//   },
//   previewMedia: {
//     width: '100%',
//     height: SCREEN_HEIGHT * 0.75,
//   },
//   previewFallback: {
//     width: '100%',
//     height: SCREEN_HEIGHT * 0.75,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: '#222',
//   },
//   previewFallbackText: {
//     color: '#fff',
//     fontSize: 16,
//   },
//   previewCloseButton: {
//     position: 'absolute',
//     top: 40,
//     right: 24,
//     zIndex: 2,
//   },
//   masonryItem: {
//     borderRadius: 2,
//     overflow: 'hidden',
//     backgroundColor: '#f0f0f0',
//   },
//   gridItem: {
//     margin: 1,
//     borderRadius: 2,
//     overflow: 'hidden',
//     backgroundColor: '#f0f0f0',
//     width: (SCREEN_WIDTH - 32 - 6) / 3,
//     height: (SCREEN_WIDTH - 32 - 6) / 3,
//   },
//   media: {
//     width: '100%',
//     height: '100%',
//   },
//   videoIconOverlay: {
//     position: 'absolute',
//     top: 6,
//     right: 6,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     borderRadius: 4,
//     padding: 4,
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingTop: 100,
//   },
//   emptyTitle: {
//     fontSize: 16,
//     color: '#666',
//     marginTop: 10,
//   },

// });

export default SearchScreen;