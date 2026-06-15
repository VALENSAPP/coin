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
  Platform,
  ScrollView,
  Pressable,
  AppState,
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
  audioSel,
  initialTrim,
  lyricsBundle = null,
  onCancel,
  onDone,
  onDelete,
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
    waveformSyncedRef.current = false;
    setMusicEditorPaused(false);
    setShowMusicTrimAdvanced(false);
    setSoundTrimClipSec(DEFAULT_STORY_CLIP_SEC);
  }, [visible, musicPreviewKey, initialStart, initialEnd, ytFullDurForInit]);

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
    onDone?.({
      start: Number(audioTrimStartDraft) || 0,
      end: audioTrimEndDraft.trim() ? Number(audioTrimEndDraft) || null : null,
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
  }, [t, lyricsBundle, musicTimelineDurationSec, audioTrimStartDraft, audioTrimEndDraft]);

  const trackArtworkUri =
    typeof audioSel === 'object' &&
    (audioSel?.thumbnailUrl || audioSel?.artworkUrl100 || audioSel?.artworkUrl60)
      ? audioSel.thumbnailUrl || audioSel.artworkUrl100 || audioSel.artworkUrl60
      : null;

  if (!visible || !useLibraryMusic || !hasLibraryMusicPlayback) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <SafeAreaView style={styles.igMusicEditorRoot} edges={['top', 'bottom']}>
        <View style={styles.igMusicEditorInner}>
          <View style={styles.igMusicHeader}>
            <View style={styles.igHeaderSideLeft}>
              <TouchableOpacity onPress={handleCancel} hitSlop={12}>
                <Text style={styles.igHeaderBtn}>{t('postStoryMusicTrim.cancel')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.igMusicHeaderCenter}>
              {trackArtworkUri ? (
                <Image source={{ uri: trackArtworkUri }} style={styles.igArtwork} />
              ) : (
                <View style={styles.igArtworkPlaceholder}>
                  <Icon name="musical-notes" size={20} color="#8e8e93" />
                </View>
              )}
              <View style={styles.igColorRing}>
                <LinearGradient
                  colors={['#ff6b35', '#f7b733', '#6bcb77', '#4d96ff', '#9b59b6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.igColorRingInner}
                />
              </View>
            </View>
            <View style={styles.igHeaderSideRight}>
              {onDelete && (
                <TouchableOpacity onPress={handleDelete} hitSlop={12} style={styles.igHeaderDeleteBtn}>
                  <Icon name="trash" size={18} color="#ff4d6a" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={handleDone} hitSlop={12}>
              <Text style={styles.igHeaderBtnDone}>{t('postStoryMusicTrim.done')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.igTrimPreviewArea}>
            <View style={styles.igTrimPreviewCard}>
              <View style={styles.igTrimPreviewArtRow}>
                {trackArtworkUri ? (
                  <Image source={{ uri: trackArtworkUri }} style={styles.igTrimPreviewArt} />
                ) : (
                  <LinearGradient
                    colors={['#3d3d45', '#1e1e24']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.igTrimPreviewArtPlaceholder}
                  >
                    <Icon name="musical-notes" size={30} color="rgba(255,255,255,0.88)" />
                  </LinearGradient>
                )}
                <View style={styles.igTrimPreviewTextCol}>
                  <Text style={styles.igTrimPreviewTitle} numberOfLines={2}>
                    {getAudioTitle(audioSel, t)}
                  </Text>
                  {getAudioSubtitle(audioSel) ? (
                    <Text style={styles.igTrimPreviewSub} numberOfLines={1}>
                      {getAudioSubtitle(audioSel)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

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
                <Icon name={musicEditorPaused ? 'play' : 'pause'} size={28} color="#fff" />
              </LinearGradient>
            </Pressable>
            <View style={styles.igProgressCol}>
              <Text style={styles.igProgressLabel}>{t('postStoryMusicTrim.preview')}</Text>
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

          <View style={styles.igLyricsClipSection}>
            <Text style={styles.igLyricsClipTitle}>{t('postStoryMusicTrim.lyricsTitle')}</Text>
            <Text style={styles.igLyricsClipHint}>
              {t('postStoryMusicTrim.lyricsHint')}
            </Text>
            <ScrollView
              style={styles.igLyricsClipScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.igLyricsClipText}>{clipLyricsTrimPreview}</Text>
            </ScrollView>
          </View>

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

          <View style={styles.igWaveSection}>
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
              <Text style={styles.igWaveMetaDot}>·</Text>
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
                {showMusicTrimAdvanced
                  ? t('postStoryMusicTrim.hideExactTimes')
                  : t('postStoryMusicTrim.showExactTimes')}
              </Text>
            </TouchableOpacity>
            {showMusicTrimAdvanced ? (
              <View style={styles.igAdvancedInputs}>
                <TextInput
                  value={audioTrimStartDraft}
                  onChangeText={setAudioTrimStartDraft}
                  keyboardType="decimal-pad"
                  placeholder={t('postStoryMusicTrim.startPlaceholder')}
                  placeholderTextColor="#666"
                  style={styles.igSheetInput}
                />
                <TextInput
                  value={audioTrimEndDraft}
                  onChangeText={setAudioTrimEndDraft}
                  keyboardType="decimal-pad"
                  placeholder={t('postStoryMusicTrim.endPlaceholder')}
                  placeholderTextColor="#666"
                  style={styles.igSheetInput}
                />
              </View>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  igMusicEditorRoot: {
    flex: 1,
    backgroundColor: '#0c0c0f',
  },
  igMusicEditorInner: { flex: 1,    marginTop:'5%',
 },
  igMusicHeader: {
    marginTop:'10%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  igHeaderSideLeft: { width: 78, justifyContent: 'center' },
  igHeaderSideRight: { 
    width: 78, 
    alignItems: 'flex-end', 
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  igHeaderBtn: { color: '#fff', fontSize: 17, fontWeight: '400' },
  igHeaderBtnDone: { color: '#4da3ff', fontSize: 17, fontWeight: '600' },
  igHeaderDeleteBtn: {
    marginLeft: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,77,106,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  igTrimPreviewArtRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  igTrimPreviewArt: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#1a1a1e' },
  igTrimPreviewArtPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igTrimPreviewTextCol: { flex: 1, justifyContent: 'center', minWidth: 0 },
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
  hiddenMusicPlayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -200,
    top: 0,
  },
  hiddenYoutubePlayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    left: -220,
    top: 0,
  },
  igPlaybackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  igPlayBtnOuter: { borderRadius: 28, overflow: 'hidden' },
  igPlayBtnGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igPlayBtnPressed: { opacity: 0.88 },
  igProgressCol: { flex: 1, marginLeft: 12, marginRight: 10, justifyContent: 'center', minWidth: 0 },
  igProgressLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  igProgressWrap: { height: 10, justifyContent: 'center' },
  igProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  igProgressFill: { height: 6, borderRadius: 3, minWidth: 2 },
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
  igLyricsClipSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    maxHeight: 140,
  },
  igLyricsClipTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  igLyricsClipHint: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    marginBottom: 8,
    lineHeight: 15,
  },
  igLyricsClipScroll: { maxHeight: 96 },
  igLyricsClipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
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
  igClipSegmentTrack: { flexDirection: 'row', flex: 1, maxWidth: 220, alignSelf: 'flex-end', gap: 10 },
  igClipSegChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  igClipSegChipOn: { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: 'rgba(0,0,0,0.06)' },
  igClipSegChipText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '700' },
  igClipSegChipTextOn: { color: '#111' },
  igClipLenChipPressed: { opacity: 0.85 },
  igWaveSection: { paddingHorizontal: 16, paddingBottom: 24 },
  igWaveSectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  igWaveHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  igWaveMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  igWaveMetaPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  igWaveMetaPillLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
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
  igWaveMetaDot: { color: 'rgba(255,255,255,0.25)', marginHorizontal: 8, fontSize: 16 },
  waveformOuterIg: {
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  waveformScrollContent: { alignItems: 'center' },
  waveformBarsRowIg: { flexDirection: 'row', alignItems: 'flex-end', height: 110, paddingBottom: 8 },
  waveformBarIg: { width: 2, marginHorizontal: 1, borderRadius: 1, backgroundColor: '#fff' },
  waveformBarIgHot: { opacity: 0.95 },
  waveformBarIgCold: { opacity: 0.22 },
  waveDimSideIg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  waveDimLeft: { left: 0 },
  waveDimRight: { right: 0 },
  waveWindowFrameIg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  igAdvancedBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  igAdvancedBtnText: { color: '#4da3ff', fontSize: 14, fontWeight: '600' },
  igAdvancedInputs: { flexDirection: 'row', gap: 10, marginTop: 8 },
  igSheetInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
});
