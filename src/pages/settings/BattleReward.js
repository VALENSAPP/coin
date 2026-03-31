import React, { useMemo } from 'react';
import {
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
import { useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import { normalizeProfileType } from '../../utils/supportEligibility';

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
};

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const buildRewardData = battle => {
  const stake = Number(pickFirst(battle?.stake, battle?.stakeAmount, 0));
  const battleType = String(
    pickFirst(battle?.battleType, 'OPINION'),
  ).toUpperCase();
  const victoryBonus = Math.max(Math.round(stake * 0.5), 100);
  const engagementBonus = Math.max(Math.round(stake * 0.25), 50);
  const accuracyBonus =
    battleType === 'PREDICTION' ? Math.max(Math.round(stake * 0.25), 50) : 0;
  const totalReward = victoryBonus + engagementBonus + accuracyBonus;

  return {
    title: pickFirst(battle?.title, battle?.question, 'Battle Reward'),
    reward: `${totalReward} Points`,
    rank: '#1',
    status:
      battleType === 'PREDICTION'
        ? 'Accuracy Reward Unlocked'
        : 'Community Reward Unlocked',
    summary:
      battleType === 'PREDICTION'
        ? 'You earned points for the winning prediction, with accuracy weighted ahead of social engagement.'
        : 'You earned points for winning the community battle through votes and argument engagement.',
    breakdown: [
      { label: 'Victory Bonus', value: `+${victoryBonus}` },
      { label: 'Engagement Bonus', value: `+${engagementBonus}` },
      ...(accuracyBonus
        ? [{ label: 'Accuracy Bonus', value: `+${accuracyBonus}` }]
        : []),
    ],
    perks: [
      'Cred points have been added to your balance',
      'Battle performance has been updated on your profile',
      battleType === 'PREDICTION'
        ? 'Prediction accuracy score has been improved'
        : 'Community battle reputation has been improved',
    ],
  };
};

export default function BattleReward({ navigation }) {
  const route = useRoute();
  const resolvedProfileType = normalizeProfileType(route?.params?.profile);
  const { bgStyle, text, card } = useAppTheme(resolvedProfileType);
  const rewardData = useMemo(
    () => buildRewardData(route?.params?.battle),
    [route?.params?.battle],
  );
  const palette = useMemo(() => {
    const primary = text || '#5a2d82';
    const secondary =
      primary.toLowerCase() === '#d3b683' ? '#b8924f' : '#8f54f7';

    return {
      primary,
      secondary,
      surface: card || '#fff',
      muted: withAlpha(primary, 'B5'),
      soft: withAlpha(primary, '18'),
      warm: '#ffd184',
      warmText: '#97591a',
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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIconBtn}
          >
            <Icon name="arrow-back-ios-new" size={20} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]}>
            Battle Reward
          </Text>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="gift-outline" size={20} color={text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.subTitle, { color: text }]}>
          {rewardData.title}
        </Text>

        <LinearGradient
          colors={[palette.secondary, palette.primary, palette.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rewardHero}
        >
          <View
            style={[styles.rewardGlowTop, { backgroundColor: palette.soft }]}
          />
          <View
            style={[
              styles.rewardGlowBottom,
              { backgroundColor: withAlpha(palette.secondary, '14') },
            ]}
          />

          <View
            style={[
              styles.crownWrap,
              { backgroundColor: withAlpha('#FFFFFF', '2A') },
            ]}
          >
            <Ionicons name="trophy-outline" size={34} color={palette.warm} />
          </View>
          <Text style={styles.rewardBadgeText}>{rewardData.status}</Text>
          <Text style={styles.rewardMainValue}>{rewardData.reward}</Text>
          <Text style={styles.rewardRank}>Battle Rank {rewardData.rank}</Text>
        </LinearGradient>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.infoTitle, { color: withAlpha(text, 'D0') }]}>
            Reward Summary
          </Text>
          <Text style={[styles.infoText, { color: palette.muted }]}>
            {rewardData.summary}
          </Text>
        </View>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.infoTitle, { color: withAlpha(text, 'D0') }]}>
            Points Breakdown
          </Text>
          {rewardData.breakdown.map(item => (
            <View key={item.label} style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: palette.muted }]}>
                {item.label}
              </Text>
              <Text style={[styles.breakdownValue, { color: text }]}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.infoCard,
            { backgroundColor: palette.surface, shadowColor: palette.primary },
          ]}
        >
          <Text style={[styles.infoTitle, { color: withAlpha(text, 'D0') }]}>
            Unlocked Perks
          </Text>
          {rewardData.perks.map(item => (
            <View key={item} style={styles.perkRow}>
              <View
                style={[styles.perkDot, { backgroundColor: palette.primary }]}
              />
              <Text style={[styles.perkText, { color: palette.muted }]}>
                {item}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.88} style={styles.claimButton}>
          <LinearGradient
            colors={[palette.primary, palette.secondary]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.claimButton}
          >
            <Text style={styles.claimButtonText}>Collect Reward</Text>
          </LinearGradient>
        </TouchableOpacity>
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
  subTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 25,
  },
  rewardHero: {
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  rewardGlowTop: {
    position: 'absolute',
    top: -30,
    left: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  rewardGlowBottom: {
    position: 'absolute',
    right: -20,
    bottom: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  crownWrap: {
    width: 72,
    height: 80,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rewardBadgeText: {
    color: '#f3ebff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  rewardMainValue: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 4,
  },
  rewardRank: {
    color: '#e8dcff',
    fontSize: 15,
    fontWeight: '700',
  },
  infoCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  perkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  claimButton: {
    marginTop: 18,
    borderRadius: 20,
    height: 40,
    width: '100%',
    justifyContent:'center',
    alignItems: 'center',
    marginBottom: '10%',
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
