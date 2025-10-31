import { useNavigation } from '@react-navigation/native';
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const numColumns = 3;
const SPACING = 2;
const IMAGE_SIZE = (screenWidth - SPACING * (numColumns + 1)) / numColumns;

// URL normalization function
const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) return `http://35.174.167.92:3002${trimmed}`;
  return `http://35.174.167.92:3002/${trimmed}`;
};

// Memoized image component for better performance
const PostImage = memo(({ item, index, onPress }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = normalizeImageUrl(item?.images?.[0]);
  
  if (!imageUrl || imageError) {
    return (
      <View style={[styles.image, styles.placeholderImage]}>
        <Text style={styles.placeholderText}>📷</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.image}
      resizeMode="cover"
      onError={() => setImageError(true)}
      onLoad={() => setImageError(false)}
    />
  );
});

PostImage.displayName = 'PostImage';

const PostScreen = memo(({ postCheck }) => {
  const [posts, setPosts] = useState(postCheck);
  const navigation = useNavigation();

  useEffect(() => {
    if (postCheck !== posts) {
    setPosts(postCheck);
    }
  }, [postCheck, posts]);

  const openPosts = useCallback((index) => {
    navigation.getParent().navigate('ProfileMain', {
      screen: 'PostView',
      params: {
        postData: postCheck,
        startIndex: index,
      },
    });
  }, [navigation, postCheck]);

  const renderItem = useCallback(({ item, index }) => (
      <TouchableOpacity
        style={[
          styles.imageContainer,
          { marginLeft: index % numColumns === 0 ? 0 : SPACING },
        ]}
        activeOpacity={0.95}
        onPress={() => openPosts(index)}
      >
      <PostImage item={item} index={index} />
        <View style={styles.overlay} />
      </TouchableOpacity>
  ), [openPosts]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  const getItemLayout = useCallback((data, index) => ({
    length: IMAGE_SIZE + SPACING,
    offset: (IMAGE_SIZE + SPACING) * Math.floor(index / numColumns),
    index,
  }), []);

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>Share your first moment</Text>
    </View>
  ), []);

  if (!posts || posts.length === 0) {
    return (
      <View style={styles.screen}>
        {renderEmptyComponent()}
    </View>
  );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        ListEmptyComponent={renderEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          posts.length === 0 && styles.emptyListContent,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: SPACING }} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={12} // Reduced from 21 for better performance
        windowSize={5} // Reduced from 10 for better performance
        initialNumToRender={12} // Reduced from 21 for better performance
        getItemLayout={getItemLayout}
        updateCellsBatchingPeriod={50} // Batch updates for better performance
        disableVirtualization={false} // Keep virtualization enabled
      />
    </View>
  );
});

PostScreen.displayName = 'PostScreen';

export default PostScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },
  listContent: {
    padding: SPACING,
    paddingBottom: 100,
  },
  emptyListContent: {
    flexGrow: 1,
  },

  // --- Grid Images ---
  imageContainer: {
    marginBottom: SPACING,
    borderRadius: 12, // rounded corners
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#5a2d82',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginRight: 7,
    marginTop: 5
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    backgroundColor: '#f0f0f0',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(90, 45, 130, 0.08)', // subtle purple tint
    opacity: 0,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3e9fb', // soft purple pastel
  },
  placeholderText: {
    fontSize: 22,
    color: '#5a2d82',
    opacity: 0.6,
  },

  // --- Empty State ---
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#5a2d82', // purple headline
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});

