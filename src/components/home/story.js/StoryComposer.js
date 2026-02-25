import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  TextInput,
  Platform,
  Animated,
  PanResponder,
  FlatList,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { captureRef } from 'react-native-view-shot';
import { useAppTheme } from '../../../theme/useApptheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FILTERS = [
  { key: 'none', label: 'Original', overlay: null },
  { key: 'grayscale', label: 'Grayscale', overlay: 'rgba(0,0,0,0.35)' },
  { key: 'sepia', label: 'Sepia', overlay: 'rgba(112, 66, 20, 0.28)' },
  { key: 'saturate', label: 'Saturate', overlay: 'rgba(255, 64, 128, 0.12)' },
  { key: 'contrast', label: 'Contrast', overlay: 'rgba(0,0,0,0.22)' },
  { key: 'brightness', label: 'Bright', overlay: 'rgba(255,255,255,0.22)' },
];

const DEFAULT_FONTS = [
  { name: 'System', style: {} },
  { name: 'Billabong', style: { fontFamily: 'FontsFree-Net-Billabong' } },
  { name: 'Roboto', style: { fontFamily: 'Roboto-Regular' } },
  { name: 'Pacifico', style: { fontFamily: 'Pacifico-Regular' } },
];

const isVideo = asset => {
  if (!asset) return false;
  if (asset.type?.includes('video')) return true;
  const uri = asset.uri || asset.path || '';
  return ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'].some(ext =>
    uri.toLowerCase().includes(ext),
  );
};

const Draggable = ({
  id,
  initialX = 50,
  initialY = 50,
  onStart,
  onEnd,
  children,
}) => {
  const pan = useRef(
    new Animated.ValueXY({ x: initialX, y: initialY }),
  ).current;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: e => e.nativeEvent.touches.length === 1,
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length === 1 &&
        (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),

      onPanResponderGrant: () => {
        onStart?.();
        pan.setOffset({ x: pan.x.__getValue(), y: pan.y.__getValue() });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: () => {
        pan.flattenOffset();
        onEnd?.(pan.x.__getValue(), pan.y.__getValue());
      },

      onPanResponderTerminate: () => {
        pan.flattenOffset();
        onEnd?.(pan.x.__getValue(), pan.y.__getValue());
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[styles.overlayItem, pan.getLayout()]}
      {...responder.panHandlers}
    >
      {children}
    </Animated.View>
  );
};

export default function StoryComposer({
  modalVisible,
  mediaList = [],
  onCancel,
  onDone,
}) {
  const [index, setIndex] = useState(0);
  const [filterPerIndex, setFilterPerIndex] = useState({});
  const [stickersPerIndex, setStickersPerIndex] = useState({});
  const [textsPerIndex, setTextsPerIndex] = useState({});
  const [draftText, setDraftText] = useState('');
  const [textColor, setTextColor] = useState('#fff');
  const [textFont, setTextFont] = useState(DEFAULT_FONTS[0].style);
  const [activeTab, setActiveTab] = useState('filters');
  const { bgStyle, textStyle, bg } = useAppTheme();

  const canvasRefs = useRef({});

  useEffect(() => {
    if (!modalVisible) return;
    const f = {},
      s = {},
      t = {};
    mediaList.forEach((_, i) => {
      f[i] = 'none';
      s[i] = [];
      t[i] = [];
    });
    setFilterPerIndex(f);
    setStickersPerIndex(s);
    setTextsPerIndex(t);
    setIndex(0);
  }, [modalVisible]);

  const currentMedia = mediaList[index];
  const currentFilterKey = filterPerIndex[index] || 'none';
  const currentFilterOverlay =
    FILTERS.find(f => f.key === currentFilterKey)?.overlay || null;

  const selectFilter = filterKey => {
    console.log('Selecting filter:', filterKey);
    setFilterPerIndex(prev => {
      const updated = { ...prev, [index]: filterKey };
      console.log('Updated filters:', updated);
      return updated;
    });
  };

  const addSticker = emoji => {
    setStickersPerIndex(prev => {
      const next = { ...prev };
      next[index] = [
        ...(next[index] || []),
        { id: `${Date.now()}_${Math.random()}`, emoji, x: 50, y: 50 },
      ];
      return next;
    });
  };

  const addText = () => {
    const t = draftText.trim();
    if (!t) return;
    setTextsPerIndex(prev => {
      const next = { ...prev };
      next[index] = [
        ...(next[index] || []),
        {
          id: `${Date.now()}_${Math.random()}`,
          text: t,
          color: textColor,
          fontFamily: textFont.fontFamily,
          x: 50,
          y: 50,
        },
      ];
      return next;
    });
    setDraftText('');
  };

  const setStickerPos = (id, x, y) => {
    setStickersPerIndex(prev => {
      const next = { ...prev };
      next[index] = (next[index] || []).map(s =>
        s.id === id ? { ...s, x, y } : s,
      );
      return next;
    });
  };
  
  const setTextPos = (id, x, y) => {
    setTextsPerIndex(prev => {
      const next = { ...prev };
      next[index] = (next[index] || []).map(t =>
        t.id === id ? { ...t, x, y } : t,
      );
      return next;
    });
  };

  const handleExport = async () => {
    try {
      const out = [];
      for (let i = 0; i < mediaList.length; i++) {
        const m = mediaList[i];
        const isVid = isVideo(m);

        let processedUri = m.uri;
        if (!isVid) {
          const ref = canvasRefs.current[i];
          if (ref) {
            processedUri = await captureRef(ref, {
              format: 'jpg',
              quality: 0.9,
              result: 'tmpfile',
            });
          }
        }

        out.push({
          original: m,
          processedUri,
          filterKey: filterPerIndex[i] || 'none',
          stickers: stickersPerIndex[i] || [],
          texts: textsPerIndex[i] || [],
          isVideo: isVid,
          duration: m.duration,
        });
      }

      onDone?.(out);
    } catch (e) {
      Alert.alert('Export failed', e.message || String(e));
    }
  };

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
    >
      <View style={[styles.container, bgStyle]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onCancel} style={styles.topBtn}>
            <Icon name="close" size={26} color="#000" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Add Drops</Text>
          <TouchableOpacity onPress={handleExport} style={styles.nextBtn}>
            <Text style={styles.nextText}>Post</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas - Full Screen */}
        <View
          style={styles.canvasOuter}
          ref={ref => {
            if (ref) canvasRefs.current[index] = ref;
          }}
          collapsable={false}
        >
          {currentMedia && !isVideo(currentMedia) ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: currentMedia.uri }}
                style={styles.fullScreenImage}
                resizeMode="cover"
              />
              {currentFilterOverlay ? (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    { backgroundColor: currentFilterOverlay },
                  ]}
                />
              ) : null}
            </View>
          ) : currentMedia ? (
            <View style={styles.videoWrap}>
              <Video
                source={{ uri: currentMedia.uri }}
                style={styles.fullScreenVideo}
                resizeMode="cover"
                repeat
                muted
              />
            </View>
          ) : null}

          {/* Stickers */}
          {(stickersPerIndex[index] || []).map(s => (
            <Draggable
              key={s.id}
              id={s.id}
              initialX={s.x}
              initialY={s.y}
              onEnd={(x, y) => setStickerPos(s.id, x, y)}
            >
              <Text style={styles.sticker}>{s.emoji}</Text>
            </Draggable>
          ))}

          {/* Text overlays */}
          {(textsPerIndex[index] || []).map(t => (
            <Draggable
              key={t.id}
              id={t.id}
              initialX={t.x}
              initialY={t.y}
              onEnd={(x, y) => setTextPos(t.id, x, y)}
            >
              <Text
                style={[
                  styles.textOverlay,
                  { color: t.color, fontFamily: t.fontFamily },
                ]}
              >
                {t.text}
              </Text>
            </Draggable>
          ))}
        </View>

        {/* Thumbnails / pager */}
        {mediaList.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbBar}>
            {mediaList.map((m, i) => (
              <TouchableOpacity
                key={`thumb_${i}`}
                onPress={() => setIndex(i)}
                style={[styles.thumb, index === i && styles.activeThumb]}
              >
                <Image source={{ uri: m.uri }} style={styles.thumbImg} />
                {isVideo(m) && (
                  <View style={styles.videoBadge}>
                    <Icon name="videocam" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[styles.tabs, bgStyle, { borderTopColor: bg }]}>
          <Tab
            icon="color-filter-outline"
            label="Filters"
            tabKey="filters"
            active={activeTab === 'filters'}
            onPress={setActiveTab}
          />
          <Tab
            icon="happy-outline"
            label="Stickers"
            tabKey="stickers"
            active={activeTab === 'stickers'}
            onPress={setActiveTab}
          />
          <Tab
            icon="text-outline"
            label="Text"
            tabKey="text"
            active={activeTab === 'text'}
            onPress={setActiveTab}
          />
        </View>

        {/* Filters panel */}
        {activeTab === 'filters' && (
          <View style={[styles.bottomTools, bgStyle]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => selectFilter(f.key)}
                  style={[
                    styles.filterChip,
                    currentFilterKey === f.key && styles.filterChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      currentFilterKey === f.key && styles.filterLabelActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Stickers panel */}
        {activeTab === 'stickers' && (
          <View style={[styles.bottomTools, bgStyle]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stickerScrollContent}
            >
              {['😀', '😂', '😍', '🔥', '👍', '👏', '😮', '😎', '🥳', '🤍', '💙', '✨', '🌈', '💥', '🍕', '🎉'].map(e => (
                <TouchableOpacity
                  key={e}
                  onPress={() => addSticker(e)}
                  style={styles.stickerPick}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stickerEmoji}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Text tools */}
        {activeTab === 'text' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.bottomTools, bgStyle]}
          >
            <View style={styles.textRow}>
              <TextInput
                placeholder="Add text…"
                placeholderTextColor="#aaa"
                style={[styles.textInput, textStyle, textFont, { color: textColor }]}
                value={draftText}
                onChangeText={setDraftText}
              />
              <TouchableOpacity style={styles.addBtn} onPress={addText} activeOpacity={0.7}>
                <Text style={styles.addBtnLabel}>Add</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.textOptionsScroll}
            >
              {DEFAULT_FONTS.map(f => (
                <TouchableOpacity
                  key={f.name}
                  onPress={() => setTextFont(f.style)}
                  style={[
                    styles.fontChip,
                    textFont.fontFamily === f.style.fontFamily && styles.fontChipActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fontChipText, f.style]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
              {[
                '#ffffff',
                '#ff4d4f',
                '#40a9ff',
                '#52c41a',
                '#faad14',
                '#b37feb',
                '#000000',
              ].map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setTextColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    textColor === c && styles.colorDotActive,
                  ]}
                  activeOpacity={0.7}
                />
              ))}
            </ScrollView>
          </KeyboardAvoidingView>
        )}

      </View>
    </Modal>
  );
}

const Tab = ({ icon, label, tabKey, active, onPress }) => (
  <TouchableOpacity style={styles.tabBtn} onPress={() => onPress(tabKey)} activeOpacity={0.7}>
    <Icon name={icon} size={18} color={active ? '#4da3ff' : '#666'} />
    <Text style={[styles.tabLabel, { color: active ? '#4da3ff' : '#666' }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topBtn: { padding: 8 },
  topTitle: { color: '#000', fontSize: 16, fontWeight: '700' },
  nextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#4da3ff',
    borderRadius: 14,
  },
  nextText: { color: '#fff', fontWeight: '700' },

  canvasOuter: {
    flex: 1,
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },
  
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  
  videoWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    overflow: 'hidden',
  },
  
  fullScreenVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  overlayItem: { position: 'absolute' },
  sticker: {
    fontSize: 56,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  textOverlay: {
    fontSize: 28,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    maxWidth: 240,
  },

  thumbBar: {
    position: 'absolute',
    bottom: 75,
    paddingVertical: 8,
    width: '100%',
    zIndex: 5,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumb: { borderColor: '#4da3ff' },
  thumbImg: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },

  tabs: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  tabBtn: { alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 11 },

  bottomTools: {
    position: 'absolute',
    bottom: 55,
    width: '100%',
    paddingTop: 10,
    paddingBottom: 30,
    zIndex: 15,
    // maxHeight: 750,
  },

  // Filters
  filterScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#4da3ff',
  },
  filterLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#fff',
  },

  // Stickers
  stickerScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  stickerPick: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  stickerEmoji: {
    fontSize: 28,
  },

  // Text
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: '#4da3ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnLabel: { 
    fontWeight: '700',
    color: '#fff',
  },

  textOptionsScroll: {
    paddingHorizontal: 12,
    alignItems: 'center',
    paddingBottom: 30
  },
  fontChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  fontChipActive: {
    backgroundColor: '#4da3ff',
  },
  fontChipText: {
    color: '#333',
    fontSize: 13,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#4da3ff',
    borderWidth: 3,
  },
});
