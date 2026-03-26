import React, { useMemo } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
};

const battleData = {
  title: 'Will Ethereum surpass $10K by 2025?',
  left: {
    name: 'Alex Carter',
    handle: 'Alex Carter',
    points: '75,230 Points',
    score: '75,230',
    team: 'Team Yes',
    voteCount: '620',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  },
  right: {
    name: 'SarahM',
    handle: 'SarahM',
    points: '66,710 Points',
    score: '68,710',
    team: 'Team No',
    voteCount: '480',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  },
  pot: '200',
  likes: '120',
  updates: '24 new votes and 32 likes just now',
  summary:
    "Ethereum's Layer 2 adoption is skyrocketing and ETH's deflationary tokenomics will drive major upside.",
};

export default function BattleInProgress({ navigation }) {
  const { bgStyle, text, card } = useAppTheme();
  const palette = useMemo(() => {
    const primary = text || '#5a2d82';
    const secondary = primary.toLowerCase() === '#d3b683' ? '#b8924f' : '#e54ba0';

    return {
      primary,
      secondary,
      surface: card || '#fff',
      soft: withAlpha(primary, '18'),
      softStrong: withAlpha(primary, '2E'),
      softBorder: withAlpha(primary, '22'),
      muted: withAlpha(primary, 'AA'),
      glow: withAlpha(primary, '14'),
      contrast: '#fff',
      warm: '#ffd28b',
      warmText: '#8b3d17',
    };
  }, [card, text]);

  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <ScrollView
        style={[styles.container, bgStyle]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
            <Icon name="arrow-back-ios-new" size={20} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>Battle in Progress</Text>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="person-outline" size={20} color={text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.prompt, { color: text }]}>{battleData.title}</Text>

        <LinearGradient
          colors={[palette.primary, palette.secondary, palette.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={[styles.heroGlowOne, { backgroundColor: palette.glow }]} />
          <View style={[styles.heroGlowTwo, { backgroundColor: withAlpha(palette.secondary, '14') }]} />

          <View style={styles.competitorRow}>
            <View style={styles.playerColumn}>
              <View style={[styles.namePill, { backgroundColor: palette.soft }]}>
                <Text style={styles.namePillTitle}>{battleData.left.name}</Text>
                <Text style={styles.namePillMeta}>{battleData.left.points}</Text>
              </View>
              <Image source={{ uri: battleData.left.avatar }} style={[styles.avatar, { borderColor: palette.contrast }]} />
              <Text style={styles.avatarLabel}>{battleData.left.handle}</Text>
            </View>

            <View style={styles.vsBlock}>
              <Text style={styles.vsText}>Vs</Text>
              <View style={[styles.potBadge, { backgroundColor: palette.warm }]}>
                <Ionicons name="cash-outline" size={12} color={palette.warmText} />
                <Text style={styles.potText}>{battleData.pot}</Text>
              </View>
            </View>

            <View style={styles.playerColumn}>
              <View style={[styles.namePill, { backgroundColor: withAlpha(palette.secondary, '33') }]}>
                <Text style={styles.namePillTitle}>{battleData.right.name}</Text>
                <Text style={styles.namePillMeta}>{battleData.right.points}</Text>
              </View>
              <Image source={{ uri: battleData.right.avatar }} style={[styles.avatar, { borderColor: palette.contrast }]} />
              <Text style={styles.avatarLabel}>{battleData.right.handle}</Text>
            </View>
          </View>

          <View style={styles.heroScoreRow}>
            <Text style={styles.heroScoreText}>{battleData.left.score} Points</Text>
            <Text style={styles.heroScoreText}>{battleData.right.score} Points</Text>
          </View>
        </LinearGradient>

        <View style={[styles.updateBar, { backgroundColor: palette.surface, shadowColor: palette.primary }]}>
          <View style={[styles.updateDot, { backgroundColor: palette.primary }]} />
          <Text style={[styles.updateText, { color: palette.muted }]}>{battleData.updates}</Text>
        </View>

        <View style={[styles.voteCard, { backgroundColor: palette.surface, shadowColor: palette.primary }]}>
          <View style={styles.voteHeader}>
            <View style={styles.voteUser}>
              <Image source={{ uri: battleData.left.avatar }} style={styles.voteAvatar} />
              <View>
                <Text style={[styles.voteUserName, { color: text }]}>{battleData.left.name}</Text>
                <Text style={[styles.voteUserMeta, { color: palette.muted }]}>{battleData.left.score}</Text>
              </View>
            </View>

            <View style={styles.voteVsWrap}>
              <Text style={[styles.voteVsText, { color: palette.primary }]}>VS</Text>
            </View>

            <View style={styles.voteUserRight}>
              <Text style={[styles.teamLabel, { color: palette.muted }]}>Team</Text>
              <View style={styles.voteUserInline}>
                <Text style={[styles.voteUserName, { color: text }]}>{battleData.right.handle}</Text>
                <Image source={{ uri: battleData.right.avatar }} style={styles.voteAvatarSmall} />
              </View>
            </View>
          </View>

          <View style={styles.teamStatsRow}>
            <View style={styles.teamStatsBlock}>
              <Text style={[styles.teamName, { color: withAlpha(text, 'CC') }]}>{battleData.left.team}</Text>
              <Text style={[styles.teamVotes, { color: palette.primary }]}>{battleData.left.voteCount}</Text>
            </View>
            <View style={styles.teamStatsBlock}>
              <Text style={[styles.teamName, { color: palette.secondary }]}>{battleData.right.team}</Text>
              <Text style={[styles.teamVotes, { color: palette.secondary }]}>{battleData.right.voteCount}</Text>
            </View>
          </View>

          <Text style={[styles.summaryText, { color: withAlpha(text, 'BB') }]}>{battleData.summary}</Text>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton}>
              <Icon name="thumb-up-off-alt" size={18} color={palette.primary} />
              <Text style={[styles.socialButtonText, { color: withAlpha(text, 'C0') }]}>Like</Text>
            </TouchableOpacity>
            <View style={styles.likeCounter}>
              <Icon name="thumb-up" size={16} color={palette.primary} />
              <Text style={[styles.likeCounterText, { color: withAlpha(text, 'C0') }]}>{battleData.likes}</Text>
            </View>
          </View>

          <TouchableOpacity activeOpacity={0.88}>
            <LinearGradient
              colors={[palette.primary, palette.secondary]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.voteButton}
            >
              <Text style={styles.voteButtonText}>VOTE NOW</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    marginTop: '10%',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  prompt: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  heroCard: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  heroGlowOne: {
    position: 'absolute',
    top: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroGlowTwo: {
    position: 'absolute',
    bottom: -40,
    right: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  competitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerColumn: {
    width: '34%',
    alignItems: 'center',
  },
  namePill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 12,
    minWidth: '100%',
  },
  namePillTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  namePillMeta: {
    color: '#efe7ff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: '#fff',
    marginBottom: 8,
  },
  avatarLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  vsBlock: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  vsText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 42,
  },
  potBadge: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffd28b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  potText: {
    marginLeft: 4,
    color: '#8b3d17',
    fontSize: 12,
    fontWeight: '800',
  },
  heroScoreRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroScoreText: {
    color: '#f1e8ff',
    fontSize: 13,
    fontWeight: '700',
  },
  updateBar: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#7150ab',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  updateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  updateText: {
    flex: 1,
    color: '#7a6b8f',
    fontSize: 12,
    fontWeight: '600',
  },
  voteCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 16,
    shadowColor: '#7150ab',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
    marginBottom: '10%'
  },
  voteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  voteUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  voteUserRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  voteUserInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  voteAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 8,
  },
  voteUserName: {
    color: '#2a1f41',
    fontSize: 14,
    fontWeight: '800',
  },
  voteUserMeta: {
    color: '#8d82a2',
    fontSize: 12,
    marginTop: 2,
  },
  voteVsWrap: {
    paddingHorizontal: 10,
  },
  voteVsText: {
    fontSize: 18,
    fontWeight: '900',
  },
  teamLabel: {
    color: '#ad9fbe',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  teamStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  teamStatsBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  teamName: {
    color: '#4a3f5d',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  teamVotes: {
    fontSize: 24,
    fontWeight: '900',
  },
  summaryText: {
    color: '#655a77',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 14,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialButtonText: {
    marginLeft: 6,
    color: '#6d5c85',
    fontSize: 13,
    fontWeight: '700',
  },
  likeCounter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCounterText: {
    marginLeft: 6,
    color: '#6d5c85',
    fontSize: 13,
    fontWeight: '700',
  },
  voteButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: '10%',

  },
  voteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
