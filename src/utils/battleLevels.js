/**
 * Battle reputation levels (Valens Reputation).
 * Thresholds are static product rules; current level can also come from API `level`.
 * Dragonfly icon variant follows battle level (not followers).
 */

import {
  BlueDragonfly,
  GoldDragonfly,
  GoldLavenderDragonfly,
  LavenderDragonfly,
  LilacDragonfly,
  SoftGrayDragonfly,
  WhiteDragonfly,
  WhiteSmokeDragonfly,
} from '../assets/icons';

export const BATTLE_LEVELS = [
  {
    id: 'entry',
    level: 1,
    title: 'ENTRY',
    color: '#9CA3AF',
    iconId: 'softGray',
    points: 0,
    battlesWon: 0,
    credibility: 0,
    accuracy: null,
  },
  {
    id: 'challenger',
    level: 2,
    title: 'CHALLENGER',
    color: '#A5B4FC',
    iconId: 'lilac',
    points: 200,
   
  },
  {
    id: 'contender',
    level: 3,
    title: 'CONTENDER',
    color: '#60A5FA',
    iconId: 'blue',
    points: 600,
   
  },
  {
    id: 'strategist',
    level: 4,
    title: 'STRATEGIST',
    color: '#8B5CF6',
    iconId: 'lavender',
    points: 1500,
  
  },
  {
    id: 'dominator',
    level: 5,
    title: 'DOMINATOR',
    color: '#EC4899',
    iconId: 'lilac',
    points: 3500,
   
  },
  {
    id: 'titan',
    level: 6,
    title: 'TITAN',
    color: '#F59E0B',
    iconId: 'gold',
    points: 7500,
    
  },
  {
    id: 'oracle',
    level: 7,
    title: 'ORACLE',
    color: '#7C3AED',
    iconId: 'lavender',
    points: 15000,
   
  },
  {
    id: 'phantom',
    level: 8,
    title: 'PHANTOM',
    color: '#14B8A6',
    iconId: 'blue',
    points: 32000,
   
  },
  {
    id: 'immortal',
    level: 9,
    title: 'IMMORTAL',
    color: '#6366F1',
    iconId: 'lilac',
    points: 75000,
   
  },
  {
    id: 'champion',
    level: 10,
    title: 'VALENS CHAMPION',
    color: '#B45309',
    iconId: 'goldLavender',
    points: 150000,
   
  },
];

/**
 * Pick dragonfly SVG for a battle level.
 * Light navy assets (white/softGray/whiteSmoke) swap to Lilac in dark mode so they stay visible.
 */
export function getBattleLevelDragonflyIcon(iconId, isDarkMode = false) {
  switch (iconId) {
    case 'white':
      return isDarkMode ? LilacDragonfly : WhiteDragonfly;
    case 'softGray':
      return isDarkMode ? LilacDragonfly : SoftGrayDragonfly;
    case 'whiteSmoke':
      return isDarkMode ? LilacDragonfly : WhiteSmokeDragonfly;
    case 'blue':
      return BlueDragonfly;
    case 'lilac':
      return LilacDragonfly;
    case 'lavender':
      return LavenderDragonfly;
    case 'gold':
      return GoldDragonfly;
    case 'goldLavender':
      return GoldLavenderDragonfly;
    default:
      return isDarkMode ? LilacDragonfly : SoftGrayDragonfly;
  }
}

const LEVEL_ALIASES = {
  entry: 'entry',
  rookie: 'entry',
  challenger: 'challenger',
  contender: 'contender',
  pro: 'contender',
  strategist: 'strategist',
  dominator: 'dominator',
  analyst: 'dominator',
  expert: 'titan',
  titan: 'titan',
  master: 'titan',
  oracle: 'oracle',
  phantom: 'phantom',
  legend: 'phantom',
  immortal: 'immortal',
  champion: 'champion',
  'valens champion': 'champion',
  valenschampion: 'champion',
};

const meetsThreshold = (stats, tier) => {
  const points = Number(stats?.points || 0);
  const battlesWon = Number(stats?.battlesWon || 0);
  const credibility = Number(stats?.credibility || 0);
  const accuracy = Number(stats?.accuracy || 0);

  if (points < tier.points) return false;
  if (battlesWon < tier.battlesWon) return false;
  if (credibility < tier.credibility) return false;
  if (tier.accuracy != null && accuracy < tier.accuracy) return false;
  return true;
};

export function resolveBattleLevelFromApi(levelName) {
  const normalized = String(levelName || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  const alias = LEVEL_ALIASES[normalized] || LEVEL_ALIASES[normalized.replace(/\s/g, '')];
  if (!alias) return null;
  return BATTLE_LEVELS.find((tier) => tier.id === alias) || null;
}

export function resolveBattleLevelFromStats(stats) {
  let matched = BATTLE_LEVELS[0];
  for (const tier of BATTLE_LEVELS) {
    if (meetsThreshold(stats, tier)) matched = tier;
  }
  return matched;
}

/**
 * Prefer API level string when recognizable; otherwise derive from stats.
 */
export function resolveBattleLevel({ level, points, battlesWon, credibility, accuracy }) {
  const fromApi = resolveBattleLevelFromApi(level);
  if (fromApi) return fromApi;
  return resolveBattleLevelFromStats({ points, battlesWon, credibility, accuracy });
}

export function formatBattleLevelRequirement(tier, labels = {}) {
  const pointsLabel = labels.points || 'Points';
  const winsLabel = labels.battlesWon || 'Battles Won';
  const credibilityLabel = labels.credibility || 'Credibility';
  const accuracyLabel = labels.accuracy || 'Accuracy';

  return [
    {
      key: 'points',
      icon: 'star',
      text:
        tier.points <= 0
          ? `0 ${pointsLabel}`
          : tier.id === 'champion'
            ? `${tier.points.toLocaleString()}+ ${pointsLabel}`
            : `${tier.points.toLocaleString()} ${pointsLabel}`,
    },
    // {
    //   key: 'wins',
    //   icon: 'sword-cross',
    //   text: `${tier.battlesWon.toLocaleString()} ${winsLabel}`,
    // },
    // {
    //   key: 'credibility',
    //   icon: 'shield-checkmark',
    //   text: `${tier.credibility.toLocaleString()} ${credibilityLabel}`,
    // },
    // {
    //   key: 'accuracy',
    //   icon: 'speedometer',
    //   text: tier.accuracy == null ? '—' : `${tier.accuracy}% ${accuracyLabel}`,
    // },
  ];
}
