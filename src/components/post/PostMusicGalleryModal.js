import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  Platform,
  Switch,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { POST_SOUNDTRACKS } from '../../utils/postSoundtracks';
import { searchYoutubeMusicTracks, getYoutubeSearchApiKey } from '../../services/youtubeMusic';
import { useLanguage } from '../../i18n';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../theme/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BROWSE_MOODS = [
  { id: 'all', labelKey: 'musicBrowseAll', sectionKey: 'musicTrending' },
  { id: 'chill', labelKey: 'musicBrowseChill', sectionKey: 'musicBrowseChill' },
  { id: 'energy', labelKey: 'musicBrowseEnergy', sectionKey: 'musicBrowseEnergy' },
  { id: 'vibe', labelKey: 'musicBrowseLoFi', sectionKey: 'musicBrowseLoFi' },
];

const MOOD_BROWSE_QUERIES = {
  all: [
    'trending music hits',
    'viral songs',
    'popular music playlist',
    'top chart songs',
    'new music releases',
  ],
  chill: [
    'chill music relaxing',
    'chill beats playlist',
    'ambient chill songs',
    'calm acoustic music',
  ],
  energy: [
    'energy pop music',
    'upbeat dance music',
    'high energy workout music',
    'party pop hits',
  ],
  vibe: [
    'lofi hip hop music',
    'lofi beats study',
    'lo-fi chill beats',
    'lofi rain beats',
  ],
};

function pickBrowseQuery(moodId) {
  const pool = MOOD_BROWSE_QUERIES[moodId] || MOOD_BROWSE_QUERIES.all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffleTracks(tracks) {
  const list = [...tracks];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function isOriginalSelected(selection) {
  return selection?.musicSource === 'none' || selection?.musicId === 'none';
}

function isYoutubeSelected(item, selection) {
  return (
    selection?.musicSource === 'youtube' &&
    selection?.musicYoutubeVideoId === item.videoId
  );
}

export default function PostMusicGalleryModal({
  visible,
  embedded = false,
  onClose,
  query,
  onQueryChange,
  results = [],
  loading = false,
  hasYoutubeApi = true,
  selection = null,
  hasLibraryMusic = false,
  showMusicCard = true,
  onShowMusicCardChange,
  onEditClip,
  onSelectBuiltin,
  onSelectYoutube,
  backgroundColor = '#fff',
  textColor = '#111',
  accentColor = '#5a2d82',
  isDark = false,
}) {
  const { t } = useLanguage();
  const profileTheme = useBusinessProfileTheme();
  const { isDarkMode } = useThemeContext();
  const dark = isDark ?? isDarkMode;
  const resolvedBackground = dark ? profileTheme.bg : backgroundColor;
  const resolvedText = textColor ?? profileTheme.text;
  const resolvedAccent =
    accentColor === textColor || accentColor === '#ffffff' || accentColor === '#fff'
      ? profileTheme.accent
      : (accentColor ?? profileTheme.accent);
  const borderColor = dark ? profileTheme.border : 'rgba(0,0,0,0.08)';
  const mutedColor = dark ? profileTheme.mutedText : 'rgba(0,0,0,0.5)';
  const searchBg = dark ? profileTheme.card : 'rgba(0,0,0,0.05)';
  const iconColor = profileTheme.icon;

  const [activeMood, setActiveMood] = useState('all');
  const [browseResults, setBrowseResults] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const browseRequestRef = useRef(0);

  const originalTrack = useMemo(
    () => POST_SOUNDTRACKS.find(track => track.id === 'none'),
    [],
  );

  const isSearching = Boolean(query?.trim());
  const listData = isSearching ? results : browseResults;
  const listLoading = isSearching ? loading : browseLoading;

  const activeMoodMeta = BROWSE_MOODS.find(m => m.id === activeMood) || BROWSE_MOODS[0];
  const listSectionTitle = isSearching
    ? t('selectedPost.musicSearchResults')
    : t(`selectedPost.${activeMoodMeta.sectionKey}`);

  useEffect(() => {
    if (!visible) return;
    setActiveMood('all');
  }, [visible]);

  useEffect(() => {
    if (!visible || isSearching) {
      if (!visible) {
        setBrowseResults([]);
        setBrowseLoading(false);
      }
      return undefined;
    }

    const apiKey = getYoutubeSearchApiKey();
    if (!apiKey) {
      setBrowseResults([]);
      setBrowseLoading(false);
      return undefined;
    }

    let cancelled = false;
    const requestId = ++browseRequestRef.current;
    setBrowseLoading(true);
    setBrowseResults([]);

    const timer = setTimeout(async () => {
      try {
        const searchTerm = pickBrowseQuery(activeMood);
        const tracks = await searchYoutubeMusicTracks(searchTerm, apiKey);
        if (cancelled || requestId !== browseRequestRef.current) return;
        setBrowseResults(shuffleTracks(Array.isArray(tracks) ? tracks : []));
      } catch {
        if (!cancelled && requestId === browseRequestRef.current) {
          setBrowseResults([]);
        }
      } finally {
        if (!cancelled && requestId === browseRequestRef.current) {
          setBrowseLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, activeMood, isSearching]);

  const renderYoutubeRow = ({ item }) => {
    const selected = isYoutubeSelected(item, selection);
    return (
      <TouchableOpacity
        style={[styles.trackRow, { borderBottomColor: borderColor }]}
        onPress={() => onSelectYoutube?.(item)}
        activeOpacity={0.7}
      >
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.trackArtImage} />
        ) : (
          <View style={[styles.trackArtImage, styles.trackArtPlaceholder, { backgroundColor: searchBg }]}>
            <Icon name="musical-notes" size={20} color={resolvedAccent} />
          </View>
        )}
        <View style={styles.trackTextCol}>
          <Text style={[styles.trackTitle, { color: resolvedText }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.trackArtist, { color: mutedColor }]} numberOfLines={1}>
            {item.channelTitle}
          </Text>
        </View>
        {selected ? (
          <Icon name="checkmark-circle" size={24} color={resolvedAccent} />
        ) : (
          <Icon name="play-circle-outline" size={26} color={resolvedAccent} />
        )}
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.browseSections}>
      <Text style={[styles.sectionTitle, { color: resolvedText }]}>
        {t('selectedPost.musicBrowseMoods')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.moodChipRow}
        keyboardShouldPersistTaps="handled"
      >
        {BROWSE_MOODS.map(item => {
          const active = activeMood === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.moodChip,
                {
                  backgroundColor: active ? resolvedAccent : searchBg,
                  borderColor: active ? resolvedAccent : borderColor,
                },
              ]}
              onPress={() => {
                if (activeMood !== item.id) {
                  onQueryChange?.('');
                  setActiveMood(item.id);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.moodChipText, { color: active ? '#fff' : resolvedText }]}>
                {t(`selectedPost.${item.labelKey}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionTitle, { color: resolvedText, marginTop: 12 }]}>
        {listSectionTitle}
      </Text>

      {!hasYoutubeApi ? (
        <Text style={[styles.apiHint, { color: mutedColor }]}>
          {t('selectedPost.musicApiUnavailable')}
        </Text>
      ) : null}
    </View>
  );

  const listFooter = originalTrack ? (
    <View style={styles.footerSection}>
      <Text style={[styles.sectionTitle, { color: resolvedText }]}>
        {t('selectedPost.musicOriginalAudio')}
      </Text>
      <TouchableOpacity
        style={[styles.trackRow, styles.footerTrackRow, { borderBottomColor: borderColor }]}
        onPress={() => onSelectBuiltin?.(originalTrack)}
        activeOpacity={0.7}
      >
        <View style={[styles.trackArtImage, styles.trackArtPlaceholder, { backgroundColor: searchBg }]}>
          <Icon name="volume-high-outline" size={20} color={mutedColor} />
        </View>
        <View style={styles.trackTextCol}>
          <Text style={[styles.trackTitle, { color: resolvedText }]} numberOfLines={1}>
            {originalTrack.title}
          </Text>
          <Text style={[styles.trackArtist, { color: mutedColor }]} numberOfLines={1}>
            {originalTrack.artist}
          </Text>
        </View>
        {isOriginalSelected(selection) ? (
          <Icon name="checkmark-circle" size={24} color={resolvedAccent} />
        ) : null}
      </TouchableOpacity>
    </View>
  ) : null;

  const listEmpty = (
    <View style={styles.emptyWrap}>
      {listLoading ? (
        <ActivityIndicator color={resolvedAccent} size="large" />
      ) : !hasYoutubeApi ? (
        <Text style={[styles.emptyText, { color: mutedColor }]}>
          {t('selectedPost.searchUnavailable')}
        </Text>
      ) : (
        <Text style={[styles.emptyText, { color: mutedColor }]}>
          {isSearching ? t('selectedPost.noSongsFound') : t('selectedPost.musicBrowseEmpty')}
        </Text>
      )}
    </View>
  );

  if (!visible) return null;

  const content = (
      <SafeAreaView style={[styles.root, { backgroundColor: resolvedBackground }]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('selectedPost.close')}
          >
            <Icon name="chevron-back" size={28} color={iconColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: resolvedText }]}>
            {t('selectedPost.musicTitle')}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={[styles.searchBar, { backgroundColor: searchBg, borderWidth: dark ? StyleSheet.hairlineWidth : 0, borderColor }]}>
          <Icon name="search" size={20} color={mutedColor} style={styles.searchIcon} />
          <TextInput
            placeholder={t('selectedPost.musicSearchPlaceholder')}
            placeholderTextColor={mutedColor}
            style={[styles.searchInput, { color: resolvedText }]}
            value={query}
            onChangeText={onQueryChange}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query?.length > 0 ? (
            <TouchableOpacity onPress={() => onQueryChange?.('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={20} color={mutedColor} />
            </TouchableOpacity>
          ) : null}
        </View>

        {hasLibraryMusic ? (
          <View style={[styles.currentTrackBar, { backgroundColor: searchBg }]}>
            <TouchableOpacity style={styles.editClipBtn} onPress={onEditClip} activeOpacity={0.8}>
              <Icon name="cut-outline" size={18} color={resolvedAccent} />
              <Text style={[styles.editClipText, { color: resolvedAccent }]}>
                {t('selectedPost.editMusicClip')}
              </Text>
            </TouchableOpacity>
            <View style={styles.showCardToggle}>
              <Text style={[styles.showCardLabel, { color: resolvedText }]} numberOfLines={1}>
                {t('selectedPost.showMusicCard')}
              </Text>
              <Switch
                value={showMusicCard}
                onValueChange={onShowMusicCardChange}
                trackColor={{ false: dark ? profileTheme.border : '#d1d5db', true: `${resolvedAccent}88` }}
                thumbColor={showMusicCard ? resolvedAccent : (dark ? profileTheme.mutedText : '#f4f4f5')}
              />
            </View>
          </View>
        ) : null}

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          data={listData}
          keyExtractor={item => String(item.videoId)}
          renderItem={renderYoutubeRow}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={listEmpty}
          showsVerticalScrollIndicator={false}
        />
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
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    elevation: 2000,
  },
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  currentTrackBar: {
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  editClipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  editClipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  showCardToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  showCardLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
    minHeight: SCREEN_HEIGHT * 0.5,
  },
  browseSections: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  footerSection: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  footerTrackRow: {
    borderBottomWidth: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  moodChipRow: {
    paddingBottom: 4,
    gap: 8,
  },
  moodChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  moodChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trackArtImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  trackArtPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTextCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
    minWidth: 0,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  trackArtist: {
    fontSize: 14,
    marginTop: 3,
  },
  apiHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
