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
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import ImageZoom from 'react-native-image-pan-zoom';
import { captureRef } from 'react-native-view-shot';

import {
  Grayscale,
  Sepia,
  Saturate,
  Contrast,
  Brightness,
} from 'react-native-color-matrix-image-filters';
import { useAppTheme } from '../../../theme/useApptheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT * 0.75);

const FILTERS = [
  { key: 'none', label: 'Original', Comp: React.Fragment },
  { key: 'grayscale', label: 'Grayscale', Comp: Grayscale },
  { key: 'sepia', label: 'Sepia', Comp: Sepia },
  {
    key: 'saturate',
    label: 'Saturate',
    Comp: p => <Saturate amount={2} {...p} />,
  },
  {
    key: 'contrast',
    label: 'Contrast',
    Comp: p => <Contrast amount={1.5} {...p} />,
  },
  {
    key: 'brightness',
    label: 'Bright',
    Comp: p => <Brightness amount={1.25} {...p} />,
  },
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
  allowMultiTouchRelease,
}) => {
  const pan = useRef(
    new Animated.ValueXY({ x: initialX, y: initialY }),
  ).current;

  const responder = useRef(
    PanResponder.create({
      // only single-finger should start drag
      onStartShouldSetPanResponder: e => e.nativeEvent.touches.length === 1,
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length === 1 &&
        (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),

      onPanResponderGrant: () => {
        onStart?.();
        pan.setOffset({ x: pan.x.__getValue(), y: pan.y.__getValue() });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: (e, g) => {
        // If second finger appears mid-drag, allow termination so zoom can take over
        if (allowMultiTouchRelease && e.nativeEvent.touches.length > 1) return;
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(e, g);
      },

      onPanResponderTerminationRequest: e => {
        // If pinch begins (2+ touches), release this responder
        return e.nativeEvent.touches.length > 1;
      },

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
  const [textColor, setTextColor] = useState('#000');
  const [textFont, setTextFont] = useState(DEFAULT_FONTS[0].style);
  const [overlayDragActive, setOverlayDragActive] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [activeTab, setActiveTab] = useState('filters');
  const { bgStyle, textStyle, bg } = useAppTheme();

  const canvasRefs = useRef({}); // for captureRef

  useEffect(() => {
    if (!modalVisible) return;
    // initialize defaults for each media item
    const f = {},
      s = {},
      t = {};
    mediaList.forEach((_, i) => {
      f[i] = f[i] || 'none';
      s[i] = s[i] || [];
      t[i] = t[i] || [];
    });
    setFilterPerIndex(f);
    setStickersPerIndex(s);
    setTextsPerIndex(t);
    setIndex(0);
  }, [modalVisible]);

  const currentMedia = mediaList[index];
  const currentFilterKey = filterPerIndex[index] || 'none';
  const FilterComp =
    FILTERS.find(f => f.key === currentFilterKey)?.Comp || React.Fragment;

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

        // If image: capture the canvas with filter+overlays baked in
        // If video: we can't bake with view-shot; return passthrough + overlays metadata
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
          <Text style={styles.topTitle}>Add story</Text>
          <TouchableOpacity onPress={handleExport} style={styles.nextBtn}>
            <Text style={styles.nextText}>Post</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas */}
        <View
          style={styles.canvasOuter}
          ref={ref => {
            if (ref) canvasRefs.current[index] = ref;
          }}
          collapsable={false}
        >
          {/* Base media with pinch zoom (only for images) */}
          {currentMedia && !isVideo(currentMedia) ? (
            <ImageZoom
              cropWidth={CANVAS_SIZE}
              cropHeight={CANVAS_SIZE}
              imageWidth={CANVAS_SIZE}
              imageHeight={CANVAS_SIZE}
              minScale={0.5}
              maxScale={4}
              pinchToZoom={!overlayDragActive}
              enableDoubleClickZoom={!overlayDragActive}
              onMove={({ scale }) => setZoomScale(scale)}
            >
              <View style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
                <FilterComp>
                  <Image
                    source={{ uri: currentMedia.uri }}
                    style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
                    resizeMode="cover"
                  />
                </FilterComp>
              </View>
            </ImageZoom>
          ) : (
            <View style={styles.videoWrap}>
              <Video
                source={{ uri: currentMedia?.uri }}
                style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
                resizeMode="cover"
                repeat
                muted
              />
            </View>
          )}

          {/* Stickers */}
          {(stickersPerIndex[index] || []).map(s => (
            <Draggable
              key={s.id}
              id={s.id}
              initialX={s.x}
              initialY={s.y}
              onStart={() => setOverlayDragActive(true)}
              onEnd={(x, y) => {
                setOverlayDragActive(false);
                setStickerPos(s.id, x, y);
              }}
              allowMultiTouchRelease
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
              onStart={() => setOverlayDragActive(true)}
              onEnd={(x, y) => {
                setOverlayDragActive(false);
                setTextPos(t.id, x, y);
              }}
              allowMultiTouchRelease
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbBar}
        >
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

        {/* {activeTab === 'filters' && (
          <FlatList
            data={FILTERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={f => f.key}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
            style={{ backgroundColor: '#f8f2fd' }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  setFilterPerIndex(prev => ({ ...prev, [index]: item.key }))
                }
                style={[
                  styles.filterChip,
                  (filterPerIndex[index] || 'none') === item.key &&
                    styles.filterChipActive,
                ]}
              >
                <View style={styles.filterThumb}>
                  <item.Comp>
                    <Image
                      source={{ uri: currentMedia?.uri }}
                      style={styles.filterThumbImg}
                      resizeMode="cover"
                    />
                  </item.Comp>
                </View>
                <Text style={styles.filterLabel}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        )} */}

        {activeTab === 'stickers' && (
          <View style={[styles.bottomTools, { height: 60 }, bgStyle]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}
            >
              {['😀', '😂', '😍', '🔥', '👍', '👏', '😮', '😎', '🥳', '🤍', '💙', '✨', '🌈', '💥', '🍕', '🎉'].map(e => (
                <TouchableOpacity
                  key={e}
                  onPress={() => addSticker(e)}
                  style={[styles.stickerPick, bgStyle]}
                >
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}


        {/* text tools */}
        {activeTab === 'text' && (
          <View style={styles.bottomTools}>
            <View style={styles.textRow}>
              <TextInput
                placeholder="Add text…"
                placeholderTextColor="#aaa"
                style={[styles.textInput, textFont, { color: textColor }]}
                value={draftText}
                onChangeText={setDraftText}
              />
              <TouchableOpacity style={styles.addBtn} onPress={addText}>
                <Text style={[styles.addBtnLabel, {color: bg}]}>Add</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12 }}
            >
              {DEFAULT_FONTS.map(f => (
                <TouchableOpacity
                  key={f.name}
                  onPress={() => setTextFont(f.style)}
                  style={[styles.fontChip, bgStyle]}
                >
                  <Text style={[{ color: '#000' }, f.style]}>{f.name}</Text>
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
                    { backgroundColor: c, borderColor: '#fff' },
                  ]}
                />
              ))}
            </ScrollView>
          </View>
        )}

      </View>
    </Modal>
  );
}

const Tab = ({ icon, label, tabKey, active, onPress }) => (
  <TouchableOpacity style={styles.tabBtn} onPress={() => onPress(tabKey)}>
    <Icon name={icon} size={18} color={active ? '#4da3ff' : '#000'} />
    <Text style={[styles.tabLabel, { color: active ? '#4da3ff' : '#000' }]}>
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
    alignSelf: 'center',
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: '#000',
  },
  videoWrap: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    overflow: 'hidden',
    borderRadius: 4,
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

  thumbBar: { paddingVertical: 8 },
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
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: { alignItems: 'center', gap: 2 },
  tabLabel: { color: '#fff', fontSize: 11 },

  filterChip: {
    width: 84,
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 8,
  },
  filterChipActive: { transform: [{ scale: 1.03 }] },
  filterThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  filterThumbImg: { width: '100%', height: '100%' },
  filterLabel: { marginTop: 6, color: '#fff', fontSize: 12 },

  bottomTools: {
    paddingTop: 6,
    paddingBottom: 10,
  },
  stickerPick: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  addBtn: {
    backgroundColor: '#4da3ff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnLabel: { fontWeight: '700' },

  fontChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
    borderWidth: 2,
  },
});
