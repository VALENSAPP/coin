/**
 * Story-style Sound trim UI (waveform, 15s/30s, preview) for the post editor.
 * Logic aligned with StoryComposer `showAudioTrimModal` block.
 */
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
  ScrollView,
  Pressable,
  AppState,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { filterSyncedLinesIntersectingTrim } from '../../utils/lyricsLrclib';
import { getMusicTrimPlaybackWindowFromTrim } from '../../utils/postSoundtracks';
import { useLanguage } from '../../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEFAULT_STORY_CLIP_SEC = 30;
const MIN_STORY_CLIP_SEC = 15;
const MAX_STORY_CLIP_SEC = 30;
const WAVEFORM_PX_PER_SEC = 12;
const WAVE_BAR_STEP = 4;

const LIBRARY_PREVIEW = {
  chill: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  energy: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  vibe: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
};

function isOriginalAudio(a) {
  return !a || a === 'original';
}

function isYoutubeTrack(a) {
  return typeof a === 'object' && a?.source === 'youtube' && !!a.videoId;
}

function getAudioPreviewUri(a) {
  if (isOriginalAudio(a)) return null;
  if (typeof a === 'object' && a?.previewUrl) return a.previewUrl;
  if (typeof a === 'string') return LIBRARY_PREVIEW[a] || null;
  return null;
}

function getAudioTitle(a, t) {
  if (isOriginalAudio(a)) return t('postStoryMusicTrim.originalSound');
  if (typeof a === 'object' && a?.title) return a.title;
  if (typeof a === 'string') {
    const m = {
      chill: t('postStoryMusicTrim.chillBeat'),
      energy: t('postStoryMusicTrim.energyPop'),
      vibe: t('postStoryMusicTrim.loFiDream'),
    };
    return m[a] || t('postStoryMusicTrim.music');
  }
  return t('postStoryMusicTrim.music');
}

function getAudioSubtitle(a) {
  if (typeof a === 'object' && a?.artist) return a.artist;
  if (typeof a === 'object' && a?.channelTitle) return a.channelTitle;
  if (typeof a === 'string' && a !== 'original') return null; // removed hardcoded "Quick pick"
  return null;
}

function getMusicTimelineDurationSec(audioSel, previewDur) {
  const prev = Math.max(0.1, Number(previewDur) || 30);
  if (typeof audioSel === 'object' && audioSel?.fullDurationSec != null) {
    const f = Number(audioSel.fullDurationSec);
    if (Number.isFinite(f) && f > 0) return Math.max(f, prev);
  }
  return prev;
}

function formatTimeMmSs(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function PostStoryMusicTrimModal({
  visible,
  embedded = false,
  audioSel,
  initialTrim,
  lyricsBundle = null,
  lyricsLoading = false,
  showMusicCard = true,
  onShowMusicCardChange,
  onCancel,
  onDone,
  onDelete,
  registerCommitTrim,
}) {
  const { t } = useLanguage();

  const [audioTrimStartDraft, setAudioTrimStartDraft] = useState('0');
  const [audioTrimEndDraft, setAudioTrimEndDraft] = useState('');
  const [trimClipWindowSec, setSoundTrimClipSec] = useState(DEFAULT_STORY_CLIP_SEC);
  const [musicPreviewSec, setMusicPreviewSec] = useState(0);
  const [musicPreviewDur, setMusicPreviewDur] = useState(30);
  const [musicEditorPaused, setMusicEditorPaused] = useState(false);
  const [showMusicTrimAdvanced, setShowMusicTrimAdvanced] = useState(false);
  const [waveformViewportW, setWaveformViewportW] = useState(SCREEN_WIDTH - 48);
  const [waveformScrollX, setWaveformScrollX] = useState(0);

  const musicPreviewRef = useRef(null);
  const youtubePreviewRef = useRef(null);
  const waveformScrollRef = useRef(null);
  const musicPreviewDurationRef = useRef(30);
  const waveformSyncedRef = useRef(false);
  const audioTrimRef = useRef({ start: 0, end: null });

  const useLibraryMusic = !isOriginalAudio(audioSel);
  const musicPreviewUri = getAudioPreviewUri(audioSel);
  const hasLibraryMusicPlayback = Boolean(musicPreviewUri) || isYoutubeTrack(audioSel);
  const musicPreviewKey =
    typeof audioSel === 'object' && audioSel?.videoId
      ? `yt_${audioSel.videoId}`
      : String(audioSel);

  const trimPreviewPaused = Boolean(visible && musicEditorPaused);

  const musicTimelineDurationSec = useMemo(
    () => getMusicTimelineDurationSec(audioSel, musicPreviewDur),
    [audioSel, musicPreviewDur],
  );

  useEffect(() => {
    musicPreviewDurationRef.current = musicTimelineDurationSec;
  }, [musicTimelineDurationSec]);

  useEffect(() => {
    audioTrimRef.current = {
      start: Number(audioTrimStartDraft) || 0,
      end: audioTrimEndDraft.trim() ? Number(audioTrimEndDraft) : null,
    };
  }, [audioTrimStartDraft, audioTrimEndDraft]);

  const initialStart = initialTrim?.start ?? 0;
  const initialEnd = initialTrim?.end;
  const ytFullDurForInit =
    typeof audioSel === 'object' && audioSel?.fullDurationSec != null
      ? Number(audioSel.fullDurationSec)
      : null;

  useEffect(() => {
    if (!visible) return;
    const at = { start: initialStart, end: initialEnd };
    const durHint =
      ytFullDurForInit != null && Number.isFinite(ytFullDurForInit) && ytFullDurForInit > 0
        ? ytFullDurForInit
        : 30;
    const dur = getMusicTimelineDurationSec(audioSel, durHint);
    setAudioTrimStartDraft(String(at.start ?? 0));
    if (at.end != null && at.end !== '') {
      setAudioTrimEndDraft(String(at.end));
    } else if (dur > DEFAULT_STORY_CLIP_SEC) {
      setAudioTrimEndDraft(String(DEFAULT_STORY_CLIP_SEC));
    } else {
      setAudioTrimEndDraft('');
    }
    audioTrimRef.current = {
      start: Number(at.start ?? 0) || 0,
      end:
        at.end != null && at.end !== '' && Number.isFinite(Number(at.end))
          ? Number(at.end)
          : null,
    };
    waveformSyncedRef.current = false;
    setMusicEditorPaused(false);
    setShowMusicTrimAdvanced(false);
    setSoundTrimClipSec(DEFAULT_STORY_CLIP_SEC);
  }, [visible, musicPreviewKey, initialStart, initialEnd, ytFullDurForInit]);

  useEffect(() => {
    if (!registerCommitTrim) return undefined;
    registerCommitTrim(() => {
      const at = audioTrimRef.current || { start: 0, end: null };
      return {
        start: Number(at.start) || 0,
        end:
          at.end != null && at.end !== '' && Number.isFinite(Number(at.end))
            ? Number(at.end)
            : null,
      };
    });
    return () => registerCommitTrim(null);
  }, [registerCommitTrim]);

  useEffect(() => {
    if (!isYoutubeTrack(audioSel) || !visible) return;
    const tick = setInterval(() => {
      if (musicEditorPaused) return;
      (async () => {
        try {
          const cur = await youtubePreviewRef.current?.getCurrentTime?.();
          if (typeof cur !== 'number' || Number.isNaN(cur)) return;
          setMusicPreviewSec(cur);
          const dur = musicPreviewDurationRef.current || 180;
          const at = audioTrimRef.current || { start: 0, end: null };
          const { start: playStart, end: playEnd, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(at, dur);
          const margin = Math.min(0.35, Math.max(0.08, (playEnd - playStart) * 0.02));
          if (hasOverlap && dur > 0 && playEnd > playStart && cur >= playEnd - margin) {
            youtubePreviewRef.current?.seekTo?.(playStart, true);
            setMusicPreviewSec(playStart);
          }
        } catch (_) {}
      })();
    }, 280);
    return () => clearInterval(tick);
  }, [audioSel, visible, musicEditorPaused, musicPreviewKey]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') return;
      if (visible) setMusicEditorPaused(true);
    });
    return () => sub.remove();
  }, [visible]);

  useEffect(() => {
    if (!visible || musicEditorPaused) return;
    const timer = setTimeout(() => {
      const previewDur = musicPreviewDurationRef.current || 30;
      const at = audioTrimRef.current || { start: 0, end: null };
      const { start: playStart, end: playEnd, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(at, previewDur);
      if (!hasOverlap || playEnd <= playStart) return;
      if (musicPreviewUri) {
        musicPreviewRef.current?.seek(playStart);
      }
      if (isYoutubeTrack(audioSel)) {
        youtubePreviewRef.current?.seekTo?.(playStart, true);
      }
      setMusicPreviewSec(playStart);
    }, 150);
    return () => clearTimeout(timer);
  }, [
    visible,
    musicEditorPaused,
    audioTrimStartDraft,
    audioTrimEndDraft,
    musicPreviewKey,
    musicPreviewUri,
    audioSel,
  ]);

  const waveformSegmentSec = Math.min(trimClipWindowSec, Math.max(0.1, musicTimelineDurationSec));
  const waveformContentW = Math.max(1, musicTimelineDurationSec * WAVEFORM_PX_PER_SEC);
  const waveformWindowPx = waveformSegmentSec * WAVEFORM_PX_PER_SEC;
  const waveDimSide = Math.max(0, (waveformViewportW - waveformWindowPx) / 2);

  const commitWaveformTrimFromScroll = scrollX => {
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
    audioTrimRef.current = { start: startSec, end: endSec };
    setAudioTrimStartDraft(startSec.toFixed(2));
    setAudioTrimEndDraft(endSec.toFixed(2));
  };

  const onWaveformScroll = e => {
    const scrollX = e.nativeEvent.contentOffset.x;
    setWaveformScrollX(scrollX);
    commitWaveformTrimFromScroll(scrollX);
  };

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
    audioTrimRef.current = { start: clampedStart, end };
    setAudioTrimStartDraft(clampedStart.toFixed(2));
    setAudioTrimEndDraft(end.toFixed(2));
    waveformSyncedRef.current = false;
    setTimeout(() => {
      const d = musicPreviewDurationRef.current || duration;
      const vw = waveformViewportW;
      if (vw < 24 || !d) return;
      const seg = Math.min(bounded, d);
      const pxPerSec = WAVEFORM_PX_PER_SEC;
      const windowW = seg * pxPerSec;
      const contentW = d * pxPerSec;
      const leftPx = clampedStart * pxPerSec;
      const maxScroll = Math.max(0, contentW - vw);
      const scrollX = Math.max(0, Math.min(maxScroll, leftPx - vw / 2 + windowW / 2));
      waveformScrollRef.current?.scrollTo({ x: scrollX, animated: true });
      setWaveformScrollX(scrollX);
    }, 80);
  };

  const handleCancel = () => {
    setMusicEditorPaused(false);
    onCancel?.();
  };

  const handleDone = () => {
    const at = audioTrimRef.current || { start: 0, end: null };
    onDone?.({
      start: Number(at.start) || 0,
      end:
        at.end != null && at.end !== '' && Number.isFinite(Number(at.end))
          ? Number(at.end)
          : null,
    });
    setMusicEditorPaused(false);
  };

  const handleDelete = () => {
    setMusicEditorPaused(false);
    onDelete?.();
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
      ? Math.max(0, Math.min(1, (musicPreviewSec - igSegStart) / (igSegEnd - igSegStart)))
      : 0;

  const clipLyricsTrimPreview = useMemo(() => {
    if (lyricsLoading) {
      return t('postStoryMusicTrim.lyricsLoading');
    }
    if (!lyricsBundle) {
      return t('postStoryMusicTrim.lyricsOpenHint');
    }
    const dur = musicTimelineDurationSec;
    const t0 = Math.max(0, Number(audioTrimStartDraft) || 0);
    const rawEnd = audioTrimEndDraft.trim();
    const t1 = rawEnd === '' ? dur : Math.min(Number(rawEnd) || dur, dur);
    if (lyricsBundle.syncedLines?.length) {
      const lines = filterSyncedLinesIntersectingTrim(lyricsBundle.syncedLines, t0, t1);
      const text = lines.map(l => l.text).filter(Boolean).join('\n').trim();
      if (text) return text;
      return t('postStoryMusicTrim.noTimedLines');
    }
    const plain = (lyricsBundle.plainText || '').trim();
    if (plain) {
      const short = plain.length > 450 ? `${plain.slice(0, 450)}…` : plain;
      return `${short}\n\n${t('postStoryMusicTrim.plainLyricsNote')}`;
    }
    return t('postStoryMusicTrim.noLyricsText');
  }, [t, lyricsBundle, lyricsLoading, musicTimelineDurationSec, audioTrimStartDraft, audioTrimEndDraft]);

  const trackArtworkUri =
    typeof audioSel === 'object' &&
    (audioSel?.thumbnailUrl || audioSel?.artworkUrl100 || audioSel?.artworkUrl60)
      ? audioSel.thumbnailUrl || audioSel.artworkUrl100 || audioSel.artworkUrl60
      : null;

  const builtinGradient = useMemo(() => {
    if (typeof audioSel === 'string') {
      const map = {
        chill: ['#5b4b8a', '#8b6bb8'],
        energy: ['#c94b4b', '#e8a87c'],
        vibe: ['#2d6a6a', '#4e9a9a'],
      };
      return map[audioSel] || ['#3d3d45', '#1e1e24'];
    }
    return ['#3d3d45', '#1e1e24'];
  }, [audioSel]);

  if (!visible || !useLibraryMusic || !hasLibraryMusicPlayback) return null;

  const content = (
      <SafeAreaView style={styles.igMusicEditorRoot} edges={['top', 'bottom']}>
        <View style={styles.igMusicHeader}>
          <Pressable onPress={handleCancel} hitSlop={12} style={styles.igHeaderSideBtn}>
            <Text style={styles.igHeaderBtn}>{t('postStoryMusicTrim.cancel')}</Text>
          </Pressable>
          <Text style={styles.igHeaderTitle} numberOfLines={1} pointerEvents="none">
            {getAudioTitle(audioSel, t)}
          </Text>
          <View style={styles.igHeaderActions}>
            {onDelete ? (
              <Pressable onPress={handleDelete} hitSlop={10} style={styles.igHeaderIconBtn}>
                <Icon name="trash-outline" size={22} color="#ff6b81" />
              </Pressable>
            ) : null}
            <Pressable onPress={handleDone} hitSlop={12} style={styles.igHeaderSideBtn}>
              <Text style={styles.igHeaderBtnDone}>{t('postStoryMusicTrim.done')}</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.igScroll}
          contentContainerStyle={styles.igScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.igHeroCard}>
            {trackArtworkUri ? (
              <Image source={{ uri: trackArtworkUri }} style={styles.igHeroArt} />
            ) : (
              <LinearGradient
                colors={builtinGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.igHeroArtPlaceholder}
              >
                <Icon name="musical-notes" size={36} color="rgba(255,255,255,0.92)" />
              </LinearGradient>
            )}
            <Text style={styles.igHeroTitle} numberOfLines={2}>
              {getAudioTitle(audioSel, t)}
            </Text>
            {getAudioSubtitle(audioSel) ? (
              <Text style={styles.igHeroSub} numberOfLines={1}>
                {getAudioSubtitle(audioSel)}
              </Text>
            ) : null}

            <View style={styles.igPlaybackRow}>
              <Pressable
                style={({ pressed }) => [styles.igPlayBtnOuter, pressed && styles.igPlayBtnPressed]}
                onPress={() => setMusicEditorPaused(p => !p)}
              >
                <LinearGradient
                  colors={musicEditorPaused ? ['#3a3a42', '#25252a'] : ['#4da3ff', '#6366f1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.igPlayBtnGradient}
                >
                  <Icon name={musicEditorPaused ? 'play' : 'pause'} size={26} color="#fff" />
                </LinearGradient>
              </Pressable>
              <View style={styles.igProgressCol}>
                <View style={styles.igProgressHeader}>
                  <Text style={styles.igProgressLabel}>{t('postStoryMusicTrim.preview')}</Text>
                  <Text style={styles.igProgressTime}>
                    {formatTimeMmSs(musicPreviewSec)} / {formatTimeMmSs(Math.max(0, igSegEnd - igSegStart))}
                  </Text>
                </View>
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
              <View style={styles.igDurationBadge}>
                <Text style={styles.igDurationBadgeText}>
                  {Math.round(Math.max(0, igSegEnd - igSegStart))}s
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.igSectionCard}>
            <View style={styles.igClipLenRow}>
              <Text style={styles.igClipLenLabel}>{t('postStoryMusicTrim.clipLength')}</Text>
              <View style={styles.igClipSegmentTrack}>
                <Pressable
                  onPress={() => applySoundTrimClipLength(15)}
                  style={({ pressed }) => [
                    styles.igClipSegChip,
                    trimClipWindowSec === 15 && styles.igClipSegChipOn,
                    pressed && styles.igClipLenChipPressed,
                  ]}
                >
                  <Text style={[styles.igClipSegChipText, trimClipWindowSec === 15 && styles.igClipSegChipTextOn]}>
                    {t('postStoryMusicTrim.15s')}
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
                  <Text style={[styles.igClipSegChipText, trimClipWindowSec === 30 && styles.igClipSegChipTextOn]}>
                    {t('postStoryMusicTrim.30s')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.igSectionCard}>
            <Text style={styles.igWaveSectionTitle}>{t('postStoryMusicTrim.trimLabel')}</Text>
            <Text style={styles.igWaveHint}>
              {t('postStoryMusicTrim.waveHint', {
                min: MIN_STORY_CLIP_SEC,
                max: MAX_STORY_CLIP_SEC,
                default: DEFAULT_STORY_CLIP_SEC,
              })}
            </Text>
            <View style={styles.igWaveMetaRow}>
              <View style={styles.igWaveMetaPill}>
                <Text style={styles.igWaveMetaPillLabel}>{t('postStoryMusicTrim.full')}</Text>
                <Text style={styles.igWaveMetaPillValue}>
                  {formatTimeMmSs(musicTimelineDurationSec)}
                </Text>
              </View>
              <View style={styles.igWaveMetaPill}>
                <Text style={styles.igWaveMetaPillLabel}>{t('postStoryMusicTrim.selection')}</Text>
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
                  const duration = musicPreviewDurationRef.current;
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
                  const scrollX = Math.max(0, Math.min(maxScroll, leftPx - viewportW / 2 + windowW / 2));
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
                onMomentumScrollEnd={e => commitWaveformTrimFromScroll(e.nativeEvent.contentOffset.x)}
                scrollEventThrottle={16}
                contentContainerStyle={styles.waveformScrollContent}
              >
                <View style={[styles.waveformBarsRowIg, { width: waveformContentW }]}>
                  {Array.from(
                    { length: Math.min(240, Math.max(20, Math.floor(waveformContentW / WAVE_BAR_STEP))) },
                    (_, i) => {
                      const h = 0.25 + ((i * 17) % 74) / 100;
                      const barLeft = i * WAVE_BAR_STEP;
                      const barScreenLeft = barLeft - waveformScrollX;
                      const vw = waveformViewportW;
                      const ww = Math.min(waveformWindowPx, vw);
                      const winLeft = vw / 2 - ww / 2;
                      const winRight = vw / 2 + ww / 2;
                      const inWin = barScreenLeft + WAVE_BAR_STEP > winLeft && barScreenLeft < winRight;
                      return (
                        <View
                          key={`wb_${i}`}
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
                <View style={[styles.waveDimSideIg, styles.waveDimLeft, { width: waveDimSide }]} />
                <View style={[styles.waveDimSideIg, styles.waveDimRight, { width: waveDimSide }]} />
                <View
                  style={[
                    styles.waveWindowFrameIg,
                    {
                      width: Math.min(waveformWindowPx, waveformViewportW),
                      left: (waveformViewportW - Math.min(waveformWindowPx, waveformViewportW)) / 2,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(77,163,255,0.22)', 'rgba(167,139,250,0.28)']}
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
              <Icon
                name={showMusicTrimAdvanced ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#4da3ff"
                style={styles.igAdvancedBtnIcon}
              />
              <Text style={styles.igAdvancedBtnText}>
                {showMusicTrimAdvanced
                  ? t('postStoryMusicTrim.hideExactTimes')
                  : t('postStoryMusicTrim.showExactTimes')}
              </Text>
            </TouchableOpacity>
            {showMusicTrimAdvanced ? (
              <View style={styles.igAdvancedInputs}>
                <View style={styles.igAdvancedField}>
                  <Text style={styles.igAdvancedFieldLabel}>{t('postStoryMusicTrim.startPlaceholder')}</Text>
                  <TextInput
                    value={audioTrimStartDraft}
                    onChangeText={setAudioTrimStartDraft}
                    keyboardType="decimal-pad"
                    placeholder={t('postStoryMusicTrim.startPlaceholder')}
                    placeholderTextColor="#666"
                    style={styles.igSheetInput}
                  />
                </View>
                <View style={styles.igAdvancedField}>
                  <Text style={styles.igAdvancedFieldLabel}>{t('postStoryMusicTrim.endPlaceholder')}</Text>
                  <TextInput
                    value={audioTrimEndDraft}
                    onChangeText={setAudioTrimEndDraft}
                    keyboardType="decimal-pad"
                    placeholder={t('postStoryMusicTrim.endPlaceholder')}
                    placeholderTextColor="#666"
                    style={styles.igSheetInput}
                  />
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.igSectionCard}>
            <Text style={styles.igLyricsClipTitle}>{t('postStoryMusicTrim.lyricsTitle')}</Text>
            <Text style={styles.igLyricsClipHint}>
              {t('postStoryMusicTrim.lyricsHint')}
            </Text>
            <View style={styles.igLyricsClipBody}>
              <Text style={styles.igLyricsClipText}>{clipLyricsTrimPreview}</Text>
            </View>
          </View>

          {typeof onShowMusicCardChange === 'function' ? (
            <View style={styles.igMusicCardToggleRow}>
              <View style={styles.igMusicCardToggleTextCol}>
                <Text style={styles.igMusicCardToggleLabel}>
                  {t('postStoryMusicTrim.showMusicCard')}
                </Text>
                <Text style={styles.igMusicCardToggleHint}>
                  {t('postStoryMusicTrim.showMusicCardHint')}
                </Text>
              </View>
              <Switch
                value={showMusicCard !== false}
                onValueChange={onShowMusicCardChange}
                trackColor={{ false: '#3f3f46', true: 'rgba(77,163,255,0.45)' }}
                thumbColor={showMusicCard !== false ? '#4da3ff' : '#a1a1aa'}
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.hiddenPlayersHost} pointerEvents="none" collapsable={false}>
          {musicPreviewUri && !trimPreviewPaused ? (
            <Video
              ref={musicPreviewRef}
              key={`post_music_${musicPreviewKey}`}
              source={{ uri: musicPreviewUri }}
              style={styles.hiddenMusicPlayer}
              repeat={false}
              muted={false}
              paused={false}
              volume={1}
              resizeMode="contain"
              ignoreSilentSwitch="ignore"
              pointerEvents="none"
              onLoad={data => {
                const loaded = data?.duration || 30;
                musicPreviewDurationRef.current = loaded;
                setMusicPreviewDur(loaded);
                const at = audioTrimRef.current;
                const dur = loaded;
                const { start: playStart, end: playEnd, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(at, dur);
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
                const at = audioTrimRef.current;
                const { start: playStart, end: playEnd, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(at, dur);
                const margin = Math.min(0.35, Math.max(0.08, (playEnd - playStart) * 0.02));
                if (hasOverlap && dur > 0 && playEnd > playStart && currentTime >= playEnd - margin) {
                  musicPreviewRef.current?.seek(playStart);
                  setMusicPreviewSec(playStart);
                }
              }}
            />
          ) : null}

          {isYoutubeTrack(audioSel) && !trimPreviewPaused ? (
            <View style={styles.hiddenYoutubePlayer} pointerEvents="none">
              <YoutubePlayer
                ref={youtubePreviewRef}
                key={`post_yt_${musicPreviewKey}`}
                height={200}
                width={200}
                videoId={audioSel.videoId}
                play={true}
                mute={false}
                volume={100}
                initialPlayerParams={{ controls: false, modestbranding: true, rel: false }}
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
                    const at = audioTrimRef.current;
                    const dur = musicPreviewDurationRef.current || 180;
                    const { start: playStart, end: playEnd, hasOverlap } = getMusicTrimPlaybackWindowFromTrim(at, dur);
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
                  } catch (_) {}
                }}
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
  );

  if (embedded) {
    return <View style={styles.embeddedHost}>{content}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2100,
    elevation: 2100,
    backgroundColor: '#0a0a0d',
  },
  igMusicEditorRoot: {
    flex: 1,
    backgroundColor: '#0a0a0d',
  },
  igMusicHeader: {
    paddingTop:40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    zIndex: 20,
    elevation: 20,
  },
  igHeaderSideBtn: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  igHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  igHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
    justifyContent: 'flex-end',
  },
  igHeaderIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,129,0.1)',
  },
  igHeaderBtn: { color: '#fff', fontSize: 16, fontWeight: '400' },
  igHeaderBtnDone: { color: '#4da3ff', fontSize: 16, fontWeight: '700' },
  igScroll: { flex: 1 },
  igScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },
  igHeroCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  igHeroArt: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#1a1a1e',
    marginBottom: 14,
  },
  igHeroArtPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  igHeroTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  igHeroSub: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  hiddenPlayersHost: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 200,
    height: 200,
    opacity: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  hiddenMusicPlayer: {
    width: 2,
    height: 2,
    opacity: 0,
  },
  hiddenYoutubePlayer: {
    width: 200,
    height: 200,
    opacity: 0,
    overflow: 'hidden',
  },
  igPlaybackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  igPlayBtnOuter: { borderRadius: 26, overflow: 'hidden' },
  igPlayBtnGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igPlayBtnPressed: { opacity: 0.88 },
  igProgressCol: { flex: 1, marginLeft: 14, marginRight: 10, justifyContent: 'center', minWidth: 0 },
  igProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  igProgressLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  igProgressTime: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  igProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  igProgressFill: { height: 6, borderRadius: 3, minWidth: 2 },
  igDurationBadge: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igDurationBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  igSectionCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  igLyricsClipTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  igLyricsClipHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 17,
  },
  igLyricsClipBody: {
    maxHeight: 120,
    borderRadius: 10,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  igLyricsClipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 20,
  },
  igMusicCardToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  igMusicCardToggleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  igMusicCardToggleLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  igMusicCardToggleHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  igClipLenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  igClipLenLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  igClipSegmentTrack: { flexDirection: 'row', gap: 8 },
  igClipSegChip: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  igClipSegChipOn: { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: 'rgba(0,0,0,0.06)' },
  igClipSegChipText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '700' },
  igClipSegChipTextOn: { color: '#111' },
  igClipLenChipPressed: { opacity: 0.85 },
  igWaveSectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  igWaveHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  igWaveMetaRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12, gap: 8 },
  igWaveMetaPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  igWaveMetaPillLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  igWaveMetaPillValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  igWaveMetaPillSec: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  waveformOuterIg: {
    height: 112,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  waveformScrollContent: { alignItems: 'center' },
  waveformBarsRowIg: { flexDirection: 'row', alignItems: 'flex-end', height: 102, paddingBottom: 8 },
  waveformBarIg: { width: 2, marginHorizontal: 1, borderRadius: 1, backgroundColor: '#fff' },
  waveformBarIgHot: { opacity: 0.95 },
  waveformBarIgCold: { opacity: 0.2 },
  waveDimSideIg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  waveDimLeft: { left: 0 },
  waveDimRight: { right: 0 },
  waveWindowFrameIg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  igAdvancedBtn: {
    marginTop: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  igAdvancedBtnIcon: { marginRight: 4 },
  igAdvancedBtnText: { color: '#4da3ff', fontSize: 14, fontWeight: '600' },
  igAdvancedInputs: { flexDirection: 'row', gap: 10, marginTop: 10 },
  igAdvancedField: { flex: 1 },
  igAdvancedFieldLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  igSheetInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});
