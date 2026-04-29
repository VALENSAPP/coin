import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  FlatList,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
  ActivityIndicator,
  AppState,
  Animated,
} from 'react-native';
import { GestureHandlerRootView, Text as GestureText } from 'react-native-gesture-handler';
import Video from 'react-native-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { captureRef } from 'react-native-view-shot';
import { useAppTheme } from '../../../theme/useApptheme';
import ImagePicker from 'react-native-image-crop-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  searchYoutubeMusicTracks,
  getYoutubeSearchApiKey,
} from '../../../services/youtubeMusic';
import StoryInteractiveOverlay from './StoryInteractiveOverlay';
import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  MUSIC_STICKER_CARD_W,
  MUSIC_STICKER_CARD_H,
  clampMusicBadgePosition,
  defaultMusicBadgePosition,
  OVERLAY_MIN_SCALE_STICKER,
  OVERLAY_MIN_SCALE_TEXT,
  OVERLAY_MIN_SCALE_MUSIC,
  OVERLAY_MAX_SCALE,
} from './storyOverlayConstants';

const WAVE_BAR_STEP = 4;

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

const TOOLBAR_ITEMS = [
  { key: 'text', icon: 'text-outline', label: 'Text' },
  { key: 'stickers', icon: 'happy-outline', label: 'Sticker' },
  { key: 'audio', icon: 'musical-notes-outline', label: 'Audio' },
  // Lyrics UI disabled for now — re-enable toolbar + panel + trim block + karaoke overlay below.
  // { key: 'lyrics', icon: 'mic-outline', label: 'Lyrics' },
  { key: 'soundTrim', icon: 'timer-outline', label: 'Sound' },
  // { key: 'addClip', icon: 'add-circle-outline', label: 'Add clip' },
  { key: 'overlay', icon: 'layers-outline', label: 'Overlay' },
  { key: 'filters', icon: 'color-filter-outline', label: 'Effects' },
  { key: 'edit', icon: 'crop-outline', label: 'Edit' },
  { key: 'volume', icon: 'volume-high-outline', label: 'Vol' },
];

/**
 * Built-in quick picks (offline-friendly). Same shape as legacy string ids on `audioPerIndex`.
 */
const AUDIO_LIBRARY = [
  { id: 'original', name: 'Original sound', previewUri: null },
  // Quick-pick tracks are temporarily disabled.
  // {
  //   id: 'vibe',
  //   name: 'Vibe Beat',
  //   previewUri:
  //     'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  // },
  // {
  //   id: 'chill',
  //   name: 'Chill Mood',
  //   previewUri:
  //     'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  // },
  // {
  //   id: 'energy',
  //   name: 'Energy Pop',
  //   previewUri:
  //     'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  // },
];

const isOriginalAudio = a => a == null || a === 'original';

const isYoutubeTrack = a =>
  typeof a === 'object' && a?.source === 'youtube' && a?.videoId;

const getAudioPreviewUri = a => {
  if (isOriginalAudio(a)) return null;
  if (typeof a === 'object' && a?.previewUrl) return a.previewUrl;
  if (typeof a === 'string') {
    return AUDIO_LIBRARY.find(t => t.id === a)?.previewUri ?? null;
  }
  return null;
};

const getAudioTitle = a => {
  if (isOriginalAudio(a)) return 'Original sound';
  if (typeof a === 'object' && a?.title) return a.title;
  if (typeof a === 'object' && a?.trackName) return a.trackName;
  if (typeof a === 'string') {
    return AUDIO_LIBRARY.find(t => t.id === a)?.name || 'Music';
  }
  return 'Music';
};

const getAudioSubtitle = a => {
  if (typeof a === 'object' && a?.artist) return a.artist;
  if (typeof a === 'object' && a?.artistName) return a.artistName;
  if (typeof a === 'object' && a?.channelTitle) return a.channelTitle;
  return null;
};

const getMusicStickerSubtitle = a => {
  const sub = getAudioSubtitle(a);
  if (sub) return sub;
  if (typeof a === 'string' && a !== 'original') return 'Quick pick';
  return '';
};

/** Full track length for trim UI; builtin MP3 previews may be shorter than timeline. */
function getMusicTimelineDurationSec(audioSel, previewDur) {
  const prev = Math.max(0.1, Number(previewDur) || 30);
  if (typeof audioSel === 'object' && audioSel?.fullDurationSec != null) {
    const f = Number(audioSel.fullDurationSec);
    if (Number.isFinite(f) && f > 0) return Math.max(f, prev);
  }
  return prev;
}

/** Intersection of song trim [start, end] with [0, previewDur] for preview playback. */
function getPlaybackWindowInPreview(at, previewDur) {
  const prev = Math.max(0.1, Number(previewDur) || 30);
  const a = Math.max(0, Number(at?.start) || 0);
  const rawEnd = at?.end;
  const b =
    rawEnd == null || rawEnd === '' || !Number.isFinite(Number(rawEnd))
      ? Infinity
      : Number(rawEnd);
  const ovStart = Math.max(0, a);
  const ovEnd = Math.min(b, prev);
  if (ovEnd <= ovStart || ovStart >= prev) {
    return { start: 0, end: prev, hasOverlap: false };
  }
  return { start: ovStart, end: ovEnd, hasOverlap: true };
}

const isYoutubeSelection = (a, videoId) =>
  typeof a === 'object' && a?.source === 'youtube' && a.videoId === videoId;

const LRCLIB_GET = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH = 'https://lrclib.net/api/search';

/** Parse LRC synced lyrics into [{ t: seconds, text }]. */
function parseLrcToSyncedLines(lrc) {
  if (!lrc || typeof lrc !== 'string') return [];
  const out = [];
  const re = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\]\s*([^\r\n]*)/g;
  let m;
  while ((m = re.exec(lrc)) !== null) {
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const centi = parseInt(m[3], 10);
    const t = min * 60 + sec + centi / 100;
    const text = (m[4] || '').trim();
    if (text) out.push({ t, text });
  }
  return out.sort((a, b) => a.t - b.t);
}

function filterSyncedLinesByTrim(lines, trimStart, trimEndSec) {
  if (!lines?.length) return [];
  const t0 = Math.max(0, Number(trimStart) || 0);
  const t1 =
    trimEndSec == null || trimEndSec === '' || !Number.isFinite(Number(trimEndSec))
      ? Infinity
      : Number(trimEndSec);
  return lines.filter(l => l.t >= t0 && l.t < t1);
}

/** Lines whose timed segment [t, nextLine.t) overlaps [trimStart, trimEnd) — better for clip picking than starts-only. */
function filterSyncedLinesIntersectingTrim(lines, trimStart, trimEndSec) {
  if (!lines?.length) return [];
  const sorted = [...lines].sort((a, b) => a.t - b.t);
  const t0 = Math.max(0, Number(trimStart) || 0);
  const t1 =
    trimEndSec == null || trimEndSec === '' || !Number.isFinite(Number(trimEndSec))
      ? Infinity
      : Number(trimEndSec);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const l = sorted[i];
    const nextT = i + 1 < sorted.length ? sorted[i + 1].t : Infinity;
    if (nextT > t0 && l.t < t1) {
      out.push(l);
    }
  }
  return out;
}

/** Instagram-style: rows before trim (dimmed), inside (clear + one “current”), after (dimmed). */
function buildLyricPreviewRows(
  lines,
  trimStart,
  trimEnd,
  nowSec,
  maxBefore = 2,
  maxAfter = 2,
) {
  if (!lines?.length) return [];
  const sorted = [...lines].sort((a, b) => a.t - b.t);
  const t0 = Math.max(0, Number(trimStart) || 0);
  const t1 = trimEnd == null || trimEnd === '' || !Number.isFinite(Number(trimEnd))
    ? Infinity
    : Number(trimEnd);

  let currentLine = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].t <= nowSec) {
      currentLine = sorted[i];
      break;
    }
  }

  const sameLine = (a, b) =>
    a &&
    b &&
    Math.abs(a.t - b.t) < 0.02 &&
    a.text === b.text;

  const before = sorted.filter(l => l.t < t0).slice(-maxBefore);
  const inWin = sorted.filter(l => l.t >= t0 && l.t < t1);
  const after = sorted.filter(l => l.t >= t1).slice(0, maxAfter);

  const mark = (l, zone) => ({
    ...l,
    key: `${l.t}_${l.text}`,
    zone,
    isCurrent: sameLine(l, currentLine),
  });

  return [
    ...before.map(l => mark(l, 'before')),
    ...inWin.map(l => mark(l, 'in')),
    ...after.map(l => mark(l, 'after')),
  ];
}

/** Default story clip length when the track is longer (typical stories use ~15–30s). */
const DEFAULT_STORY_CLIP_SEC = 30;
const MIN_STORY_CLIP_SEC = 15;
const MAX_STORY_CLIP_SEC = 30;
const WAVEFORM_PX_PER_SEC = 12;

function formatTimeMmSs(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

async function fetchLyricsLRCLIB(artist, title) {
  const getUrl = `${LRCLIB_GET}?artist_name=${encodeURIComponent(
    artist,
  )}&track_name=${encodeURIComponent(title)}`;
  let res = await fetch(getUrl);
  if (res.ok) {
    const j = await res.json();
    if (j && (j.plainLyrics || j.syncedLyrics)) return j;
  }
  const searchUrl = `${LRCLIB_SEARCH}?q=${encodeURIComponent(`${title} ${artist}`)}`;
  res = await fetch(searchUrl);
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}

const volMatches = (a, b) => Math.abs((a ?? 1) - b) < 0.001;

const isVideo = asset => {
  if (!asset) return false;
  if (asset.type?.includes('video')) return true;
  const uri = asset.uri || asset.path || '';
  return ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'].some(ext =>
    uri.toLowerCase().includes(ext),
  );
};

/**
 * Gallery + image-crop-picker may return `path` only (no `uri`). Image/Video need a stable `uri`.
 */
function normalizeStoryMediaItem(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const pathOrUri = raw.uri || raw.path || raw.sourceURL;
  let uri = pathOrUri;
  if (typeof uri === 'string') {
    if (
      uri.startsWith('file:') ||
      uri.startsWith('content:') ||
      uri.startsWith('http:') ||
      uri.startsWith('https:') ||
      uri.startsWith('ph://') ||
      uri.startsWith('asset:')
    ) {
      // ok
    } else if (uri.startsWith('/')) {
      uri = `file://${uri}`;
    }
  }
  const mime = raw.mime || raw.type;
  let type = raw.type;
  if (typeof type === 'string') {
    type = type.includes('video')
      ? 'video'
      : type.includes('image')
        ? 'image'
        : type;
  } else if (typeof mime === 'string') {
    type = mime.startsWith('video') ? 'video' : 'image';
  } else {
    type = isVideo({ ...raw, uri }) ? 'video' : 'image';
  }
  return { ...raw, uri, type };
}

export default function StoryComposer({
  modalVisible,
  mediaList = [],
  onCancel,
  onDone,
}) {
  const [mediaItems, setMediaItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [filterPerIndex, setFilterPerIndex] = useState({});
  const [stickersPerIndex, setStickersPerIndex] = useState({});
  const [textsPerIndex, setTextsPerIndex] = useState({});
  const [audioPerIndex, setAudioPerIndex] = useState({});
  const [trimPerIndex, setTrimPerIndex] = useState({});
  const [volumePerIndex, setVolumePerIndex] = useState({});
  const [draftText, setDraftText] = useState('');
  const [editingTextId, setEditingTextId] = useState(null);
  const [textColor, setTextColor] = useState('#fff');
  const [textFont, setTextFont] = useState(DEFAULT_FONTS[0].style);
  const [activeTab, setActiveTab] = useState('none');
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [showAudioTrimModal, setShowAudioTrimModal] = useState(false);
  const [trimStartDraft, setTrimStartDraft] = useState('0');
  const [trimEndDraft, setTrimEndDraft] = useState('');
  const [audioTrimStartDraft, setAudioTrimStartDraft] = useState('0');
  const [audioTrimEndDraft, setAudioTrimEndDraft] = useState('');
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [lyricsPerIndex, setLyricsPerIndex] = useState({});
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState(null);
  const [musicPreviewSec, setMusicPreviewSec] = useState(0);
  const [musicPreviewDur, setMusicPreviewDur] = useState(30);
  const [waveformViewportW, setWaveformViewportW] = useState(SCREEN_WIDTH - 48);
  const [audioTrimPerIndex, setAudioTrimPerIndex] = useState({});
  const [audioTrimConfirmedPerIndex, setAudioTrimConfirmedPerIndex] = useState({});
  const { bgStyle, textStyle, bg } = useAppTheme();
  const insets = useSafeAreaInsets();
  const trashZoneRef = useRef(null);
  const [trashRect, setTrashRect] = useState(null);
  const [, setShowTrashZone] = useState(false);
  const [isOverlayInteracting, setIsOverlayInteracting] = useState(false);
  const [trashHot, setTrashHot] = useState(false);
  const trashZoneScale = useRef(new Animated.Value(1)).current;

  const onTrashHoverChange = useCallback(v => {
    setTrashHot(v);
  }, []);

  const measureTrashZone = useCallback(() => {
    trashZoneRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        // ✅ Use exact measured rect — no inflation or height clamping
        setTrashRect({ x, y, width, height });
      }
    });
  }, []);

  const canvasRefs = useRef({});
  const videoRef = useRef(null);
  const videoDurationRef = useRef(0);
  const musicSearchTimer = useRef(null);
  const musicPreviewRef = useRef(null);
  const youtubePreviewRef = useRef(null);
  const musicPreviewDurationRef = useRef(30);
  const musicTimelineDurationRef = useRef(30);
  const audioTrimPerIndexRef = useRef({});
  const waveformScrollRef = useRef(null);
  const waveformSyncedRef = useRef(false);
  /** Only load `mediaList` into state when the modal opens — avoids wiping “Add clip” items on parent re-renders. */
  const storyModalWasOpenRef = useRef(false);
  const [musicEditorPaused, setMusicEditorPaused] = useState(false);
  const musicEditorPausedRef = useRef(false);
  musicEditorPausedRef.current = musicEditorPaused;
  const [soundTrimClipSec, setSoundTrimClipSec] = useState(DEFAULT_STORY_CLIP_SEC);
  /** Clamped 15–30s window for Sound trim waveform + draft end. */
  const trimClipWindowSec = Math.min(
    MAX_STORY_CLIP_SEC,
    Math.max(MIN_STORY_CLIP_SEC, soundTrimClipSec),
  );
  const [waveformScrollX, setWaveformScrollX] = useState(0);
  const [showMusicTrimAdvanced, setShowMusicTrimAdvanced] = useState(false);
  const [musicBadgePosPerIndex, setMusicBadgePosPerIndex] = useState({});
  const [canvasLayout, setCanvasLayout] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
  });

  const closeSheets = () => {
    setShowAudioModal(false);
    setShowTrimModal(false);
    setShowVolumeModal(false);
    setShowAudioTrimModal(false);
    setActiveTab(prev => (prev === 'text' ? 'none' : prev));
    Keyboard.dismiss();
  };

  useEffect(() => {
    if (!modalVisible) {
      storyModalWasOpenRef.current = false;
      setEditingTextId(null);
      setTrashHot(false);
      setActiveTab('none');
      setShowAudioModal(false);
      setShowTrimModal(false);
      setShowVolumeModal(false);
      setShowAudioTrimModal(false);
      return;
    }
    const justOpened = !storyModalWasOpenRef.current;
    storyModalWasOpenRef.current = true;
    if (!justOpened) return;

    const list = (mediaList || []).map(normalizeStoryMediaItem);
    const f = {},
      s = {},
      t = {},
      a = {},
      tr = {},
      v = {},
      atr = {},
      atc = {};
    setMediaItems(list);
    list.forEach((_, i) => {
      f[i] = 'none';
      s[i] = [];
      t[i] = [];
      a[i] = 'original';
      tr[i] = { start: 0, end: null };
      v[i] = 1;
      atr[i] = { start: 0, end: null };
      atc[i] = false;
    });
    setFilterPerIndex(f);
    setStickersPerIndex(s);
    setTextsPerIndex(t);
    setAudioPerIndex(a);
    setTrimPerIndex(tr);
    setVolumePerIndex(v);
    setAudioTrimPerIndex(atr);
    setAudioTrimConfirmedPerIndex(atc);
    audioTrimPerIndexRef.current = atr;
    setLyricsPerIndex({});
    setLyricsError(null);
    setIndex(0);
    videoDurationRef.current = 0;
    const layout = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.68 };
    const badgePos = {};
    list.forEach((_, i) => {
      badgePos[i] = defaultMusicBadgePosition(layout);
    });
    setMusicBadgePosPerIndex(badgePos);
    setIsOverlayInteracting(false);
    setShowTrashZone(false);
    setEditingTextId(null);
    setActiveTab('none');
  }, [modalVisible, mediaList]);

  /** While Sound trim is open, playback must follow draft start/end (waveform), not saved trim. */
  if (showAudioTrimModal) {
    const start = Math.max(0, Number(audioTrimStartDraft) || 0);
    const endRaw = audioTrimEndDraft.trim();
    const end =
      endRaw === '' || !Number.isFinite(Number(endRaw)) ? null : Number(endRaw);
    audioTrimPerIndexRef.current = {
      ...audioTrimPerIndex,
      [index]: { start, end },
    };
  } else {
    audioTrimPerIndexRef.current = audioTrimPerIndex;
  }

  const currentMedia = mediaItems[index];
  const trimStartCur = trimPerIndex[index]?.start;
  const trimEndCur = trimPerIndex[index]?.end;
  const audioTrimStartCur = audioTrimPerIndex[index]?.start;
  const audioTrimEndCur = audioTrimPerIndex[index]?.end;
  const currentFilterKey = filterPerIndex[index] || 'none';
  const currentFilterOverlay =
    FILTERS.find(f => f.key === currentFilterKey)?.overlay || null;
  const deleteButtonVisible = isOverlayInteracting;

  const hideOverlayDeleteUi = useCallback(() => {
    setIsOverlayInteracting(false);
    setShowTrashZone(false);
    setTrashHot(false);
  }, []);

  const beginOverlayInteraction = useCallback(() => {
    setIsOverlayInteracting(true);
    setShowTrashZone(true);
  }, []);

  useEffect(() => {
    if (!isOverlayInteracting) {
      trashZoneScale.setValue(1);
      return;
    }
    Animated.spring(trashZoneScale, {
      toValue: trashHot ? 1.12 : 1,
      useNativeDriver: true,
      friction: 9,
      tension: 48,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
    }).start();
  }, [isOverlayInteracting, trashHot, trashZoneScale]);

  useEffect(() => {
    if (!currentMedia || !isVideo(currentMedia)) return;
    const tr = trimPerIndex[index] || { start: 0, end: null };
    const start = Math.max(0, Number(tr.start) || 0);
    const t = setTimeout(() => videoRef.current?.seek(start), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trimStartCur/trimEndCur mirror trim for index
  }, [trimStartCur, trimEndCur, index, currentMedia]);

  useEffect(() => {
    setIsOverlayInteracting(false);
    setShowTrashZone(false);
    setEditingTextId(null);
    setTrashHot(false);
  }, [index]);

  useEffect(() => {
    if (showAudioModal) {
      setMusicQuery('');
      setMusicResults([]);
    }
  }, [showAudioModal]);

  useEffect(() => {
    if (!showAudioModal) return;
    if (!musicQuery.trim()) {
      setMusicResults([]);
      setMusicLoading(false);
      return;
    }
    let cancelled = false;
    clearTimeout(musicSearchTimer.current);
    musicSearchTimer.current = setTimeout(async () => {
      if (!getYoutubeSearchApiKey()) {
        setMusicResults([]);
        setMusicLoading(false);
        return;
      }
      setMusicLoading(true);
      setMusicResults([]);
      try {
        const r = await searchYoutubeMusicTracks(musicQuery);
        if (!cancelled) setMusicResults(r);
      } catch {
        if (!cancelled) setMusicResults([]);
      } finally {
        if (!cancelled) setMusicLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(musicSearchTimer.current);
    };
  }, [musicQuery, showAudioModal]);

  const selectBuiltinTrack = track => {
    if (track.id === 'original') {
      setAudioPerIndex(prev => ({ ...prev, [index]: 'original' }));
      setAudioTrimPerIndex(prev => ({ ...prev, [index]: { start: 0, end: null } }));
      setAudioTrimConfirmedPerIndex(prev => ({ ...prev, [index]: true }));
    } else {
      setAudioPerIndex(prev => ({ ...prev, [index]: track.id }));
      setAudioTrimPerIndex(prev => ({
        ...prev,
        [index]: { start: 0, end: DEFAULT_STORY_CLIP_SEC },
      }));
      setAudioTrimConfirmedPerIndex(prev => ({ ...prev, [index]: false }));
    }
    setLyricsPerIndex(prev => ({ ...prev, [index]: null }));
    setShowAudioModal(false);
  };

  const selectYoutubeTrack = item => {
    if (!item?.videoId) return;
    const d =
      item.durationSec != null && Number.isFinite(Number(item.durationSec))
        ? Number(item.durationSec)
        : null;
    if (d != null && d > 0) {
      setMusicPreviewDur(d);
      musicPreviewDurationRef.current = d;
    }
    setAudioPerIndex(prev => ({
      ...prev,
      [index]: {
        source: 'youtube',
        videoId: item.videoId,
        title: item.title,
        artist: item.channelTitle,
        thumbnailUrl: item.thumbnailUrl,
        fullDurationSec: d ?? undefined,
      },
    }));
    setAudioTrimConfirmedPerIndex(prev => ({ ...prev, [index]: false }));
    setAudioTrimPerIndex(prev => ({
      ...prev,
      [index]: {
        start: 0,
        end:
          d != null && Number.isFinite(d) && d > 0
            ? Math.min(d, DEFAULT_STORY_CLIP_SEC)
            : DEFAULT_STORY_CLIP_SEC,
      },
    }));
    setLyricsPerIndex(prev => ({ ...prev, [index]: null }));
    setShowAudioModal(false);
  };

  const loadLyricsForClip = async () => {
    const audio = audioPerIndex[index] ?? 'original';
    if (isOriginalAudio(audio)) {
      setLyricsError('Choose a song first: open Music and pick a track from search.');
      return;
    }
    if (typeof audio === 'string') {
      setLyricsError(
        'Lyrics load for catalog songs from search. Quick picks here are instrumental samples.',
      );
      return;
    }
    const title = getAudioTitle(audio);
    const artist = getAudioSubtitle(audio);
    if (!artist) {
      setLyricsError('This track needs an artist name to find lyrics.');
      return;
    }
    setLyricsLoading(true);
    setLyricsError(null);
    try {
      const raw = await fetchLyricsLRCLIB(artist, title);
      if (!raw || (!raw.plainLyrics && !raw.syncedLyrics)) {
        setLyricsError('No lyrics found. Try another song or edit text manually.');
        setLyricsPerIndex(prev => ({ ...prev, [index]: null }));
        return;
      }
      const syncedLines = raw.syncedLyrics
        ? parseLrcToSyncedLines(raw.syncedLyrics)
        : [];
      setLyricsPerIndex(prev => ({
        ...prev,
        [index]: {
          plainText: raw.plainLyrics || '',
          syncedLines,
          trackName: raw.trackName || title,
          artistName: raw.artistName || artist,
        },
      }));
    } catch (e) {
      setLyricsError(e?.message || 'Could not load lyrics.');
    } finally {
      setLyricsLoading(false);
    }
  };

  /** Time range for lyric chips: library music uses Sound trim; video clips use Edit trim. */
  const getLyricsTrimRangeForClip = () => {
    const aSel = audioPerIndex[index] ?? 'original';
    const useLib =
      !isOriginalAudio(aSel) &&
      (getAudioPreviewUri(aSel) || isYoutubeTrack(aSel));
    if (useLib) {
      const dur = getMusicTimelineDurationSec(aSel, musicPreviewDur);
      const at = audioTrimPerIndex[index] || { start: 0, end: null };
      const t0 = Math.max(0, Number(at.start) || 0);
      let t1 = dur > 0 ? dur : Infinity;
      if (at.end != null && at.end !== '' && Number.isFinite(Number(at.end))) {
        t1 = Math.min(Number(at.end), dur);
      }
      return { t0, t1 };
    }
    const isVid = currentMedia && isVideo(currentMedia);
    const tr = trimPerIndex[index] || { start: 0, end: null };
    const t0 = Math.max(0, Number(tr.start) || 0);
    const dur = isVid ? videoDurationRef.current || 0 : 0;
    if (tr.end == null || tr.end === '') {
      return { t0, t1: dur > 0 ? dur : Infinity };
    }
    const n = Number(tr.end);
    return { t0, t1: Number.isFinite(n) ? n : Infinity };
  };

  const addLyricsToStory = mode => {
    const bundle = lyricsPerIndex[index];
    if (!bundle) {
      Alert.alert('Lyrics', 'Load lyrics first.');
      return;
    }
    const { t0, t1 } = getLyricsTrimRangeForClip();
    const lines = bundle.syncedLines;
    let chunks = [];
    if (mode === 'all-block') {
      if (lines?.length) chunks = lines.map(l => l.text).filter(Boolean);
      else if (bundle.plainText?.trim()) chunks = [bundle.plainText.trim()];
    } else if (mode === 'trim-block' || mode === 'trim-lines') {
      if (lines?.length) {
        chunks = filterSyncedLinesByTrim(lines, t0, t1)
          .map(l => l.text)
          .filter(Boolean);
      } else if (bundle.plainText?.trim()) {
        chunks = [bundle.plainText.trim()];
      }
    }
    if (!chunks.length) {
      Alert.alert(
        'Lyrics',
        'Nothing to add for this range. Adjust Edit (trim) or use full song.',
      );
      return;
    }
    const sep = mode === 'trim-lines' ? '\n' : '\n\n';
    const combined = chunks.join(sep);
    setTextsPerIndex(prev => {
      const next = { ...prev };
      next[index] = [
        ...(next[index] || []),
        {
          id: `${Date.now()}_${Math.random()}`,
          text: combined,
          color: textColor,
          fontFamily: textFont.fontFamily,
          x: 24,
          y: Math.round(SCREEN_HEIGHT * 0.28),
          kind: 'lyrics',
          scale: 1,
          rotation: 0,
        },
      ];
      return next;
    });
  };

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
        {
          id: `${Date.now()}_${Math.random()}`,
          emoji,
          x: 50,
          y: 50,
          scale: 1,
          rotation: 0,
        },
      ];
      return next;
    });
  };

  const addText = () => {
    const t = draftText.trim();
    if (!t) return;
    if (editingTextId) {
      setTextsPerIndex(prev => {
        const next = { ...prev };
        next[index] = (next[index] || []).map(item =>
          item.id === editingTextId
            ? {
              ...item,
              text: t,
              color: textColor,
              fontFamily: textFont.fontFamily,
            }
            : item,
        );
        return next;
      });
      setEditingTextId(null);
    } else {
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
            scale: 1,
            rotation: 0,
          },
        ];
        return next;
      });
    }
    setDraftText('');
    setActiveTab('none');
    Keyboard.dismiss();
  };

  const setStickerTransform = (id, x, y, scaleVal, rotationVal = 0) => {
    setStickersPerIndex(prev => {
      const next = { ...prev };
      next[index] = (next[index] || []).map(s =>
        s.id === id ? { ...s, x, y, scale: scaleVal, rotation: rotationVal } : s,
      );
      return next;
    });
  };

  const deleteSticker = id => {
    setStickersPerIndex(prev => {
      const next = { ...prev };
      next[index] = (next[index] || []).filter(s => s.id !== id);
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

  const removeStickerById = id => {
    setStickersPerIndex(prev => ({
      ...prev,
      [index]: (prev[index] || []).filter(s => s.id !== id),
    }));
  };

  const setTextTransform = (id, x, y, scaleVal, rotationVal = 0) => {
    setTextsPerIndex(prev => {
      const next = { ...prev };
      next[index] = (next[index] || []).map(t =>
        t.id === id ? { ...t, x, y, scale: scaleVal, rotation: rotationVal } : t,
      );
      return next;
    });
  };

  const clearLibraryMusicForClip = () => {
    setAudioPerIndex(prev => ({ ...prev, [index]: 'original' }));
    setMusicBadgePosPerIndex(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const removeTextById = id => {
    setEditingTextId(cur => (cur === id ? null : cur));
    setTextsPerIndex(prev => ({
      ...prev,
      [index]: (prev[index] || []).filter(t => t.id !== id),
    }));
  };

  const removeStickerOverlay = useCallback(id => {
    removeStickerById(id);
  }, []);

  const removeTextOverlay = useCallback(id => {
    removeTextById(id);
  }, []);

  const removeMusicOverlay = useCallback(() => {
    clearLibraryMusicForClip();
  }, []);

  const removeAllLyricsOverlays = () => {
    setTextsPerIndex(prev => ({
      ...prev,
      [index]: (prev[index] || []).filter(t => t.kind !== 'lyrics'),
    }));
  };

  const snapLyricsVertical = place => {
    const y =
      place === 'top'
        ? SCREEN_HEIGHT * 0.12
        : place === 'middle'
          ? SCREEN_HEIGHT * 0.36
          : SCREEN_HEIGHT * 0.58;
    setTextsPerIndex(prev => {
      const next = { ...prev };
      next[index] = (next[index] || []).map(t =>
        t.kind === 'lyrics' ? { ...t, y } : t,
      );
      return next;
    });
  };

  const nudgeLyricsVertical = delta => {
    setTextsPerIndex(prev => {
      const next = { ...prev };
      next[index] = (next[index] || []).map(t =>
        t.kind === 'lyrics'
          ? {
            ...t,
            y: Math.max(0, Math.min(SCREEN_HEIGHT - 160, t.y + delta)),
          }
          : t,
      );
      return next;
    });
  };

  const handleExport = async () => {
    try {
      for (let i = 0; i < mediaItems.length; i++) {
        const clipAudio = audioPerIndex[i] || 'original';
        if (!isOriginalAudio(clipAudio) && audioTrimConfirmedPerIndex[i] !== true) {
          setIndex(i);
          closeSheets();
          const at = audioTrimPerIndex[i] || { start: 0, end: null };
          setAudioTrimStartDraft(String(at.start ?? 0));
          setAudioTrimEndDraft(at.end == null ? '' : String(at.end));
          setShowAudioTrimModal(true);
          Alert.alert(
            'Trim song first',
            'Please trim the song first or choose timing, then tap Done.',
          );
          return;
        }
      }

      const out = [];
      for (let i = 0; i < mediaItems.length; i++) {
        const m = mediaItems[i];
        const isVid = isVideo(m);

        let processedUri = m.uri || m.path;
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

        const clipAudio = audioPerIndex[i] || 'original';
        const rawAudioTrim = audioTrimPerIndex[i] || { start: 0, end: null };
        const audioTrimStart = Math.max(0, Number(rawAudioTrim.start) || 0);
        const parsedAudioTrimEnd =
          rawAudioTrim.end == null || rawAudioTrim.end === ''
            ? null
            : Number(rawAudioTrim.end);
        let normalizedAudioTrim = {
          start: audioTrimStart,
          end:
            parsedAudioTrimEnd != null && Number.isFinite(parsedAudioTrimEnd)
              ? parsedAudioTrimEnd
              : null,
        };

        // If user picked music but skipped Sound trim, cap to default 30s segment.
        if (!isOriginalAudio(clipAudio) && normalizedAudioTrim.end == null) {
          const timelineDur = getMusicTimelineDurationSec(clipAudio, musicPreviewDur);
          const boundedDefaultEnd =
            Number.isFinite(timelineDur) && timelineDur > normalizedAudioTrim.start
              ? Math.min(timelineDur, normalizedAudioTrim.start + DEFAULT_STORY_CLIP_SEC)
              : normalizedAudioTrim.start + DEFAULT_STORY_CLIP_SEC;
          normalizedAudioTrim = {
            start: normalizedAudioTrim.start,
            end: Math.max(normalizedAudioTrim.start + 1, boundedDefaultEnd),
          };
        }

        out.push({
          original: m,
          processedUri,
          filterKey: filterPerIndex[i] || 'none',
          stickers: stickersPerIndex[i] || [],
          texts: textsPerIndex[i] || [],
          audio: clipAudio,
          lyrics: lyricsPerIndex[i] || null,
          trim: trimPerIndex[i] || { start: 0, end: null },
          audioTrim: normalizedAudioTrim,
          volume: volumePerIndex[i] ?? 1,
          isVideo: isVid,
          duration: m.duration,
          musicBadge: musicBadgePosPerIndex[i] || null,
        });
      }

      onDone?.(out);
    } catch (e) {
      Alert.alert('Export failed', e.message || String(e));
    }
  };

  const handleAddClips = async () => {
    try {
      const picked = await ImagePicker.openPicker({
        multiple: true,
        mediaType: 'any',
        maxFiles: 10,
      });
      const picks = Array.isArray(picked) ? picked : [picked];
      if (!picks.length) return;
      const normalizedPicks = picks.map(normalizeStoryMediaItem);
      setMediaItems(prev => {
        const next = [...prev, ...normalizedPicks];
        const base = prev.length;
        setFilterPerIndex(f => {
          const u = { ...f };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = 'none';
          });
          return u;
        });
        setStickersPerIndex(s => {
          const u = { ...s };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = [];
          });
          return u;
        });
        setTextsPerIndex(t => {
          const u = { ...t };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = [];
          });
          return u;
        });
        setAudioPerIndex(a => {
          const u = { ...a };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = 'original';
          });
          return u;
        });
        setTrimPerIndex(tr => {
          const u = { ...tr };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = { start: 0, end: null };
          });
          return u;
        });
        setVolumePerIndex(v => {
          const u = { ...v };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = 1;
          });
          return u;
        });
        setAudioTrimPerIndex(at => {
          const u = { ...at };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = { start: 0, end: null };
          });
          return u;
        });
        setAudioTrimConfirmedPerIndex(at => {
          const u = { ...at };
          normalizedPicks.forEach((_, j) => {
            u[base + j] = false;
          });
          return u;
        });
        return next;
      });
    } catch (e) {
      if (e?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert(
          'Could not add clips',
          e?.message || String(e) || 'Try again or check photo library access.',
        );
      }
    }
  };

  const openTrimEditor = async () => {
    if (!currentMedia) return;

    if (isVideo(currentMedia)) {
      closeSheets();
      setActiveTab('none');
      const trim = trimPerIndex[index] || { start: 0, end: null };
      setTrimStartDraft(String(trim.start ?? 0));
      setTrimEndDraft(trim.end == null ? '' : String(trim.end));
      setShowTrimModal(true);
      return;
    }

    const pathForCrop = currentMedia.path || currentMedia.uri;
    if (!pathForCrop) {
      Alert.alert('Edit', 'Could not open crop for this image.');
      return;
    }

    closeSheets();
    setActiveTab('none');
    try {
      const cropped = await ImagePicker.openCropper({
        path: pathForCrop,
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 0.85,
        cropperActiveWidgetColor: '#4da3ff',
        cropperStatusBarColor: '#000000',
        cropperToolbarColor: '#000000',
        cropperToolbarWidgetColor: '#ffffff',
        enableRotationGesture: true,
      });
      const normalized = normalizeStoryMediaItem(cropped);
      setMediaItems(prev => {
        const next = [...prev];
        next[index] = { ...next[index], ...normalized };
        return next;
      });
    } catch (e) {
      if (e?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Crop failed', e?.message || String(e));
      }
    }
  };

  const handleToolPress = key => {
    // if (key === 'addClip') {
    //   handleAddClips();
    //   return;
    // }
    if (key === 'audio') {
      closeSheets();
      setActiveTab('none');
      setShowAudioModal(true);
      return;
    }
    if (key === 'edit') {
      openTrimEditor();
      return;
    }
    if (key === 'volume') {
      if (!currentMedia || !isVideo(currentMedia)) {
        Alert.alert('Volume', 'Volume applies to video clips.');
        return;
      }
      closeSheets();
      setActiveTab('none');
      setShowVolumeModal(true);
      return;
    }
    // if (key === 'lyrics') {
    //   closeSheets();
    //   setActiveTab('lyrics');
    //   return;
    // }
    if (key === 'soundTrim') {
      const audio = audioPerIndex[index] ?? 'original';
      if (isOriginalAudio(audio) || typeof audio === 'string') {
        Alert.alert(
          'Sound trim',
          'Pick a song from Music (search) first. Trimming sets which part of the preview plays.',
        );
        return;
      }
      closeSheets();
      setActiveTab('none');
      const at = audioTrimPerIndex[index] || { start: 0, end: null };
      const dur = getMusicTimelineDurationSec(audio, musicPreviewDur);
      setAudioTrimStartDraft(String(at.start ?? 0));
      if (at.end != null && at.end !== '') {
        setAudioTrimEndDraft(String(at.end));
      } else if (dur > DEFAULT_STORY_CLIP_SEC) {
        setAudioTrimEndDraft(String(DEFAULT_STORY_CLIP_SEC));
      } else {
        setAudioTrimEndDraft('');
      }
      setShowAudioTrimModal(true);
      return;
    }
    closeSheets();
    if (key === 'overlay') {
      setActiveTab('overlay');
      return;
    }
    setActiveTab(key);
  };

  const audioSel = audioPerIndex[index] ?? 'original';
  const useLibraryMusic = !isOriginalAudio(audioSel);
  const volForVideo = useLibraryMusic
    ? 0
    : volumePerIndex[index] ?? 1;
  const mutedForVideo = useLibraryMusic || volForVideo === 0;
  const musicPreviewUri = getAudioPreviewUri(audioSel);
  const musicPreviewVol = volumePerIndex[index] ?? 1;
  const isYoutubeAudio = isYoutubeTrack(audioSel);
  const hasLibraryMusicPlayback =
    Boolean(musicPreviewUri) || isYoutubeAudio;
  const musicPreviewKey =
    typeof audioSel === 'object' && audioSel?.videoId
      ? `yt_${audioSel.videoId}`
      : String(audioSel);

  /** Sound trim: user hit pause — must silence preview (prop + native) so audio cannot keep playing. */
  const trimPreviewPaused = Boolean(showAudioTrimModal && musicEditorPaused);

  const catalogDurationFromMeta =
    typeof audioSel === 'object' && audioSel?.fullDurationSec != null
      ? Number(audioSel.fullDurationSec)
      : null;

  const musicTimelineDurationSec = useMemo(
    () => getMusicTimelineDurationSec(audioSel, musicPreviewDur),
    [audioSel, musicPreviewDur],
  );
  musicTimelineDurationRef.current = musicTimelineDurationSec;

  /**
   * Sound trim: when the user scrolls the waveform (draft start/end changes), seek the preview
   * to the segment start so playback matches the selection and loops within it.
   */
  useEffect(() => {
    if (!showAudioTrimModal || !hasLibraryMusicPlayback) return;

    const t = setTimeout(() => {
      /** While paused, do not seek — YouTube seekTo / Video resume can restart audio in the background. */
      if (musicEditorPausedRef.current) return;

      const previewDur = musicPreviewDurationRef.current || 30;
      const at = {
        start: Math.max(0, Number(audioTrimStartDraft) || 0),
        end:
          audioTrimEndDraft.trim() === '' ||
            !Number.isFinite(Number(audioTrimEndDraft))
            ? null
            : Number(audioTrimEndDraft),
      };
      const { start: playStart, end: playEnd, hasOverlap } =
        getPlaybackWindowInPreview(at, previewDur);
      if (!hasOverlap || playEnd <= playStart) return;

      if (musicPreviewUri) {
        musicPreviewRef.current?.seek(playStart);
        musicPreviewRef.current?.resume?.();
      }
      if (isYoutubeAudio) {
        youtubePreviewRef.current?.seekTo?.(playStart, true);
      }
      setMusicPreviewSec(playStart);
    }, 150);

    return () => clearTimeout(t);
    // Intentionally omit musicPreviewDur / audioSel: duration metadata updates were re-firing
    // this effect and hammering seek(), which breaks play/pause and playback. Duration changes
    // are handled by Video/Youtube onLoad + onReady seeks instead.
  }, [
    showAudioTrimModal,
    audioTrimStartDraft,
    audioTrimEndDraft,
    index,
    musicPreviewKey,
    hasLibraryMusicPlayback,
    isYoutubeAudio,
    musicPreviewUri,
  ]);

  /** Reset playhead when switching clip or track; do not force 30s — full length comes from metadata / player. */
  useEffect(() => {
    setMusicPreviewSec(0);
  }, [index, musicPreviewKey]);

  /** Seed timeline duration from catalog metadata so the waveform spans the full track immediately. */
  useEffect(() => {
    if (catalogDurationFromMeta == null) return;
    const f = Number(catalogDurationFromMeta);
    if (Number.isFinite(f) && f > 0) {
      setMusicPreviewDur(f);
      musicPreviewDurationRef.current = f;
    }
  }, [catalogDurationFromMeta, musicPreviewKey]);

  useEffect(() => {
    if (!musicPreviewUri) return;
    const at = {
      start: audioTrimStartCur,
      end: audioTrimEndCur,
    };
    const previewDur = musicPreviewDurationRef.current || 30;
    const { start: playStart, hasOverlap } = getPlaybackWindowInPreview(
      at,
      previewDur,
    );
    const seekTo = hasOverlap ? playStart : 0;
    const t = setTimeout(() => {
      musicPreviewRef.current?.seek(seekTo);
      setMusicPreviewSec(seekTo);
    }, 100);
    return () => clearTimeout(t);
  }, [
    audioTrimStartCur,
    audioTrimEndCur,
    index,
    musicPreviewKey,
    musicPreviewUri,
  ]);

  useEffect(() => {
    if (!isYoutubeAudio) return;
    const at = {
      start: audioTrimStartCur,
      end: audioTrimEndCur,
    };
    const previewDur = musicPreviewDurationRef.current || 30;
    const { start: playStart, hasOverlap } = getPlaybackWindowInPreview(
      at,
      previewDur,
    );
    const seekTo = hasOverlap ? playStart : 0;
    const t = setTimeout(() => {
      youtubePreviewRef.current?.seekTo?.(seekTo, true);
      setMusicPreviewSec(seekTo);
    }, 120);
    return () => clearTimeout(t);
  }, [
    audioTrimStartCur,
    audioTrimEndCur,
    index,
    musicPreviewKey,
    isYoutubeAudio,
  ]);

  useEffect(() => {
    if (!isYoutubeAudio || !modalVisible) return;
    const tick = setInterval(() => {
      if (showAudioTrimModal && musicEditorPaused) return;
      const run = async () => {
        try {
          const cur = await youtubePreviewRef.current?.getCurrentTime?.();
          if (typeof cur !== 'number' || Number.isNaN(cur)) return;
          setMusicPreviewSec(cur);
          const dur = musicPreviewDurationRef.current || 180;
          const at = audioTrimPerIndexRef.current[index] || {
            start: 0,
            end: null,
          };
          const { start: playStart, end: playEnd, hasOverlap } =
            getPlaybackWindowInPreview(at, dur);
          const margin = Math.min(
            0.35,
            Math.max(0.08, (playEnd - playStart) * 0.02),
          );
          if (
            hasOverlap &&
            dur > 0 &&
            playEnd > playStart &&
            cur >= playEnd - margin
          ) {
            youtubePreviewRef.current?.seekTo?.(playStart, true);
            setMusicPreviewSec(playStart);
          }
        } catch (_) { }
      };
      run();
    }, 280);
    return () => clearInterval(tick);
  }, [
    audioSel,
    index,
    modalVisible,
    showAudioTrimModal,
    musicEditorPaused,
    musicPreviewKey,
    isYoutubeAudio,
  ]);

  const waveformSegmentSec = Math.min(
    trimClipWindowSec,
    Math.max(0.1, musicTimelineDurationSec),
  );
  const waveformContentW = Math.max(
    1,
    musicTimelineDurationSec * WAVEFORM_PX_PER_SEC,
  );
  const waveformWindowPx = waveformSegmentSec * WAVEFORM_PX_PER_SEC;
  const waveDimSide = Math.max(0, (waveformViewportW - waveformWindowPx) / 2);

  const onWaveformScroll = e => {
    const scrollX = e.nativeEvent.contentOffset.x;
    setWaveformScrollX(scrollX);
    const duration = musicTimelineDurationSec;
    if (duration <= 0) return;
    const segmentSec = Math.min(trimClipWindowSec, duration);
    const pxPerSec = WAVEFORM_PX_PER_SEC;
    const viewportW = waveformViewportW;
    const windowW = segmentSec * pxPerSec;
    const maxStart = Math.max(0, duration - segmentSec);
    const leftEdge = scrollX + viewportW / 2 - windowW / 2;
    let startSec = leftEdge / pxPerSec;
    startSec = Math.max(0, Math.min(startSec, maxStart));
    const endSec = Math.min(startSec + segmentSec, duration);
    setAudioTrimStartDraft(startSec.toFixed(2));
    setAudioTrimEndDraft(endSec.toFixed(2));
  };

  useEffect(() => {
    if (showAudioTrimModal) {
      waveformSyncedRef.current = false;
      setMusicEditorPaused(false);
      setShowMusicTrimAdvanced(false);
      setSoundTrimClipSec(DEFAULT_STORY_CLIP_SEC);
    }
  }, [showAudioTrimModal]);

  const applySoundTrimClipLength = nextSec => {
    const bounded = Math.min(
      MAX_STORY_CLIP_SEC,
      Math.max(MIN_STORY_CLIP_SEC, Math.round(Number(nextSec) || DEFAULT_STORY_CLIP_SEC)),
    );
    setSoundTrimClipSec(bounded);
    const duration = musicTimelineDurationSec;
    if (duration <= 0) return;
    const start = Math.max(0, Number(audioTrimStartDraft) || 0);
    const maxStart = Math.max(0, duration - bounded);
    const clampedStart = Math.min(start, maxStart);
    const end = Math.min(clampedStart + bounded, duration);
    setAudioTrimStartDraft(clampedStart.toFixed(2));
    setAudioTrimEndDraft(end.toFixed(2));
    waveformSyncedRef.current = false;
    setTimeout(() => {
      const d = musicTimelineDurationRef.current || duration;
      const vw = waveformViewportW;
      if (vw < 24 || !d) return;
      const seg = Math.min(bounded, d);
      const pxPerSec = WAVEFORM_PX_PER_SEC;
      const windowW = seg * pxPerSec;
      const contentW = d * pxPerSec;
      const leftPx = clampedStart * pxPerSec;
      const maxScroll = Math.max(0, contentW - vw);
      const scrollX = Math.max(
        0,
        Math.min(maxScroll, leftPx - vw / 2 + windowW / 2),
      );
      waveformScrollRef.current?.scrollTo({ x: scrollX, animated: true });
      setWaveformScrollX(scrollX);
    }, 80);
  };

  const handleTrimPlayPause = () => {
    setMusicEditorPaused(prev => !prev);
  };

  /**
   * While Sound trim is open and user taps Pause, we unmount preview players (see JSX). WebView +
   * native decoders often keep audible audio when only play/pause/volume props change.
   */

  /** Stop preview when app leaves foreground (avoids “music in background” while editing trim). */
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') return;
      if (showAudioTrimModal) {
        setMusicEditorPaused(true);
      }
    });
    return () => sub.remove();
  }, [showAudioTrimModal]);

  const cancelMusicTrim = () => {
    const at = audioTrimPerIndex[index] || { start: 0, end: null };
    setAudioTrimStartDraft(String(at.start ?? 0));
    setAudioTrimEndDraft(at.end == null ? '' : String(at.end));
    setShowAudioTrimModal(false);
    setMusicEditorPaused(false);
  };

  const onMusicTrimDone = () => {
    setAudioTrimPerIndex(prev => ({
      ...prev,
      [index]: {
        start: Number(audioTrimStartDraft) || 0,
        end: audioTrimEndDraft.trim() ? Number(audioTrimEndDraft) || null : null,
      },
    }));
    setAudioTrimConfirmedPerIndex(prev => ({ ...prev, [index]: true }));
    setShowAudioTrimModal(false);
    setMusicEditorPaused(false);
  };

  const igSegStart = Number(audioTrimStartDraft) || 0;
  const igSegEnd =
    audioTrimEndDraft.trim() === ''
      ? musicTimelineDurationSec
      : Math.min(
        Number(audioTrimEndDraft) || musicTimelineDurationSec,
        musicTimelineDurationSec,
      );
  const igSegmentProgress =
    igSegEnd > igSegStart
      ? Math.max(
        0,
        Math.min(
          1,
          (musicPreviewSec - igSegStart) / (igSegEnd - igSegStart),
        ),
      )
      : 0;

  const trackArtworkUri =
    typeof audioSel === 'object' &&
      (audioSel?.artworkUrl100 || audioSel?.artworkUrl60 || audioSel?.thumbnailUrl)
      ? audioSel.artworkUrl100 ||
      audioSel.artworkUrl60 ||
      audioSel.thumbnailUrl
      : null;

  if (!modalVisible) return null;

  const musicBadgeStored = musicBadgePosPerIndex[index];
  const musicBadgeX =
    musicBadgeStored?.x ?? defaultMusicBadgePosition(canvasLayout).x;
  const musicBadgeY =
    musicBadgeStored?.y ?? defaultMusicBadgePosition(canvasLayout).y;
  const musicBadgeScale = musicBadgeStored?.scale ?? 1;
  const musicBadgeRotation = musicBadgeStored?.rotation ?? 0;

  return (
    <Modal
      visible={modalVisible}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
    >
      <GestureHandlerRootView style={styles.modalRoot}>
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

          <View style={styles.stageColumn}>
            {/* Canvas - Full Screen */}
            <View
              style={styles.canvasOuter}
              ref={ref => {
                if (ref) canvasRefs.current[index] = ref;
              }}
              onLayout={e => {
                const { width, height } = e.nativeEvent.layout;
                setCanvasLayout({ width, height });
                requestAnimationFrame(() => measureTrashZone());
              }}
              collapsable={false}
            >
              {useLibraryMusic && musicPreviewUri && !trimPreviewPaused ? (
                <Video
                  ref={musicPreviewRef}
                  key={`music_${index}_${musicPreviewKey}`}
                  source={{ uri: musicPreviewUri }}
                  style={styles.hiddenMusicPlayer}
                  repeat={false}
                  muted={false}
                  paused={false}
                  volume={musicPreviewVol}
                  resizeMode="contain"
                  ignoreSilentSwitch="ignore"
                  playInBackground={false}
                  playWhenInactive={false}
                  onLoad={data => {
                    const loaded = data?.duration || 30;
                    musicPreviewDurationRef.current = loaded;
                    setMusicPreviewDur(loaded);
                    const at = audioTrimPerIndexRef.current[index] || {
                      start: 0,
                      end: null,
                    };
                    const dur = musicPreviewDurationRef.current;
                    const { start: playStart, end: playEnd, hasOverlap } =
                      getPlaybackWindowInPreview(at, dur);
                    if (!hasOverlap) {
                      setTimeout(() => {
                        musicPreviewRef.current?.seek(0);
                        setMusicPreviewSec(0);
                      }, 80);
                      return;
                    }
                    let seekTo = playStart;
                    if (dur > 0 && playEnd > playStart && seekTo >= playEnd) {
                      seekTo = Math.max(0, playEnd - 0.3);
                    }
                    setTimeout(() => {
                      musicPreviewRef.current?.seek(seekTo);
                      setMusicPreviewSec(seekTo);
                    }, 80);
                  }}
                  onProgress={({ currentTime }) => {
                    setMusicPreviewSec(currentTime);
                    const dur = musicPreviewDurationRef.current || 30;
                    const at = audioTrimPerIndexRef.current[index] || {
                      start: 0,
                      end: null,
                    };
                    const { start: playStart, end: playEnd, hasOverlap } =
                      getPlaybackWindowInPreview(at, dur);
                    const margin = Math.min(0.35, Math.max(0.08, (playEnd - playStart) * 0.02));
                    if (
                      hasOverlap &&
                      dur > 0 &&
                      playEnd > playStart &&
                      currentTime >= playEnd - margin
                    ) {
                      musicPreviewRef.current?.seek(playStart);
                      setMusicPreviewSec(playStart);
                    }
                  }}
                  onEnd={() => {
                    const at = audioTrimPerIndexRef.current[index] || {
                      start: 0,
                      end: null,
                    };
                    const dur = musicPreviewDurationRef.current || 30;
                    const { start: playStart, hasOverlap } = getPlaybackWindowInPreview(
                      at,
                      dur,
                    );
                    if (hasOverlap) {
                      musicPreviewRef.current?.seek(playStart);
                      setMusicPreviewSec(playStart);
                    }
                  }}
                  onError={e => {
                    console.warn('[StoryComposer] music preview failed', e);
                  }}
                />
              ) : null}
              {useLibraryMusic && isYoutubeAudio && !trimPreviewPaused ? (
                <View style={styles.hiddenYoutubePlayer} pointerEvents="none">
                  <YoutubePlayer
                    ref={youtubePreviewRef}
                    key={`yt_music_${index}_${musicPreviewKey}`}
                    height={200}
                    width={200}
                    videoId={audioSel.videoId}
                    play={true}
                    mute={false}
                    volume={Math.round(Math.min(1, Math.max(0, musicPreviewVol)) * 100)}
                    initialPlayerParams={{
                      controls: false,
                      modestbranding: true,
                      rel: false,
                    }}
                    onReady={async () => {
                      try {
                        const d = await youtubePreviewRef.current?.getDuration?.();
                        if (typeof d === 'number' && d > 0 && Number.isFinite(d)) {
                          musicPreviewDurationRef.current = d;
                          setMusicPreviewDur(d);
                        } else if (audioSel?.fullDurationSec) {
                          const f = Number(audioSel.fullDurationSec);
                          if (Number.isFinite(f) && f > 0) {
                            musicPreviewDurationRef.current = f;
                            setMusicPreviewDur(f);
                          }
                        }
                        const at = audioTrimPerIndexRef.current[index] || {
                          start: 0,
                          end: null,
                        };
                        const dur = musicPreviewDurationRef.current || 180;
                        const { start: playStart, end: playEnd, hasOverlap } =
                          getPlaybackWindowInPreview(at, dur);
                        if (!hasOverlap) {
                          youtubePreviewRef.current?.seekTo?.(0, true);
                          setMusicPreviewSec(0);
                          return;
                        }
                        let seekTo = playStart;
                        if (dur > 0 && playEnd > playStart && seekTo >= playEnd) {
                          seekTo = Math.max(0, playEnd - 0.3);
                        }
                        youtubePreviewRef.current?.seekTo?.(seekTo, true);
                        setMusicPreviewSec(seekTo);
                      } catch (e) {
                        console.warn('[StoryComposer] YouTube onReady', e);
                      }
                    }}
                    onError={e => {
                      console.warn('[StoryComposer] YouTube player error', e);
                    }}
                  />
                </View>
              ) : null}
              {currentMedia && !isVideo(currentMedia) ? (
                <View style={styles.imageContainer} pointerEvents="box-none">
                  <Image
                    pointerEvents="none"
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
                  {useLibraryMusic ? (
                    <StoryInteractiveOverlay
                      key={`music_sticker_${index}`}
                      initialX={musicBadgeX}
                      initialY={musicBadgeY}
                      initialScale={musicBadgeScale}
                      initialRotation={musicBadgeRotation}
                      minScale={OVERLAY_MIN_SCALE_MUSIC}
                      zIndex={24}
                      trashRect={trashRect}
                      onDragActive={setShowTrashZone}
                      onInteractionStart={beginOverlayInteraction}
                      onInteractionEnd={hideOverlayDeleteUi}
                      onCommit={(x, y, sc, rot) => {
                        const p = clampMusicBadgePosition(x, y, canvasLayout, sc);
                        setMusicBadgePosPerIndex(prev => ({
                          ...prev,
                          [index]: { x: p.x, y: p.y, scale: sc, rotation: rot },
                        }));
                      }}
                      onDelete={removeMusicOverlay}
                      onTrashHoverChange={onTrashHoverChange}
                    >
                      <View style={styles.musicStickerCard}>
                        {trackArtworkUri ? (
                          <Image
                            source={{ uri: trackArtworkUri }}
                            style={styles.musicStickerArt}
                          />
                        ) : (
                          <View style={styles.musicStickerArtPlaceholder}>
                            <Icon name="musical-notes" size={22} color="#8e8e93" />
                          </View>
                        )}
                        <View style={styles.musicStickerTexts}>
                          <Text style={styles.musicStickerTitle} numberOfLines={1}>
                            {getAudioTitle(audioSel)}
                          </Text>
                          <Text style={styles.musicStickerArtist} numberOfLines={1}>
                            {getMusicStickerSubtitle(audioSel) || ' '}
                          </Text>
                        </View>
                      </View>
                    </StoryInteractiveOverlay>
                  ) : null}
                </View>
              ) : currentMedia ? (
                <View style={styles.videoWrap} pointerEvents="box-none">
                  <Video
                    pointerEvents="none"
                    ref={videoRef}
                    key={`story_vid_${index}_${currentMedia.uri}`}
                    source={{ uri: currentMedia.uri }}
                    style={styles.fullScreenVideo}
                    resizeMode="cover"
                    repeat={false}
                    muted={mutedForVideo}
                    volume={volForVideo}
                    onLoad={data => {
                      videoDurationRef.current = data?.duration || 0;
                      const tr = trimPerIndex[index] || { start: 0, end: null };
                      const dur = data?.duration || 0;
                      let start = Math.max(0, Number(tr.start) || 0);
                      let end =
                        tr.end == null || tr.end === ''
                          ? dur
                          : Math.min(Number(tr.end) || dur, dur);
                      if (dur > 0 && end > 0 && start >= end) {
                        start = Math.max(0, end - 0.25);
                      }
                      if (dur > 0) {
                        setTimeout(() => videoRef.current?.seek(start), 80);
                      }
                    }}
                    onProgress={({ currentTime }) => {
                      const dur =
                        videoDurationRef.current > 0
                          ? videoDurationRef.current
                          : 0;
                      const tr = trimPerIndex[index] || { start: 0, end: null };
                      const start = Math.max(0, Number(tr.start) || 0);
                      const end =
                        tr.end == null || tr.end === ''
                          ? dur
                          : Math.min(Number(tr.end) || dur, dur || 999999);
                      if (dur <= 0 || end <= start) return;
                      if (currentTime >= end - 0.12) {
                        videoRef.current?.seek(start);
                      }
                    }}
                    onEnd={() => {
                      const tr = trimPerIndex[index] || { start: 0, end: null };
                      const start = Math.max(0, Number(tr.start) || 0);
                      videoRef.current?.seek(start);
                    }}
                  />
                  {useLibraryMusic ? (
                    <StoryInteractiveOverlay
                      key={`music_sticker_${index}`}
                      initialX={musicBadgeX}
                      initialY={musicBadgeY}
                      initialScale={musicBadgeScale}
                      initialRotation={musicBadgeRotation}
                      minScale={OVERLAY_MIN_SCALE_MUSIC}
                      zIndex={24}
                      trashRect={trashRect}
                      onDragActive={setShowTrashZone}
                      onInteractionStart={beginOverlayInteraction}
                      onInteractionEnd={hideOverlayDeleteUi}
                      onCommit={(x, y, sc, rot) => {
                        const p = clampMusicBadgePosition(x, y, canvasLayout, sc);
                        setMusicBadgePosPerIndex(prev => ({
                          ...prev,
                          [index]: { x: p.x, y: p.y, scale: sc, rotation: rot },
                        }));
                      }}
                      onDelete={removeMusicOverlay}
                      onTrashHoverChange={onTrashHoverChange}
                    >
                      <View style={styles.musicStickerCard}>
                        {trackArtworkUri ? (
                          <Image
                            source={{ uri: trackArtworkUri }}
                            style={styles.musicStickerArt}
                          />
                        ) : (
                          <View style={styles.musicStickerArtPlaceholder}>
                            <Icon name="musical-notes" size={22} color="#8e8e93" />
                          </View>
                        )}
                        <View style={styles.musicStickerTexts}>
                          <Text style={styles.musicStickerTitle} numberOfLines={1}>
                            {getAudioTitle(audioSel)}
                          </Text>
                          <Text style={styles.musicStickerArtist} numberOfLines={1}>
                            {getMusicStickerSubtitle(audioSel) || ' '}
                          </Text>
                        </View>
                      </View>
                    </StoryInteractiveOverlay>
                  ) : null}
                </View>
              ) : null}

              {/* Karaoke / lyrics preview overlay — disabled with Lyrics section for now
          {lyricPreviewRows.length > 0 && !showAudioTrimModal ? (
            <View style={styles.karaokeOverlay} pointerEvents="none">
              <View style={styles.karaokeStack}>
                {lyricPreviewRows.map(row => (
                  <Text
                    key={row.key}
                    numberOfLines={4}
                    style={[
                      styles.karaokeLineBase,
                      row.zone === 'in' && styles.karaokeLineIn,
                      row.zone !== 'in' && styles.karaokeLineFaded,
                      row.isCurrent && styles.karaokeLineActive,
                    ]}
                  >
                    {row.text}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          */}

              {/* Stickers */}
              {(stickersPerIndex[index] || []).map(s => (
                <StoryInteractiveOverlay
                  key={s.id}
                  initialX={s.x}
                  initialY={s.y}
                  initialScale={s.scale ?? 1}
                  initialRotation={s.rotation ?? 0}
                  minScale={OVERLAY_MIN_SCALE_STICKER}
                  zIndex={14}
                  trashRect={trashRect}
                  onDragActive={setShowTrashZone}
                  onInteractionStart={beginOverlayInteraction}
                  onInteractionEnd={hideOverlayDeleteUi}
                  onCommit={(x, y, sc, rot) => setStickerTransform(s.id, x, y, sc, rot)}
                  onDelete={() => removeStickerOverlay(s.id)}
                  onTrashHoverChange={onTrashHoverChange}
                >
                  <View style={styles.stickerHitArea} collapsable={false}>
                    <GestureText style={styles.sticker}>{s.emoji}</GestureText>
                  </View>
                </StoryInteractiveOverlay>
              ))}

              {/* Text overlays */}
              {(textsPerIndex[index] || []).map(t => (
                <StoryInteractiveOverlay
                  key={t.id}
                  initialX={t.x}
                  initialY={t.y}
                  initialScale={t.scale ?? 1}
                  initialRotation={t.rotation ?? 0}
                  minScale={OVERLAY_MIN_SCALE_TEXT}
                  zIndex={16}
                  trashRect={trashRect}
                  onDragActive={setShowTrashZone}
                  onInteractionStart={beginOverlayInteraction}
                  onInteractionEnd={hideOverlayDeleteUi}
                  onCommit={(x, y, sc, rot) => setTextTransform(t.id, x, y, sc, rot)}
                  onDelete={() => removeTextOverlay(t.id)}
                  onSingleTap={
                    t.kind === 'lyrics'
                      ? undefined
                      : () => {
                        setEditingTextId(t.id);
                        setDraftText(t.text);
                        setTextColor(t.color || '#fff');
                        const match = DEFAULT_FONTS.find(
                          f2 => f2.style.fontFamily === t.fontFamily,
                        );
                        setTextFont(
                          match
                            ? match.style
                            : t.fontFamily
                              ? { fontFamily: t.fontFamily }
                              : DEFAULT_FONTS[0].style,
                        );
                        setActiveTab('text');
                      }
                  }
                  onTrashHoverChange={onTrashHoverChange}
                  shrinkOnTrashHover
                >
                  <View style={styles.textOverlayHitArea} collapsable={false}>
                    <GestureText
                      style={[
                        styles.textOverlay,
                        { color: t.color, fontFamily: t.fontFamily },
                      ]}
                    >
                      {t.text}
                    </GestureText>
                  </View>
                </StoryInteractiveOverlay>
              ))}

              {/* Instagram-style trash — drop stickers/text/music here to remove */}
              <View
                ref={trashZoneRef}
                pointerEvents="none"
                onLayout={() => { measureTrashZone(); }}
                style={[
                  styles.storyTrashZone,
                  {
                    paddingBottom: Math.max(6, insets.bottom + 2), // ✅ was insets.bottom + 6
                    opacity: deleteButtonVisible ? 1 : 0,
                  },
                ]}
              >
                <Animated.View
                  style={{
                    transform: [{ scale: trashZoneScale }],
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {/* "Drag to delete" hint at top */}
                  <Text
                    style={[
                      styles.storyTrashHint,
                      deleteButtonVisible &&
                      (trashHot ? styles.storyTrashHintActive : styles.storyTrashHintDrag),
                    ]}
                  >
                    Drag to delete
                  </Text>

                  {/* Circular trash zone like Instagram */}
                  <View
                    style={[
                      styles.trashCircle,
                      trashHot && styles.trashCircleHot,
                    ]}
                  >
                    <Icon
                      name="trash"
                      size={20}
                      color={trashHot ? '#ff4d6a' : 'rgba(255,255,255,0.9)'}
                    />
                  </View>
                </Animated.View>
              </View>
            </View>

            {/* Clips strip — hidden for now (thumbnails + add) */}
            {/* {mediaItems.length > 0 && (
          <View style={styles.clipStripContainer}>
            <View style={styles.clipStripHeader}>
              <Text style={styles.clipStripTitle}>Clips</Text>
              <Text style={styles.clipStripCount}>
                {index + 1} / {mediaItems.length}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbScrollContent}
              style={styles.thumbBar}>
              {mediaItems.map((m, i) => (
                <TouchableOpacity
                  key={`thumb_${m.uri || m.path || i}`}
                  onPress={() => setIndex(i)}
                  style={[styles.thumb, index === i && styles.activeThumb]}
                >
                  <Image
                    source={{ uri: m.uri || m.path }}
                    style={styles.thumbImg}
                  />
                  {isVideo(m) && (
                    <View style={styles.videoBadge}>
                      <Icon name="videocam" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={handleAddClips}
                style={[styles.thumb, styles.thumbAdd]}
                accessibilityLabel="Add another clip"
                accessibilityRole="button"
              >
                <Icon name="add" size={28} color="#4da3ff" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )} */}

            {/* Filters panel — above bottom dock so clip thumbnails are not covered */}
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

            {/* Stickers / overlay layers */}
            {(activeTab === 'stickers' || activeTab === 'overlay') && (
              <View style={[styles.bottomTools, bgStyle]}>
                {activeTab === 'overlay' ? (
                  <Text style={styles.overlayHint}>
                    Drag stickers and text on the preview. Use Text for captions.
                  </Text>
                ) : null}
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

          </View>

          <SafeAreaView
            edges={['bottom']}
            style={[styles.tabs, bgStyle, { borderTopColor: bg }]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              scrollEnabled
              keyboardShouldPersistTaps="handled"
              style={styles.toolbarScrollView}
              contentContainerStyle={styles.toolbarScroll}
            >
              {TOOLBAR_ITEMS.map(item => {
                const active =
                  activeTab === item.key ||
                  (showAudioModal && item.key === 'audio') ||
                  (showTrimModal && item.key === 'edit') ||
                  (showVolumeModal && item.key === 'volume') ||
                  (showAudioTrimModal && item.key === 'soundTrim');
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.tabBtn, active && styles.tabBtnActive]}
                    onPress={() => handleToolPress(item.key)}
                    activeOpacity={0.75}
                  >
                    <Icon name={item.icon} size={17} color={active ? '#4da3ff' : '#555'} />
                    <Text
                      style={[styles.tabLabel, active && styles.tabLabelActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>

          {/* Bottom Lyrics panel — disabled for now (see TOOLBAR_ITEMS lyrics entry)
        {activeTab === 'lyrics' && (
          <View style={[styles.bottomTools, bgStyle]}>
            <ScrollView
              style={styles.lyricsPanelScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text style={styles.lyricsPanelTitle}>Lyrics</Text>
              <Text style={styles.lyricsPanelHint}>
                Pick a song from Music (search), then load lyrics. Use Sound to trim the music
                segment; video clips also use Edit (trim) for the visual clip.
              </Text>
              <View style={styles.lyricsPositionRow}>
                <Text style={styles.lyricsPositionLabel}>Position</Text>
                <View style={styles.lyricsPositionBtns}>
                  <TouchableOpacity
                    style={styles.lyricsMiniBtn}
                    onPress={() => snapLyricsVertical('top')}
                  >
                    <Text style={styles.lyricsMiniBtnText}>Top</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lyricsMiniBtn}
                    onPress={() => snapLyricsVertical('middle')}
                  >
                    <Text style={styles.lyricsMiniBtnText}>Mid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lyricsMiniBtn}
                    onPress={() => snapLyricsVertical('bottom')}
                  >
                    <Text style={styles.lyricsMiniBtnText}>Bottom</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lyricsMiniBtn}
                    onPress={() => nudgeLyricsVertical(-48)}
                  >
                    <Icon name="chevron-up" size={18} color="#4da3ff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.lyricsMiniBtn}
                    onPress={() => nudgeLyricsVertical(48)}
                  >
                    <Icon name="chevron-down" size={18} color="#4da3ff" />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={styles.lyricsRemoveAllBtn}
                onPress={removeAllLyricsOverlays}
                activeOpacity={0.75}
              >
                <Icon name="trash-outline" size={18} color="#c41c1c" />
                <Text style={styles.lyricsRemoveAllText}>Remove all lyric blocks</Text>
              </TouchableOpacity>
              <View style={styles.lyricsRow}>
                <TouchableOpacity
                  style={styles.lyricsLoadBtn}
                  onPress={loadLyricsForClip}
                  disabled={lyricsLoading}
                >
                  {lyricsLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.lyricsLoadBtnText}>Load / refresh lyrics</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.karaokeToggle}>
                  <Text style={styles.karaokeToggleLabel}>Karaoke</Text>
                  <Switch
                    value={karaokeOverlay}
                    onValueChange={setKaraokeOverlay}
                    trackColor={{ false: '#ccc', true: '#a6d4ff' }}
                    thumbColor={karaokeOverlay ? '#4da3ff' : '#f4f4f4'}
                  />
                </View>
              </View>
              {lyricsError ? <Text style={styles.lyricsErrorText}>{lyricsError}</Text> : null}
              {lyricsBundle && !lyricsLoading ? (
                <Text style={styles.lyricsMetaOk}>
                  {lyricsBundle.trackName}
                  {lyricsBundle.artistName ? ` · ${lyricsBundle.artistName}` : ''}
                </Text>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.lyricsActionsRow}
              >
                <TouchableOpacity
                  style={styles.lyricsActionChip}
                  onPress={() => addLyricsToStory('trim-block')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.lyricsActionChipText}>Trim · spaced</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.lyricsActionChip}
                  onPress={() => addLyricsToStory('trim-lines')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.lyricsActionChipText}>Trim · compact</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.lyricsActionChip}
                  onPress={() => addLyricsToStory('all-block')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.lyricsActionChipText}>Full song</Text>
                </TouchableOpacity>
              </ScrollView>
            <Text style={styles.lyricsFootnote}>
              Drag lyrics to move. Tap × or long-press to remove. Sound trim updates the waveform
              segment and keeps lyrics in sync with that range (Karaoke).
            </Text>
            </ScrollView>
          </View>
        )}
        */}

          {(showAudioModal ||
            showTrimModal ||
            showVolumeModal ||
            activeTab === 'text') && (
            <View style={styles.sheetHost} pointerEvents="box-none">
              <Pressable style={styles.sheetBackdropPress} onPress={closeSheets} />
              <View style={styles.sheetCardWrap} pointerEvents="box-none">
                <View style={styles.sheetCard}>
                  {showAudioModal && (
                    <View style={styles.musicSheetInner}>
                      <Text style={styles.sheetTitle}>Music</Text>
                      <Text style={styles.sheetSub}>
                        Search songs and choose a track for your story.
                      </Text>
                      {!getYoutubeSearchApiKey() ? (
                        <Text style={styles.sheetApiKeyHint}>
                          Song search is currently unavailable. You can still use Quick picks below.
                        </Text>
                      ) : null}
                      <TextInput
                        placeholder="Search artist or song…"
                        placeholderTextColor="#999"
                        style={styles.musicSearchInput}
                        value={musicQuery}
                        onChangeText={setMusicQuery}
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                      <FlatList
                        style={styles.musicResultsList}
                        keyboardShouldPersistTaps="handled"
                        data={musicQuery.trim() ? musicResults : []}
                        keyExtractor={it => String(it.videoId)}
                        ListHeaderComponent={
                          !musicQuery.trim() ? (
                            <View style={styles.quickPickBlock}>
                              <Text style={styles.quickPickTitle}>Quick picks</Text>
                              {AUDIO_LIBRARY.map(track => {
                                const sel = audioPerIndex[index];
                                const selected =
                                  track.id === 'original'
                                    ? isOriginalAudio(sel)
                                    : sel === track.id;
                                return (
                                  <TouchableOpacity
                                    key={track.id}
                                    style={styles.sheetRow}
                                    onPress={() => selectBuiltinTrack(track)}
                                    activeOpacity={0.7}
                                  >
                                    <Icon
                                      name="musical-note"
                                      size={18}
                                      color="#4da3ff"
                                    />
                                    <Text style={styles.sheetRowText}>{track.name}</Text>
                                    {selected ? (
                                      <Icon
                                        name="checkmark-circle"
                                        size={18}
                                        color="#4da3ff"
                                      />
                                    ) : null}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ) : null
                        }
                        renderItem={({ item }) => {
                          const sel = audioPerIndex[index];
                          const selected = isYoutubeSelection(sel, item.videoId);
                          return (
                            <TouchableOpacity
                              style={styles.itunesRow}
                              onPress={() => selectYoutubeTrack(item)}
                              activeOpacity={0.7}
                            >
                              {item.thumbnailUrl ? (
                                <Image
                                  source={{
                                    uri: item.thumbnailUrl,
                                  }}
                                  style={styles.itunesArtwork}
                                />
                              ) : (
                                <View style={[styles.itunesArtwork, styles.itunesArtworkPlaceholder]}>
                                  <Icon name="musical-note" size={18} color="#4da3ff" />
                                </View>
                              )}
                              <View style={styles.itunesRowText}>
                                <Text style={styles.itunesTitle} numberOfLines={2}>
                                  {item.title}
                                </Text>
                                <Text style={styles.itunesArtist} numberOfLines={1}>
                                  {item.channelTitle}
                                </Text>
                              </View>
                              {selected ? (
                                <Icon name="checkmark-circle" size={18} color="#4da3ff" />
                              ) : (
                                <Icon name="play-circle-outline" size={22} color="#4da3ff" />
                              )}
                            </TouchableOpacity>
                          );
                        }}
                        ListEmptyComponent={
                          musicQuery.trim() ? (
                            <View style={styles.musicEmptyWrap}>
                              {musicLoading ? (
                                <ActivityIndicator color="#4da3ff" />
                              ) : !getYoutubeSearchApiKey() ? (
                                <Text style={styles.musicEmptyText}>
                                  Search is unavailable right now.
                                </Text>
                              ) : (
                                <Text style={styles.musicEmptyText}>No songs found</Text>
                              )}
                            </View>
                          ) : null
                        }
                        ListFooterComponent={
                          <Text style={styles.sheetFootnote}>
                            Pick a track to add audio to your story. Quick picks work offline-friendly.
                          </Text>
                        }
                      />
                    </View>
                  )}
                  {showTrimModal && (
                    <>
                      <Text style={styles.sheetTitle}>Edit clip (trim)</Text>
                      <Text style={styles.sheetSub}>
                        Playback loops between start and end (seconds).
                      </Text>
                      <TextInput
                        value={trimStartDraft}
                        onChangeText={setTrimStartDraft}
                        keyboardType="decimal-pad"
                        placeholder="Start (seconds)"
                        style={styles.sheetInput}
                      />
                      <TextInput
                        value={trimEndDraft}
                        onChangeText={setTrimEndDraft}
                        keyboardType="decimal-pad"
                        placeholder="End (seconds), empty = full length"
                        style={styles.sheetInput}
                      />
                      <TouchableOpacity
                        style={styles.sheetPrimaryBtn}
                        onPress={() => {
                          setTrimPerIndex(prev => ({
                            ...prev,
                            [index]: {
                              start: Number(trimStartDraft) || 0,
                              end: trimEndDraft.trim() ? Number(trimEndDraft) || null : null,
                            },
                          }));
                          setShowTrimModal(false);
                        }}
                      >
                        <Text style={styles.sheetPrimaryBtnText}>Save</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {showVolumeModal && (
                    <>
                      <Text style={styles.sheetTitle}>Volume</Text>
                      {[0, 0.25, 0.5, 0.75, 1].map(v => (
                        <TouchableOpacity
                          key={String(v)}
                          style={styles.sheetRow}
                          onPress={() => {
                            setVolumePerIndex(prev => ({ ...prev, [index]: v }));
                            setShowVolumeModal(false);
                          }}
                        >
                          <Icon name={v === 0 ? 'volume-mute' : 'volume-high'} size={18} color="#4da3ff" />
                          <Text style={styles.sheetRowText}>
                            {v === 0 ? 'Mute' : `${Math.round(v * 100)}%`}
                          </Text>
                          {volMatches(volumePerIndex[index], v) ? (
                            <Icon name="checkmark-circle" size={18} color="#4da3ff" />
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                  {activeTab === 'text' && (
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                      <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.textSheetInner}
                      >
                        <Text style={styles.sheetTitle}>Add text</Text>
                        <Text style={styles.sheetSub}>
                          Type a caption, then tap Add to place it on your story.
                        </Text>
                        <View style={styles.textRow}>
                          <TextInput
                            placeholder="Add text…"
                            placeholderTextColor="#aaa"
                            style={[styles.textInput, textStyle, textFont, { color: textColor }]}
                            value={draftText}
                            onChangeText={setDraftText}
                          />
                          <TouchableOpacity style={styles.addBtn} onPress={addText} activeOpacity={0.7}>
                            <Text style={styles.addBtnLabel}>
                              {editingTextId ? 'Save' : 'Add'}
                            </Text>
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
                    </TouchableWithoutFeedback>
                  )}
                </View>
              </View>
            </View>
          )}

        </View>
        {showAudioTrimModal && useLibraryMusic && hasLibraryMusicPlayback ? (
          <SafeAreaView style={styles.igMusicEditorRoot} edges={['top', 'bottom']}>
            <View style={styles.igMusicEditorInner}>
              <View style={styles.igMusicHeader}>
                <TouchableOpacity
                  onPress={cancelMusicTrim}
                  hitSlop={12}
                  style={styles.igHeaderSideLeft}
                >
                  <Text style={styles.igHeaderBtn}>Cancel</Text>
                </TouchableOpacity>
                <View style={styles.igMusicHeaderCenter}>
                  {trackArtworkUri ? (
                    <Image source={{ uri: trackArtworkUri }} style={styles.igArtwork} />
                  ) : (
                    <View style={styles.igArtworkPlaceholder}>
                      <Icon name="musical-notes" size={20} color="#8e8e93" />
                    </View>
                  )}
                  <View style={styles.igColorRing} accessibilityElementsHidden>
                    <LinearGradient
                      colors={['#ff6b35', '#f7b733', '#6bcb77', '#4d96ff', '#9b59b6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.igColorRingInner}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onMusicTrimDone}
                  hitSlop={12}
                  style={styles.igHeaderSideRight}
                >
                  <Text style={styles.igHeaderBtnDone}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Track preview card (lyrics trim UI disabled) */}
              <View style={styles.igTrimPreviewArea}>
                <View style={styles.igTrimPreviewCard}>
                  <View style={styles.igTrimPreviewArtRow}>
                    {trackArtworkUri ? (
                      <Image
                        source={{ uri: trackArtworkUri }}
                        style={styles.igTrimPreviewArt}
                      />
                    ) : (
                      <LinearGradient
                        colors={['#3d3d45', '#1e1e24']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.igTrimPreviewArtPlaceholder}
                      >
                        <Icon
                          name="musical-notes"
                          size={30}
                          color="rgba(255,255,255,0.88)"
                        />
                      </LinearGradient>
                    )}
                    <View style={styles.igTrimPreviewTextCol}>
                      <Text
                        style={styles.igTrimPreviewTitle}
                        numberOfLines={2}
                      >
                        {getAudioTitle(audioSel)}
                      </Text>
                      {getAudioSubtitle(audioSel) ? (
                        <Text
                          style={styles.igTrimPreviewSub}
                          numberOfLines={1}
                        >
                          {getAudioSubtitle(audioSel)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.igPlaybackRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.igPlayBtnOuter,
                    pressed && styles.igPlayBtnPressed,
                  ]}
                  onPress={handleTrimPlayPause}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel={musicEditorPaused ? 'Play preview' : 'Pause preview'}
                  android_disableSound
                >
                  <LinearGradient
                    colors={
                      musicEditorPaused
                        ? ['#3a3a42', '#25252a']
                        : ['#4da3ff', '#6366f1']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.igPlayBtnGradient}
                  >
                    <Icon
                      name={musicEditorPaused ? 'play' : 'pause'}
                      size={28}
                      color="#fff"
                    />
                  </LinearGradient>
                </Pressable>
                <View style={styles.igProgressCol}>
                  <Text style={styles.igProgressLabel}>Preview</Text>
                  <View style={styles.igProgressWrap}>
                    <View style={styles.igProgressTrack}>
                      <LinearGradient
                        colors={['#4da3ff', '#a78bfa']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={[
                          styles.igProgressFill,
                          { width: `${Math.round(igSegmentProgress * 1000) / 10}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.igDurationBadge}>
                  <Text style={styles.igDurationBadgeText}>
                    {Math.round(Math.max(0, igSegEnd - igSegStart))}s
                  </Text>
                </View>
              </View>

              <View style={styles.igClipLenRow}>
                <Text style={styles.igClipLenLabel}>Clip length</Text>
                <View style={styles.igClipSegmentTrack}>
                  <Pressable
                    onPress={() => applySoundTrimClipLength(15)}
                    style={({ pressed }) => [
                      styles.igClipSegChip,
                      trimClipWindowSec === 15 && styles.igClipSegChipOn,
                      pressed && styles.igClipLenChipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.igClipSegChipText,
                        trimClipWindowSec === 15 && styles.igClipSegChipTextOn,
                      ]}
                    >
                      15s
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => applySoundTrimClipLength(30)}
                    style={({ pressed }) => [
                      styles.igClipSegChip,
                      trimClipWindowSec === 30 && styles.igClipSegChipOn,
                      pressed && styles.igClipLenChipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.igClipSegChipText,
                        trimClipWindowSec === 30 && styles.igClipSegChipTextOn,
                      ]}
                    >
                      30s
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.igWaveSection}>
                <Text style={styles.igWaveSectionTitle}>Trim</Text>
                <Text style={styles.igWaveHint}>
                  {`Scroll the waveform for the full track, then drag the window to pick a ${MIN_STORY_CLIP_SEC}–${MAX_STORY_CLIP_SEC}s clip (default ${DEFAULT_STORY_CLIP_SEC}s on long songs).`}
                </Text>
                <View style={styles.igWaveMetaRow}>
                  <View style={styles.igWaveMetaPill}>
                    <Text style={styles.igWaveMetaPillLabel}>Full</Text>
                    <Text style={styles.igWaveMetaPillValue}>
                      {formatTimeMmSs(musicTimelineDurationSec)}
                    </Text>
                  </View>
                  <Text style={styles.igWaveMetaDot}>·</Text>
                  <View style={styles.igWaveMetaPill}>
                    <Text style={styles.igWaveMetaPillLabel}>Selection</Text>
                    <Text style={styles.igWaveMetaPillValue}>
                      {formatTimeMmSs(Math.max(0, igSegEnd - igSegStart))}
                      <Text style={styles.igWaveMetaPillSec}>
                        {' '}
                        ({Math.round(Math.max(0, igSegEnd - igSegStart))}s)
                      </Text>
                    </Text>
                  </View>
                </View>
                <View
                  style={styles.waveformOuterIg}
                  onLayout={e => {
                    const w = e.nativeEvent.layout.width;
                    if (w < 24) return;
                    setWaveformViewportW(w);
                    setTimeout(() => {
                      const duration = musicTimelineDurationRef.current;
                      if (!duration) return;
                      if (waveformSyncedRef.current) return;
                      const startSec = Number(audioTrimStartDraft) || 0;
                      const segmentSec = Math.min(trimClipWindowSec, duration);
                      const pxPerSec = WAVEFORM_PX_PER_SEC;
                      const viewportW = w;
                      const windowW = segmentSec * pxPerSec;
                      const contentW = duration * pxPerSec;
                      const leftPx = startSec * pxPerSec;
                      const maxScroll = Math.max(0, contentW - viewportW);
                      const scrollX = Math.max(
                        0,
                        Math.min(maxScroll, leftPx - viewportW / 2 + windowW / 2),
                      );
                      waveformScrollRef.current?.scrollTo({ x: scrollX, animated: false });
                      setWaveformScrollX(scrollX);
                      waveformSyncedRef.current = true;
                    }, 40);
                  }}
                >
                  <ScrollView
                    ref={waveformScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={onWaveformScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={styles.waveformScrollContent}
                  >
                    <View style={[styles.waveformBarsRowIg, { width: waveformContentW }]}>
                      {Array.from(
                        {
                          length: Math.min(
                            240,
                            Math.max(20, Math.floor(waveformContentW / WAVE_BAR_STEP)),
                          ),
                        },
                        (_, i) => {
                          const h = 0.25 + ((i * 17) % 74) / 100;
                          const barLeft = i * WAVE_BAR_STEP;
                          const barScreenLeft = barLeft - waveformScrollX;
                          const vw = waveformViewportW;
                          const ww = Math.min(waveformWindowPx, vw);
                          const winLeft = vw / 2 - ww / 2;
                          const winRight = vw / 2 + ww / 2;
                          const inWin =
                            barScreenLeft + WAVE_BAR_STEP > winLeft &&
                            barScreenLeft < winRight;
                          return (
                            <View
                              key={`igwb_${i}`}
                              style={[
                                styles.waveformBarIg,
                                inWin ? styles.waveformBarIgHot : styles.waveformBarIgCold,
                                { height: Math.max(10, 62 * h) },
                              ]}
                            />
                          );
                        },
                      )}
                    </View>
                  </ScrollView>
                  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <View
                      style={[
                        styles.waveDimSideIg,
                        styles.waveDimLeft,
                        { width: waveDimSide },
                      ]}
                    />
                    <View
                      style={[
                        styles.waveDimSideIg,
                        styles.waveDimRight,
                        { width: waveDimSide },
                      ]}
                    />
                    <View
                      style={[
                        styles.waveWindowFrameIg,
                        {
                          width: Math.min(waveformWindowPx, waveformViewportW),
                          left:
                            (waveformViewportW -
                              Math.min(waveformWindowPx, waveformViewportW)) /
                            2,
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={['rgba(255,122,51,0.25)', 'rgba(168,85,247,0.28)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.igAdvancedBtn}
                  onPress={() => setShowMusicTrimAdvanced(a => !a)}
                >
                  <Text style={styles.igAdvancedBtnText}>
                    {showMusicTrimAdvanced ? 'Hide exact times' : 'Exact start / end (seconds)'}
                  </Text>
                </TouchableOpacity>
                {showMusicTrimAdvanced ? (
                  <View style={styles.igAdvancedInputs}>
                    <TextInput
                      value={audioTrimStartDraft}
                      onChangeText={setAudioTrimStartDraft}
                      keyboardType="decimal-pad"
                      placeholder="Start"
                      placeholderTextColor="#666"
                      style={styles.igSheetInput}
                    />
                    <TextInput
                      value={audioTrimEndDraft}
                      onChangeText={setAudioTrimEndDraft}
                      keyboardType="decimal-pad"
                      placeholder="End"
                      placeholderTextColor="#666"
                      style={styles.igSheetInput}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  container: { flex: 1 },

  igMusicEditorRoot: {

    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    elevation: 500,
    backgroundColor: '#0c0c0f',
    flex: 1,
  },
  igMusicEditorInner: {
    flex: 1,
  },
  igMusicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginTop: '10%'
  },
  igHeaderSideLeft: {
    width: 78,
    justifyContent: 'center',
  },
  igHeaderSideRight: {
    width: 78,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  igHeaderBtn: { color: '#fff', fontSize: 17, fontWeight: '400' },
  igHeaderBtnDone: { color: '#4da3ff', fontSize: 17, fontWeight: '600' },
  igMusicHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  igArtwork: { width: 36, height: 36, borderRadius: 6 },
  igArtworkPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igColorRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    padding: 2,
    backgroundColor: '#fff',
  },
  igColorRingInner: { flex: 1, borderRadius: 14 },
  igTrimPreviewArea: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    justifyContent: 'center',
  },
  igTrimPreviewCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  igTrimPreviewArtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  igTrimPreviewArt: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#1a1a1e',
  },
  igTrimPreviewArtPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igTrimPreviewTextCol: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  igTrimPreviewTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  igTrimPreviewSub: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  igLyricsBlock: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  igLyricsScroll: {
    flex: 1,
    minHeight: 140,
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  igLyricsScrollContent: {
    paddingVertical: 28,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  igTrimLyricsScrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    paddingBottom: 28,
  },
  igTrimLyricsHeader: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  igTrimLyricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
    maxWidth: SCREEN_WIDTH - 36,
    alignSelf: 'center',
  },
  igTrimLyricTime: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    width: 44,
    paddingTop: 2,
  },
  igTrimLyricText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  igTrimLyricsPlainHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    textAlign: 'center',
  },
  igTrimLyricsPlainBody: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    lineHeight: 22,
  },
  igKaraokeStack: {
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH - 28,
  },
  igLyricLine: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 5,
    paddingHorizontal: 12,
    lineHeight: 23,
  },
  igLyricBefore: {
    opacity: 0.5,
    fontWeight: '500',
  },
  igLyricIn: {
    opacity: 0.82,
    fontWeight: '500',
  },
  igLyricAfter: {
    opacity: 0.22,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  igLyricActive: {
    fontWeight: '800',
    fontSize: 19,
    opacity: 1,
    color: '#fff',
  },
  igLyricsPlaceholder: {
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  igLyricsEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  igLyricsLoadBtn: {
    marginTop: 6,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 10,
    backgroundColor: '#4da3ff',
    minWidth: 140,
    alignItems: 'center',
  },
  igLyricsLoadBtnLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  igLyricsErrorInline: {
    color: '#ff8a8a',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  igPlaybackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  igPlayBtnOuter: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  igPlayBtnGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igPlayBtnPressed: {
    opacity: 0.88,
  },
  igProgressCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
    justifyContent: 'center',
    minWidth: 0,
  },
  igProgressLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  igProgressWrap: {
    height: 10,
    justifyContent: 'center',
  },
  igProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  igProgressFill: {
    height: 6,
    borderRadius: 3,
    minWidth: 2,
  },
  igDurationBadge: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  igDurationBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  igClipLenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  igClipLenLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
  igClipSegmentTrack: {
    flexDirection: 'row',
    flex: 1,
    maxWidth: 220,
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  igClipSegChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igClipSegChipOn: {
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  igClipSegChipText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  igClipSegChipTextOn: {
    color: '#111',
  },
  igClipLenChipPressed: {
    opacity: 0.85,
  },
  igWaveSection: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 22 : 16,
  },
  igWaveSectionTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  igWaveHint: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  igWaveMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  igWaveMetaPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  igWaveMetaPillLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  igWaveMetaPillValue: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  igWaveMetaPillSec: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    fontSize: 12,
  },
  igWaveMetaDot: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
    fontWeight: '700',
  },
  waveformOuterIg: {
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#08080a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  waveformBarsRowIg: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 82,
  },
  waveformBarIg: {
    width: 2,
    marginRight: 2,
    borderRadius: 1,
  },
  waveformBarIgHot: { backgroundColor: 'rgba(255,255,255,0.95)' },
  waveformBarIgCold: { backgroundColor: 'rgba(255,255,255,0.12)' },
  waveDimSideIg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 1,
  },
  waveWindowFrameIg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  igAdvancedBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  igAdvancedBtnText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  igAdvancedInputs: { flexDirection: 'row', gap: 10, marginTop: 6 },
  igSheetInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },

  topBar: {
    paddingTop: Platform.OS === 'ios' ? 50 : -5,
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

  stageColumn: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  canvasOuter: {
    flex: 1,
    minHeight: 0,
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
    position: 'relative',
  },

  imageContainer: {
    ...StyleSheet.absoluteFillObject,
  },

  fullScreenImage: {
    width: '100%',
    height: '100%',
  },

  videoWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },

  /** Plays library preview MP3; visually hidden but must be non-zero size for decoders. */
  hiddenMusicPlayer: {
    position: 'absolute',
    width: 2,
    height: 2,
    opacity: 0,
    left: 0,
    top: 0,
    zIndex: 0,
  },

  /** YouTube iframe requires ≥200×200 viewport; keep off-screen for audio-style preview. */
  hiddenYoutubePlayer: {
    position: 'absolute',
    width: 200,
    height: 200,
    opacity: 0.02,
    left: -220,
    top: 0,
    zIndex: 0,
    overflow: 'hidden',
  },

  musicStickerCard: {
    width: MUSIC_STICKER_CARD_W,
    minHeight: MUSIC_STICKER_CARD_H,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    zIndex: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  musicStickerArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  musicStickerArtPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicStickerTexts: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
    justifyContent: 'center',
  },
  musicStickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  musicStickerArtist: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8e8e93',
    marginTop: 2,
  },

  overlayItem: { position: 'absolute' },
  storyTrashZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,          // ✅ reduced — was 16 + insets
    paddingTop: 0,              // ✅ no top padding inflating the zone
    backgroundColor: 'transparent',
  },

  storyTrashHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 4,
  },

  storyTrashHintDrag: {
    color: 'rgba(255,255,255,0.85)',
  },

  storyTrashHintActive: {
    color: '#ff4d6a',
  },

  // ✅ New: Instagram-style circle
  trashCircle: {
    width: 45,
    height: 45,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    // ✅ No overflow, no extra padding — tight hitbox
  },

  trashCircleHot: {
    borderColor: '#ff4d6a',
    backgroundColor: 'rgba(255, 77, 106, 0.18)',
  },
  /** Min touch target + padding so Pan/Pinch hit tests succeed (emoji glyphs alone are too small). */
  stickerHitArea: {
    minWidth: 72,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  textOverlayHitArea: {
    minWidth: 88,
    minHeight: 64,
    paddingHorizontal: 20,  // wider — both pinch fingers need to land here
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  },
  /** Multi-line lyric blocks: full width, readable line height (avoids stacked overlap). */
  lyricsTextOverlay: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
    width: SCREEN_WIDTH - 48,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  lyricsBlockWrap: {
    position: 'relative',
    paddingTop: 4,
  },
  lyricsRemoveHit: {
    position: 'absolute',
    top: -10,
    right: -6,
    zIndex: 20,
  },
  lyricsPositionRow: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  lyricsPositionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 6,
  },
  lyricsPositionBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  lyricsMiniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(77,163,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  lyricsMiniBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4da3ff',
  },
  lyricsRemoveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  lyricsRemoveAllText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#c41c1c',
    fontWeight: '600',
  },

  clipStripContainer: {
    width: '100%',
    flexShrink: 0,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    zIndex: 6,
  },
  clipStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  clipStripTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  clipStripCount: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  thumbBar: {
    paddingVertical: 4,
    width: '100%',
  },
  thumbScrollContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
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
  thumbAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(77,163,255,0.5)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0,0,0,0.35)',
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

  musicStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(247,248,250,0.98)',
  },
  musicStripIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(77,163,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  musicStripTextCol: { flex: 1, minWidth: 0 },
  musicStripLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  musicStripValue: {
    fontSize: 15,
    color: '#111',
    fontWeight: '700',
    marginTop: 2,
  },
  musicStripHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },

  tabs: {
    flexShrink: 0,
    width: '100%',
    paddingTop: 4,
    paddingBottom: 3,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  /** Prevents vertical expansion on some Android ScrollView implementations */
  toolbarScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  toolbarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingRight: 10,
  },
  tabBtn: {
    width: 56,
    marginHorizontal: 2,
    paddingHorizontal: 3,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(77, 163, 255, 0.12)',
  },
  tabLabel: {
    marginTop: 3,
    fontSize: 8,
    lineHeight: 10,
    color: '#555',
    textAlign: 'center',
    width: '100%',
  },
  tabLabelActive: {
    color: '#4da3ff',
    fontWeight: '600',
  },

  bottomTools: {
    width: '100%',
    flexShrink: 0,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 0,
    zIndex: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  lyricsPanelScroll: {
    maxHeight: SCREEN_HEIGHT * 0.34,
  },

  lyricsPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  lyricsPanelHint: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  lyricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  lyricsLoadBtn: {
    backgroundColor: '#4da3ff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 148,
    alignItems: 'center',
  },
  lyricsLoadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  karaokeToggle: { flexDirection: 'row', alignItems: 'center' },
  karaokeToggleLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginRight: 8,
  },
  lyricsErrorText: {
    color: '#c41c1c',
    fontSize: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  lyricsMetaOk: {
    fontSize: 13,
    color: '#2e7d32',
    paddingHorizontal: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  lyricsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexWrap: 'wrap',
  },
  lyricsActionChip: {
    backgroundColor: 'rgba(77,163,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 6,
  },
  lyricsActionChipText: { fontSize: 12, fontWeight: '700', color: '#4da3ff' },
  lyricsFootnote: {
    fontSize: 10,
    color: '#999',
    paddingHorizontal: 12,
    marginTop: 4,
    lineHeight: 14,
  },
  karaokeOverlay: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 6,
  },
  karaokeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  karaokeStack: {
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH - 32,
  },
  karaokeLineBase: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    marginVertical: 3,
    paddingHorizontal: 8,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  karaokeLineIn: {
    opacity: 0.92,
  },
  karaokeLineFaded: {
    opacity: 0.32,
    fontSize: 13,
    fontWeight: '400',
  },
  karaokeLineActive: {
    fontWeight: '800',
    fontSize: 18,
    opacity: 1,
  },
  audioTrimSheetScroll: {
    maxHeight: SCREEN_HEIGHT * 0.52,
  },
  waveformBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  segmentBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBadgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  waveformBadgeHint: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  waveformOuter: {
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#ececec',
  },
  waveformScrollContent: {
    alignItems: 'flex-end',
    minHeight: 72,
    paddingVertical: 8,
  },
  waveformBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 72,
  },
  waveformBar: {
    width: 2,
    marginRight: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 1,
  },
  waveDimSide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
    zIndex: 1,
  },
  waveDimLeft: {
    left: 0,
  },
  waveDimRight: {
    right: 0,
  },
  waveWindowFrame: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  waveformManualLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },

  // Filters
  filterScrollContent: {
    paddingLeft: 12,
    paddingRight: 20,
    alignItems: 'center',
    flexDirection: 'row',
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
  overlayHint: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
  },
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
  sheetHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    elevation: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetBackdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetCardWrap: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  sheetCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    maxHeight: SCREEN_HEIGHT * 0.72,
  },
  musicSheetInner: {
    minHeight: 120,
  },
  textSheetInner: {
    width: '100%',
  },
  musicSearchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#111',
    marginBottom: 8,
  },
  musicResultsList: {
    maxHeight: SCREEN_HEIGHT * 0.38,
  },
  quickPickBlock: {
    marginBottom: 8,
  },
  quickPickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    marginBottom: 6,
  },
  itunesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  itunesArtwork: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
  },
  itunesArtworkPlaceholder: {
    backgroundColor: 'rgba(77,163,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itunesRowText: { flex: 1, minWidth: 0 },
  itunesTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  itunesArtist: { fontSize: 13, color: '#666', marginTop: 2 },
  musicEmptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicEmptyText: { fontSize: 14, color: '#888' },
  sheetScroll: {
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 6 },
  sheetSub: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  sheetApiKeyHint: {
    fontSize: 12,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    lineHeight: 17,
  },
  sheetFootnote: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    lineHeight: 15,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 10,
  },
  sheetRowText: { flex: 1, color: '#222', fontSize: 15 },
  sheetInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: '#111',
  },
  sheetPrimaryBtn: {
    backgroundColor: '#4da3ff',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sheetPrimaryBtnText: { color: '#fff', fontWeight: '700' },
});
