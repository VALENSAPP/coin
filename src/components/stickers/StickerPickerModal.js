// src/components/stickers/StickerPickerModal.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  STICKER_CATEGORIES,
  filterStickers,
} from '../../constants/valensStickers';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Individual sticker item memoized to prevent re-renders when typing or scrolling
 */
const StickerCell = React.memo(({ item, onSelect, isDarkMode, accentColor }) => {
  const [imageLoading, setImageLoading] = useState(true);

  // Reset loading state when recycled item changes
  useEffect(() => {
    setImageLoading(true);
  }, [item.id, item.source]);

  if (item.type === 'emoji') {
    return (
      <TouchableOpacity
        style={styles.gridCell}
        onPress={() => onSelect(item)}
        activeOpacity={0.65}
      >
        <Text style={styles.emojiText}>{item.emoji}</Text>
      </TouchableOpacity>
    );
  }

  if (item.type === 'svg') {
    const SvgComp = item.SvgComp;
    return (
      <TouchableOpacity
        style={styles.gridCell}
        onPress={() => onSelect(item)}
        activeOpacity={0.65}
      >
        <View style={styles.svgPreviewWrap}>
          {SvgComp ? <SvgComp width={46} height={46} /> : null}
        </View>
        <Text
          style={[styles.stickerLabel, isDarkMode ? styles.textMutedDark : styles.textMutedLight]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  }

  // Valens WEBP image sticker with smooth circular loader
  return (
    <TouchableOpacity
      style={styles.gridCell}
      onPress={() => onSelect(item)}
      activeOpacity={0.65}
    >
      <View
        style={[
          styles.imgContainer,
          imageLoading && (isDarkMode ? styles.placeholderDark : styles.placeholderLight),
        ]}
      >
        {imageLoading && (
          <View style={styles.loaderWrap}>
            <ActivityIndicator
              size="small"
              color={isDarkMode ? '#ffffff' : (accentColor || '#5a2d82')}
            />
          </View>
        )}
        <Image
          source={item.source}
          style={[styles.stickerImg, imageLoading && { opacity: 0 }]}
          resizeMode="contain"
          fadeDuration={0}
          onLoadStart={() => setImageLoading(true)}
          onLoad={() => setImageLoading(false)}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
        />
      </View>
      <Text
        style={[styles.stickerLabel, isDarkMode ? styles.textMutedDark : styles.textMutedLight]}
        numberOfLines={1}
      >
        {item.title}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * Modern Instagram-style sticker search & pick sheet with FlatList virtualization,
 * category swipe gestures, and auto-scrolling category pills.
 */
export default function StickerPickerModal({
  visible,
  onClose,
  onSelectSticker,
  isDarkMode = true,
  accentColor = '#5a2d82',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const activeCategoryRef = useRef(activeCategory);
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  const categoryScrollRef = useRef(null);
  const flatListRef = useRef(null);
  const pillLayouts = useRef({});

  // Slide transition animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  // Compute filtered stickers instantly
  const filteredList = useMemo(() => {
    return filterStickers(searchQuery, activeCategory);
  }, [searchQuery, activeCategory]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSelect = useCallback(
    item => {
      onSelectSticker?.(item);
      onClose?.();
      setSearchQuery('');
    },
    [onSelectSticker, onClose],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <StickerCell
        item={item}
        onSelect={handleSelect}
        isDarkMode={isDarkMode}
        accentColor={accentColor}
      />
    ),
    [handleSelect, isDarkMode, accentColor],
  );

  const keyExtractor = useCallback(item => item.id, []);

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyWrap}>
        <Ionicons
          name="search-outline"
          size={44}
          color={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
        />
        <Text style={[styles.emptyTitle, isDarkMode ? styles.textWhite : styles.textBlack]}>
          No stickers found
        </Text>
        <Text style={[styles.emptySub, isDarkMode ? styles.textMutedDark : styles.textMutedLight]}>
          Try searching &quot;love&quot;, &quot;rocket&quot;, &quot;celebrate&quot;, &quot;win&quot; or &quot;dralens&quot;
        </Text>
      </View>
    ),
    [isDarkMode],
  );

  // Smoothly center the active category pill in the horizontal ScrollView
  const scrollToCategoryPill = useCallback(catKey => {
    const layout = pillLayouts.current[catKey];
    if (layout && categoryScrollRef.current) {
      const targetX = Math.max(0, layout.x - SCREEN_WIDTH / 2 + layout.width / 2);
      categoryScrollRef.current.scrollTo({ x: targetX, animated: true });
    }
  }, []);

  // When active category changes, auto-scroll pills and reset grid to top
  useEffect(() => {
    scrollToCategoryPill(activeCategory);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeCategory, scrollToCategoryPill]);

  // Spring slide-in animation when changing categories
  const triggerSlideAnimation = useCallback(
    direction => {
      // direction: 'left' (next tab sliding in from right edge) or 'right' (prev tab sliding in from left edge)
      const startX = direction === 'left' ? 36 : -36;
      translateX.setValue(startX);
      contentOpacity.setValue(0.55);

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          tension: 110,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [translateX, contentOpacity],
  );

  // Change category helper with animation
  const changeCategory = useCallback(
    (newCatKey, animDirection) => {
      if (newCatKey === activeCategoryRef.current) return;
      if (animDirection) {
        triggerSlideAnimation(animDirection);
      }
      setActiveCategory(newCatKey);
    },
    [triggerSlideAnimation],
  );

  // Direct pill tap handler
  const handlePillPress = useCallback(
    catKey => {
      if (catKey === activeCategory) return;
      const currentIdx = STICKER_CATEGORIES.findIndex(c => c.key === activeCategory);
      const newIdx = STICKER_CATEGORIES.findIndex(c => c.key === catKey);
      const animDir = newIdx > currentIdx ? 'left' : 'right';
      changeCategory(catKey, animDir);
    },
    [activeCategory, changeCategory],
  );

  // Switch category by offset (+1 for next, -1 for prev) with endless wrapping
  const switchCategoryByOffset = useCallback(
    offset => {
      const currentIdx = STICKER_CATEGORIES.findIndex(c => c.key === activeCategoryRef.current);
      if (currentIdx === -1) return;
      const total = STICKER_CATEGORIES.length;
      const newIdx = (currentIdx + offset + total) % total;
      const nextCategory = STICKER_CATEGORIES[newIdx].key;
      // offset > 0 means swipe left (moving forward to next tab -> slides in from right 'left')
      // offset < 0 means swipe right (moving back to prev tab -> slides in from left 'right')
      changeCategory(nextCategory, offset > 0 ? 'left' : 'right');
    },
    [changeCategory],
  );

  // Horizontal swipe gesture responder:
  // Allows free vertical scrolling & instant item taps, while capturing horizontal swipes
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponder: (evt, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 14 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
          );
        },

        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 14 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
          );
        },

        onPanResponderGrant: () => {
          Keyboard.dismiss();
        },

        onPanResponderMove: (evt, gestureState) => {
          // Provide subtle elastic drag feedback
          translateX.setValue(gestureState.dx * 0.28);
        },

        onPanResponderRelease: (evt, gestureState) => {
          const SWIPE_DIST = 32;
          const SWIPE_VEL = 0.25;

          const isSwipeLeft =
            gestureState.dx < -SWIPE_DIST ||
            (gestureState.dx < -12 && gestureState.vx < -SWIPE_VEL);

          const isSwipeRight =
            gestureState.dx > SWIPE_DIST ||
            (gestureState.dx > 12 && gestureState.vx > SWIPE_VEL);

          if (isSwipeLeft) {
            // Dragged right-to-left: advance to next category
            switchCategoryByOffset(1);
          } else if (isSwipeRight) {
            // Dragged left-to-right: go back to previous category
            switchCategoryByOffset(-1);
          } else {
            // Cancelled or small wiggle: spring back smoothly
            Animated.spring(translateX, {
              toValue: 0,
              tension: 120,
              friction: 12,
              useNativeDriver: true,
            }).start();
          }
        },

        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            tension: 120,
            friction: 12,
            useNativeDriver: true,
          }).start();
        },

        onPanResponderTerminationRequest: () => false,
      }),
    [switchCategoryByOffset, translateX],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Backdrop overlay: tap outside the sheet to dismiss */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheetContainer, isDarkMode ? styles.sheetDark : styles.sheetLight]}>
          {/* Drag Handle Indicator */}
          <View style={styles.dragHandleWrap}>
            <View style={[styles.dragHandle, isDarkMode ? styles.dragDark : styles.dragLight]} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, isDarkMode ? styles.textWhite : styles.textBlack]}>
                Stickers
              </Text>
              <View style={[styles.countBadge, isDarkMode ? styles.countBadgeDark : styles.countBadgeLight]}>
                <Text style={[styles.countBadgeText, isDarkMode ? styles.countBadgeTextDark : styles.countBadgeTextLight]}>
                  {filteredList.length}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, isDarkMode ? styles.closeBtnDark : styles.closeBtnLight]}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDarkMode ? '#fff' : '#111'} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBar, isDarkMode ? styles.searchBarDark : styles.searchBarLight]}>
            <Ionicons
              name="search"
              size={18}
              color={isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, isDarkMode ? styles.inputDark : styles.inputLight]}
              placeholder="Search Valens stickers & emojis..."
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Pills */}
          <View style={styles.categoriesWrap}>
            <ScrollView
              ref={categoryScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContent}
            >
              {STICKER_CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onLayout={e => {
                      pillLayouts.current[cat.key] = e.nativeEvent.layout;
                      if (cat.key === activeCategoryRef.current) {
                        scrollToCategoryPill(cat.key);
                      }
                    }}
                    style={[
                      styles.catPill,
                      isActive
                        ? [styles.catPillActive, { backgroundColor: accentColor, borderColor: accentColor }]
                        : isDarkMode
                        ? styles.catPillInactiveDark
                        : styles.catPillInactiveLight,
                    ]}
                    onPress={() => handlePillPress(cat.key)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={13}
                      color={isActive ? '#fff' : isDarkMode ? '#aaa' : '#666'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.catPillText,
                        isActive
                          ? styles.catPillTextActive
                          : isDarkMode
                          ? styles.catPillTextDark
                          : styles.catPillTextLight,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Swipeable Sticker Grid Container */}
          <View style={styles.gridOuterWrap} {...panResponder.panHandlers}>
            <Animated.View
              style={[
                styles.gridAnimatedWrap,
                {
                  transform: [{ translateX }],
                  opacity: contentOpacity,
                },
              ]}
            >
              <FlatList
                ref={flatListRef}
                data={filteredList}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                numColumns={4}
                initialNumToRender={24}
                maxToRenderPerBatch={20}
                windowSize={7}
                removeClippedSubviews={Platform.OS === 'android'}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.gridContent}
                ListEmptyComponent={renderEmpty}
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridOuterWrap: {
    flex: 1,
  },
  gridAnimatedWrap: {
    flex: 1,
  },
  sheetContainer: {
    height: SCREEN_HEIGHT * 0.72,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetDark: {
    backgroundColor: '#16161a',
  },
  sheetLight: {
    backgroundColor: '#ffffff',
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dragHandle: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
  },
  dragDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dragLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeDark: {
    backgroundColor: 'rgba(90, 45, 130, 0.35)',
  },
  countBadgeLight: {
    backgroundColor: 'rgba(90, 45, 130, 0.12)',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  countBadgeTextDark: {
    color: '#d8b4fe',
  },
  countBadgeTextLight: {
    color: '#5a2d82',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeBtnLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.07)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchBarDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  searchBarLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    paddingVertical: 0,
  },
  inputDark: {
    color: '#ffffff',
  },
  inputLight: {
    color: '#111111',
  },
  clearBtn: {
    padding: 4,
  },
  categoriesWrap: {
    marginBottom: 10,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPillActive: {
    backgroundColor: '#5a2d82',
    borderColor: '#5a2d82',
  },
  catPillInactiveDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  catPillInactiveLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#ffffff',
  },
  catPillTextDark: {
    color: '#cccccc',
  },
  catPillTextLight: {
    color: '#444444',
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  gridCell: {
    width: '25%',
    aspectRatio: 0.95,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgContainer: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  placeholderDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  placeholderLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  stickerImg: {
    width: 58,
    height: 58,
  },
  svgPreviewWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
    textAlign: 'center',
    width: '100%',
  },
  emojiText: {
    fontSize: 36,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  textWhite: {
    color: '#ffffff',
  },
  textBlack: {
    color: '#111111',
  },
  textMutedDark: {
    color: '#888899',
  },
  textMutedLight: {
    color: '#666677',
  },
});
