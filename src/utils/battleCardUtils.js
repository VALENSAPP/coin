/**
 * Shared battle-card utilities used by SearchScreen and BattleExplore.
 */

export const parseNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const formatAmount = value =>
  parseNonNegativeNumber(value, 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

export const formatBattleDate = value => {
  if (!value) return 'No end date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No end date';
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${day}/${month}`;
};

export const formatBattleCountdown = value => {
  if (!value) return 'Ended';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Ended';

  const now = new Date();
  const diffMs = parsed.getTime() - now.getTime();

  if (diffMs <= 0) return 'Ended';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return `Ends in ${diffDays}d`;
  if (diffHours > 0) return `Ends in ${diffHours}h`;
  return `Ends in ${diffMins}m`;
};

export const formatBattleCount = value => {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return `${count}`;
};

export const pickBattleDisplayText = (...values) =>
  values.find(value => {
    if (value === undefined || value === null) return false;
    const normalized = `${value}`.trim().toLowerCase();
    return normalized && normalized !== 'null' && normalized !== 'undefined';
  });

export const normalizeBattleOptionLabel = (option, index) => {
  if (typeof option === 'string') return option.trim();
  return pickBattleDisplayText(
    option?.label, option?.text, option?.value,
    option?.side, option?.name, `Option ${index + 1}`,
  );
};

export const buildBattleFallbackParticipant = (battle, index) => {
  const optionLabel = normalizeBattleOptionLabel(battle?.options?.[index], index);
  if (index === 0) {
    return {
      userName: pickBattleDisplayText(battle?.creator?.userName, battle?.creator?.username, ''),
      name: pickBattleDisplayText(optionLabel, battle?.creator?.displayName, battle?.creator?.name, battle?.creator?.userName, 'Creator'),
      avatar: pickBattleDisplayText(battle?.creator?.image, battle?.creator?.avatar, battle?.creator?.profilePicture, ''),
    };
  }
  return {
    userName: pickBattleDisplayText(battle?.invitedUser?.userName, battle?.invitedUser?.username, battle?.opponent?.userName, battle?.opponent?.username, ''),
    name: pickBattleDisplayText(optionLabel, battle?.invitedUser?.displayName, battle?.invitedUser?.name, battle?.opponent?.displayName, battle?.opponent?.name, 'Opponent'),
    avatar: pickBattleDisplayText(battle?.invitedUser?.image, battle?.invitedUser?.avatar, battle?.invitedUser?.profilePicture, battle?.opponent?.image, battle?.opponent?.avatar, battle?.opponent?.profilePicture, ''),
  };
};

export const getBattleParticipant = (battle, index) => {
  const participants = battle?.participants || battle?.users || battle?.challengers || battle?.players || [];
  const participant = Array.isArray(participants) ? participants[index] : null;
  if (participant) {
    return {
      userName: participant?.userName || participant?.username || participant?.handle || `user${index + 1}`,
      name: participant?.name || participant?.fullName || participant?.displayName || participant?.userName || `User ${index + 1}`,
      avatar: participant?.avatar || participant?.profilePicture || participant?.image || participant?.photo || '',
    };
  }
  const directUser = battle?.[`user${index + 1}`];
  if (directUser) {
    return {
      userName: directUser?.userName || directUser?.username || `user${index + 1}`,
      name: directUser?.name || directUser?.fullName || directUser?.userName || `User ${index + 1}`,
      avatar: directUser?.avatar || directUser?.profilePicture || directUser?.image || '',
    };
  }
  return buildBattleFallbackParticipant(battle, index);
};

export const buildBattleOptions = battle => {
  const rawOptions = Array.isArray(battle?.options) ? battle.options : [];
  const optionImages = Array.isArray(battle?.optionImages) ? battle.optionImages : [];
  const normalizedOptions = rawOptions
    .map((option, index) => {
      const label = normalizeBattleOptionLabel(option, index);
      if (!label) return null;
      return {
        id: String(option?.id || option?._id || label || index),
        label,
        image: pickBattleDisplayText(
          optionImages[index],
          option?.optionImage,
          option?.image,
          option?.icon,
          option?.picture,
          option?.photo,
        ),
      };
    })
    .filter(Boolean);
  if (normalizedOptions.length > 0) return normalizedOptions;
  if (String(battle?.format || '').toUpperCase() === 'HEAD_TO_HEAD') {
    return [getBattleParticipant(battle, 0), getBattleParticipant(battle, 1)]
      .map((participant, index) => {
        const label = pickBattleDisplayText(participant?.name, participant?.userName, `Option ${index + 1}`);
        return { id: `fallback-${index + 1}`, label, image: optionImages[index] || participant?.avatar };
      })
      .filter(item => item?.label);
  }
  return [];
};

export const mapBattleCard = battle => {
  const creator = {
    id: battle?.creator?.id || battle?.creatorId || '',
    userName: battle?.creator?.userName || battle?.creator?.username || 'creator',
    name: battle?.creator?.displayName || battle?.creator?.name || battle?.creator?.userName || 'Creator',
    avatar: battle?.creator?.image || battle?.creator?.avatar || battle?.creator?.profilePicture || '',
  };
  return {
    id: String(battle?.id || battle?._id || battle?.battleId || ''),
    format: battle?.format || 'POLL',
    creator,
    user1: getBattleParticipant(battle, 0),
    user2: getBattleParticipant(battle, 1),
    opponent: battle?.opponent ? {
      id: battle.opponent.id || '',
      userName: battle.opponent.userName || battle.opponent.username || '',
      name: battle.opponent.displayName || battle.opponent.name || battle.opponent.userName || '',
      avatar: battle.opponent.image || battle.opponent.avatar || battle.opponent.profilePicture || '',
      profile: battle.opponent.profile || 'user',
    } : null,
    title: battle?.title || battle?.question || battle?.headline || 'Untitled battle',
    options: buildBattleOptions(battle),
    isLive: Boolean(battle?.isLive || battle?.live || battle?.status === 'LIVE' || battle?.status === 'live'),
    status: battle?.status || '',
    stakeAmount: battle?.stakeAmount ?? battle?.stake ?? 0,
    totalParticipants: battle?._count?.participants ?? 0,
    totalComments: battle?._count?.comments ?? battle?.commentsCount ?? battle?.totalComments ?? 0,
    totalLikes: battle?._count?.likes ?? battle?.likesCount ?? battle?.totalLikes ?? battle?._count?.votes ?? battle?.votesCount ?? 0,
    totalVotes: battle?._count?.votes ?? battle?.votesCount ?? 0,
    endTime: battle?.endTime || null,
    optionImages: Array.isArray(battle?.optionImages) ? battle.optionImages : [],
    voteCounts: battle?.voteCounts && typeof battle.voteCounts === 'object' ? battle.voteCounts : {},
    predictionCounts:
      battle?.predictionCounts && typeof battle.predictionCounts === 'object'
        ? battle.predictionCounts
        : {},
  };
};

