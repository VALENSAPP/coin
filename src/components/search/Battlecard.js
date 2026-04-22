/**
 * BattleCard — React Native component
 *
 * Fixes in this version:
 * 1. Green pulsing dot when battle isLive, orange dot otherwise
 * 2. Solo battle (no opponent yet): creator on LEFT, dashed "Waiting" slot on RIGHT
 * 3. Auto-scroll handled by AutoScrollBattleRow (export at bottom) — drop it into
 *    SearchScreen in place of the plain <ScrollView> that wraps the battle cards.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    ScrollView,
    Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import HexAvatar from '../../components/home/story.js/HexAvatar';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeImageUrl = url => {
    if (!url || typeof url !== 'string') return null;
    const t = url.trim();
    if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:') || t.startsWith('file://')) return t;
    if (t.startsWith('/')) return `http://35.174.167.92:3002${t}`;
    return `http://35.174.167.92:3002/${t}`;
};

const formatAmount = value => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0
        ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : '0';
};

const formatBattleDate = value => {
    if (!value) return 'No end date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No end date';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatBattleCountdown = value => {
    if (!value) return 'Ended';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Ended';
    const diffMs = parsed.getTime() - Date.now();
    if (diffMs <= 0) return 'Ended';
    const diffDays = Math.floor(diffMs / 86400000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffDays > 0) return `Ends in ${diffDays}d`;
    if (diffHours > 0) return `Ends in ${diffHours}h`;
    return `Ends in ${diffMins}m`;
};

const formatBattleCount = value => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return `${n}`;
};

const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
};

// Returns true when user2 has no real identity (battle waiting for opponent)
const isEmptyOpponent = user2 => {
    if (!user2) return true;
    const name = (user2.name || '').trim().toLowerCase();
    const handle = (user2.userName || '').trim();
    const avatar = (user2.avatar || '').trim();
    const isPlaceholder = !name || name === 'opponent' || name === 'user 2' || name === 'null';
    return isPlaceholder && !handle && !avatar;
};

// ─── LiveDot ──────────────────────────────────────────────────────────────────

const LiveDot = () => {
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 2, duration: 800, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [pulse]);

    return (
        <View style={styles.liveDotWrapper}>
            <Animated.View style={[styles.liveDotRing, { transform: [{ scale: pulse }] }]} />
            <View style={styles.liveDotCore} />
        </View>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const TimerBadge = ({ endTime, ended }) => (
    <View style={styles.timerBadge}>
        <Icon name="time-outline" size={11} color={ended ? '#A32D2D' : '#888780'} style={{ marginRight: 3 }} />
        <Text style={[styles.timerText, ended && styles.timerTextEnded]}>
            {formatBattleCountdown(endTime)}
        </Text>
    </View>
);

const ModeBadge = ({ format, ended, isLive }) => (
    <View style={[styles.modeBadge, ended && styles.modeBadgeEnded]}>
        {!ended && (isLive ? <LiveDot /> : <View style={styles.modeBadgeDotOrange} />)}
        <Text style={[styles.modeBadgeText, ended && styles.modeBadgeTextEnded]}>
            {format === 'POLL' ? 'Poll' : 'Battle Mode 🔥'}
        </Text>
    </View>
);

const ParticipantAvatar = ({ avatarUrl, name, handle, isEmpty }) => {
    if (isEmpty) {
        return (
            <View style={styles.participant}>
                <View style={styles.emptySlot}>
                    <Icon name="person-add-outline" size={18} color="#A78BFA" />
                </View>
                <Text style={styles.waitingLabel}>Waiting...</Text>
                <Text style={styles.waitingSub}>Open slot</Text>
            </View>
        );
    }
    return (
        <View style={styles.participant}>
            <HexAvatar
                uri={normalizeImageUrl(avatarUrl) || DEFAULT_AVATAR}
                size={52}
                borderWidth={2}
                borderColor="#7F77DD"
            />
            <Text style={styles.participantName} numberOfLines={1}>{name}</Text>
            {!!handle && <Text style={styles.participantHandle} numberOfLines={1}>@{handle}</Text>}
        </View>
    );
};

const StakePill = ({ amount }) => (
    <View style={styles.stakePill}>
        <Icon name="flash" size={13} color="#7F77DD" />
        <Text style={styles.stakeText}>
            Stakes: <Text style={styles.stakeAmount}>{formatAmount(amount)}</Text>
        </Text>
    </View>
);

const OptionChip = ({ option, isSelected, onPress, disabled, avatarUrl }) => (
    <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onPress}
        style={[styles.optionChip, isSelected && styles.optionChipSelected, disabled && styles.optionDisabled]}
    >
        <HexAvatar uri={normalizeImageUrl(avatarUrl) || DEFAULT_AVATAR} size={24} fadeDuration={0} />
        <Text style={[styles.optionChipLabel, isSelected && styles.optionChipLabelSelected]} numberOfLines={1}>
            {option?.label || option}
        </Text>
        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
            {isSelected && <View style={styles.radioInner} />}
        </View>
    </TouchableOpacity>
);

const StatRow = ({ totalParticipants, totalLikes, totalComments }) => (
    <View style={styles.statsRow}>
        <View style={styles.statItem}>
            <Icon name="people-outline" size={13} color="#888780" />
            <Text style={styles.statText}>{formatBattleCount(totalParticipants)}</Text>
        </View>
        <View style={styles.statDot} />
        {/* <View style={styles.statItem}>
            <Icon name="thumbs-up-outline" size={13} color="#888780" />
            <Text style={styles.statText}>{formatBattleCount(totalLikes)}</Text>
        </View> */}
        {/* <View style={styles.statDot} /> */}
        <View style={styles.statItem}>
            <View style={{ marginTop: 2 }}>
                <Icon name="chatbox-ellipses-outline" size={13} color="#888780" />
            </View>
            <Text style={styles.statText}>{formatBattleCount(totalComments)}</Text>
        </View>
    </View>
);

// ─── BattleCard ───────────────────────────────────────────────────────────────

const BattleCard = memo(({ item, selectedOption, onCardPress, onOptionSelect }) => {
    const ended = formatBattleCountdown(item.endTime) === 'Ended';
    const isPoll = item.format === 'POLL';
    const soloOpponent = !isPoll && !item.opponent && isEmptyOpponent(item.user2);

    // Ensure optionImages is always an array
    const optionImages = Array.isArray(item?.optionImages) ? item.optionImages : [];

    const handleOption = useCallback(
        label => { if (!ended) onOptionSelect(item.id, label); },
        [ended, item.id, onOptionSelect],
    );

    console.log('Rendering BattleCard', { id: item, optionImages, opponent: item.opponent });
    if (isPoll) {
        return (
            <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.card, ended && styles.cardEnded]}
                onPress={() => onCardPress(item)}
            >
                <View style={styles.cardTopRow}>
                    <View style={styles.pollCreatorRow}>
                        <HexAvatar uri={normalizeImageUrl(item.creator.avatar) || DEFAULT_AVATAR} size={36} borderWidth={2} borderColor="#7F77DD" />
                        <View style={{ marginLeft: 8, flex: 1 }}>
                            <Text style={styles.pollCreatorName} numberOfLines={1}>{item.creator.name}</Text>
                            <Text style={styles.pollCreatorHandle} numberOfLines={1}>@{item.creator.userName}</Text>
                        </View>
                    </View>
                    <ModeBadge format="POLL" ended={ended} isLive={item.isLive} />
                </View>

                <TimerBadge endTime={item.endTime} ended={ended} />
                <Text style={[styles.question, { marginTop: 6 }]} numberOfLines={3}>{item.title}</Text>

                {item.options?.length > 0 && (
                    <View style={styles.pollOptions}>
                        {chunk(item.options.slice(0, 4), 2).map((pair, rowIdx) => (
                            <View key={rowIdx} style={styles.joinRow}>
                                {pair.map((option, pairIdx) => {
                                    const originalIndex = rowIdx * 2 + pairIdx;
                                    const optionImageUrl = optionImages[originalIndex];
                                    const label = option?.label || option;
                                    const isSelected = selectedOption === label;
                                    return (
                                        <OptionChip
                                            key={`${item.id}-${option?.id || label}`}
                                            option={option}
                                            isSelected={isSelected}
                                            disabled={ended}
                                            avatarUrl={optionImageUrl || option?.image || DEFAULT_AVATAR}
                                            onPress={() => handleOption(label)}
                                        />
                                    );
                                })}
                                {pair.length === 1 && <View style={{ flex: 1 }} />}
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.metaRow}>
                    <StakePill amount={formatAmount(item.stakeAmount || 0)}/>
                    {/* <Text style={styles.metaText}>Stake: {formatAmount(item.stakeAmount || 0)}</Text> */}
                    <Text style={styles.metaText}>Ends: {formatBattleDate(item.endTime)}</Text>
                </View>

                <View style={styles.divider} />
                <StatRow totalParticipants={item.totalParticipants} totalLikes={item.totalLikes} totalComments={item.totalComments} />
            </TouchableOpacity>
        );
    }

    // HEAD_TO_HEAD
    return (
        <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.card, ended && styles.cardEnded]}
            onPress={() => onCardPress(item)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
            <View style={styles.cardTopRow}>
                <ModeBadge format={item.format} ended={ended} isLive={item.isLive} />
                <TimerBadge endTime={item.endTime} ended={ended} />
            </View>

            {/* Always render both slots — right is dashed if opponent missing */}
            <View style={styles.versusRow}>
                <ParticipantAvatar avatarUrl={item.user1.avatar} name={item.user1.name} handle={item.user1.userName} isEmpty={false} />
                <Text style={styles.vsIcon}>⚔️</Text>
                {item.opponent ? (
                    <ParticipantAvatar avatarUrl={item.opponent.avatar} name={item.user2.name} handle={item.opponent.userName} isEmpty={false} />
                ) : (
                    <ParticipantAvatar avatarUrl={item.user2?.avatar} name={item.user2?.name} handle={item.user2?.userName} isEmpty={soloOpponent} />
                )}
            </View>

            <Text style={styles.question} numberOfLines={2}>{item.title}</Text>
            <StakePill amount={item.stakeAmount || 0} />

            {/* Option chips only when both participants exist */}
            {!soloOpponent && item.options?.length > 0 && (
                <View style={styles.joinRow}>
                    {item.options.slice(0, 2).map((option, idx) => {
                        const optionImageUrl = optionImages[idx];
                        const label = option?.label || option;
                        const isSelected = selectedOption === label;
                        return (
                            <OptionChip
                                key={`${item.id}-${option?.id || label}`}
                                option={option}
                                isSelected={isSelected}
                                disabled={ended}
                                avatarUrl={optionImageUrl || option?.image || DEFAULT_AVATAR}
                                onPress={() => handleOption(label)}
                            />
                        );
                    })}
                </View>
            )}

            {/* Accept challenge CTA for solo battles */}
            {soloOpponent && (
                <TouchableOpacity style={styles.acceptBtn} onPress={() => onCardPress(item)} activeOpacity={0.85}>
                    <Icon name="add-circle-outline" size={14} color="#fff" style={{ marginRight: 5 }} />
                    <Text style={styles.acceptBtnText}>Accept Challenge</Text>
                </TouchableOpacity>
            )}

            <View style={styles.divider} />
            <StatRow totalParticipants={item.totalParticipants} totalLikes={item.totalLikes} totalComments={item.totalComments} />
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Return true if props are equal (don't re-render), false to re-render
    return (
        prevProps.item?.id === nextProps.item?.id &&
        prevProps.selectedOption === nextProps.selectedOption &&
        prevProps.item?.isLive === nextProps.item?.isLive &&
        prevProps.item?.status === nextProps.item?.status &&
        prevProps.onCardPress === nextProps.onCardPress &&       
        prevProps.onOptionSelect === nextProps.onOptionSelect &&
        JSON.stringify(prevProps.item?.optionImages) === JSON.stringify(nextProps.item?.optionImages) &&
        JSON.stringify(prevProps.item?.opponent) === JSON.stringify(nextProps.item?.opponent)
    );
});

export default BattleCard;

const CARD_WIDTH = 268;
const CARD_GAP = 10;
const RESUME_DELAY_MS = 1000;
const AUTO_SCROLL_SPEED_PX_PER_MS = 0.055;
const START_DELAY_MS = 300;
const EDGE_SNAP_THRESHOLD = 8;
const ROW_PADDING_LEFT = 12;

export const AutoScrollBattleRow = ({ children, style }) => {
  const scrollViewRef = useRef(null);
  const autoScrollFrameRef = useRef(null);
  const resumeTimeoutRef = useRef(null);
  const pausedRef = useRef(false);
  const offsetRef = useRef(0);
  const lastFrameTsRef = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const allChildren = React.Children.toArray(children);
  const isCarouselEnabled = allChildren.length > 1;
  const maxOffset = Math.max(0, contentWidth - viewportWidth);
  const canAutoScroll = isCarouselEnabled && maxOffset > 0;

  const clearResumeTimer = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    lastFrameTsRef.current = 0;
  }, []);

  const syncScrollPosition = useCallback(nextOffset => {
    const safeOffset = Math.max(0, Math.min(nextOffset, maxOffset));
    offsetRef.current = safeOffset;
    scrollViewRef.current?.scrollTo({ x: safeOffset, animated: false });
  }, [maxOffset]);

  const startAutoScroll = useCallback((fromOffset = offsetRef.current) => {
    if (!canAutoScroll || pausedRef.current) return;

    stopAutoScroll();
    syncScrollPosition(fromOffset);

    const tick = timestamp => {
      if (pausedRef.current || !canAutoScroll) {
        stopAutoScroll();
        return;
      }

      if (!lastFrameTsRef.current) {
        lastFrameTsRef.current = timestamp;
      }

      const deltaMs = timestamp - lastFrameTsRef.current;
      lastFrameTsRef.current = timestamp;

      let nextOffset = offsetRef.current + (deltaMs * AUTO_SCROLL_SPEED_PX_PER_MS);
      if (nextOffset >= maxOffset) {
        nextOffset = 0;
      }

      syncScrollPosition(nextOffset);
      autoScrollFrameRef.current = requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = requestAnimationFrame(tick);
  }, [canAutoScroll, maxOffset, stopAutoScroll, syncScrollPosition]);

  useEffect(() => {
    if (!canAutoScroll) {
      clearResumeTimer();
      stopAutoScroll();
      pausedRef.current = false;
      syncScrollPosition(0);
      return undefined;
    }

    const t = setTimeout(() => startAutoScroll(offsetRef.current), START_DELAY_MS);
    return () => {
      clearTimeout(t);
      clearResumeTimer();
      stopAutoScroll();
    };
  }, [canAutoScroll, startAutoScroll, clearResumeTimer, stopAutoScroll, syncScrollPosition]);

  useEffect(() => {
    if (!canAutoScroll) return;
    if (offsetRef.current > maxOffset) {
      syncScrollPosition(maxOffset);
    }
  }, [canAutoScroll, maxOffset, syncScrollPosition]);

  useEffect(() => {
    return () => {
      clearResumeTimer();
      stopAutoScroll();
    };
  }, [clearResumeTimer, stopAutoScroll]);

  const handleInteractionStart = useCallback(() => {
    clearResumeTimer();
    pausedRef.current = true;
    stopAutoScroll();
  }, [clearResumeTimer, stopAutoScroll]);

  const handleInteractionEnd = useCallback(() => {
    clearResumeTimer();
    if (!canAutoScroll) {
      pausedRef.current = false;
      return;
    }

    resumeTimeoutRef.current = setTimeout(() => {
      const currentOffset = offsetRef.current;
      if (currentOffset >= maxOffset - EDGE_SNAP_THRESHOLD) {
        syncScrollPosition(0);
      }
      pausedRef.current = false;
      startAutoScroll(offsetRef.current);
    }, RESUME_DELAY_MS);
  }, [canAutoScroll, maxOffset, clearResumeTimer, startAutoScroll, syncScrollPosition]);

  if (!isCarouselEnabled) {
    return (
      <View
        style={[
          { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: ROW_PADDING_LEFT },
          style,
        ]}
      >
        {allChildren}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={canAutoScroll}
      bounces={false}
      alwaysBounceHorizontal={false}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
      delayContentTouches={false}
      scrollEventThrottle={16}
      onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
      onContentSizeChange={width => setContentWidth(width)}
      onScroll={event => {
        offsetRef.current = event?.nativeEvent?.contentOffset?.x ?? 0;
      }}
      onTouchStart={handleInteractionStart}
      onScrollBeginDrag={handleInteractionStart}
      onScrollEndDrag={handleInteractionEnd}
      onMomentumScrollEnd={handleInteractionEnd}
      onTouchEnd={handleInteractionEnd}
      contentContainerStyle={[
        { flexDirection: 'row', gap: CARD_GAP, paddingLeft: ROW_PADDING_LEFT },
        style,
      ]}
    >
      {allChildren}
    </ScrollView>
  );
};
// ─── Styles ───────────────────────────────────────────────────────────────────

const PURPLE = '#7F77DD';
const PURPLE_LIGHT = '#EEEDFE';
const PURPLE_DARK = '#3C3489';
const GRAY_MID = '#888780';
const GRAY_BG = '#F1EFE8';
const TEXT = '#2C2C2A';
const BORDER = '#D3D1C7';
const GREEN = '#22C55E';

const styles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 0.5,
        borderColor: BORDER,
        padding: 14,
        marginBottom: 10,
    },
    cardEnded: { opacity: 0.7 },

    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },

    // Mode badge
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: PURPLE_LIGHT,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 5,
    },
    modeBadgeEnded: { backgroundColor: GRAY_BG },
    modeBadgeDotOrange: {
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: '#F97316',
    },
    modeBadgeText: {
        fontSize: 10, fontWeight: '700',
        color: PURPLE_DARK, letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    modeBadgeTextEnded: { color: GRAY_MID },

    // Live dot
    liveDotWrapper: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
    liveDotRing: {
        position: 'absolute',
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: GREEN, opacity: 0.3,
    },
    liveDotCore: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },

    // Timer
    timerBadge: { flexDirection: 'row', alignItems: 'center' },
    timerText: { fontSize: 11, color: GRAY_MID, fontWeight: '500' },
    timerTextEnded: { color: '#A32D2D' },

    // Versus row
    versusRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 12, gap: 8,
    },
    participant: { flex: 1, alignItems: 'center', gap: 4 },
    participantName: { fontSize: 12, fontWeight: '500', color: TEXT, textAlign: 'center', maxWidth: 80 },
    participantHandle: { fontSize: 11, color: GRAY_MID, textAlign: 'center' },
    vsIcon: { fontSize: 20, flexShrink: 0 },

    // Empty opponent slot
    emptySlot: {
        width: 52, height: 52,
        borderRadius: 10,
        borderWidth: 2, borderColor: '#C4B5FD', borderStyle: 'dashed',
        backgroundColor: PURPLE_LIGHT,
        alignItems: 'center', justifyContent: 'center',
    },
    waitingLabel: { fontSize: 11, fontWeight: '600', color: PURPLE, textAlign: 'center' },
    waitingSub: { fontSize: 10, color: GRAY_MID, textAlign: 'center' },

    // Question
    question: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 10, lineHeight: 18 },

    // Stakes
    stakePill: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: PURPLE_LIGHT, borderRadius: 20,
        paddingVertical: 4, paddingHorizontal: 10, marginBottom: 10, gap: 5,
    },
    stakeText: { fontSize: 12, color: PURPLE_DARK },
    stakeAmount: { fontWeight: '700', color: PURPLE_DARK },

    // Option chips
    joinRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    pollOptions: { gap: 6, marginBottom: 10 },
    optionChip: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        gap: 5, borderRadius: 24, borderWidth: 1, borderColor: BORDER,
        backgroundColor: '#fff', paddingVertical: 5, paddingHorizontal: 7, minWidth: 0,
    },
    optionChipSelected: { borderColor: PURPLE, backgroundColor: PURPLE_LIGHT },
    optionChipLabel: { flex: 1, fontSize: 11, fontWeight: '500', color: TEXT },
    optionChipLabelSelected: { color: PURPLE_DARK },
    radioCircle: {
        width: 15, height: 15, borderRadius: 7.5,
        borderWidth: 1.5, borderColor: BORDER,
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
    },
    radioCircleSelected: { borderColor: PURPLE },
    radioInner: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: PURPLE },
    optionDisabled: { opacity: 0.45 },

    // Accept challenge
    acceptBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: PURPLE, borderRadius: 20,
        paddingVertical: 8, paddingHorizontal: 14, marginBottom: 10,
    },
    acceptBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

    // Poll creator
    pollCreatorRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    pollCreatorName: { fontSize: 13, fontWeight: '500', color: TEXT },
    pollCreatorHandle: { fontSize: 11, color: GRAY_MID },

    // Meta
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    metaText: { fontSize: 11, color: GRAY_MID },

    // Divider
    divider: { height: 0.5, backgroundColor: BORDER, marginBottom: 10 },

    // Stats
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6,alignSelf:'center' },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 12, color: GRAY_MID },
    statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: BORDER },
});
