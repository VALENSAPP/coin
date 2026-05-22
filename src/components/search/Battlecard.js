/**
 * BattleCard — React Native component (i18n updated)
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useLanguage } from '../../i18n';

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
    if (!value) return null; // caller uses t() for label
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatBattleCountdown = (value, t) => {
    if (!value) return t('battleCard.ended');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t('battleCard.ended');
    const diffMs = parsed.getTime() - Date.now();
    if (diffMs <= 0) return t('battleCard.ended');
    const diffDays = Math.floor(diffMs / 86400000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffDays > 0) return t('battleCard.endsInDays', { days: diffDays });
    if (diffHours > 0) return t('battleCard.endsInHours', { hours: diffHours });
    return t('battleCard.endsInMins', { mins: diffMins });
};

const formatBattleCount = value => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return `${n}`;
};

const normalizeCountKey = value => String(value || '').trim().toLowerCase();

const buildNormalizedCountMap = (counts = {}) => {
    if (!counts || typeof counts !== 'object') return {};
    return Object.entries(counts).reduce((acc, [key, value]) => {
        const normalized = normalizeCountKey(key);
        if (!normalized) return acc;
        const numericValue = Number(value);
        acc[normalized] = Number.isFinite(numericValue) ? numericValue : 0;
        return acc;
    }, {});
};

const computePercentages = (labels = [], rawCounts = {}) => {
    const normalizedCounts = buildNormalizedCountMap(rawCounts);
    const counts = labels.map(label => {
        const key = normalizeCountKey(label);
        const value = normalizedCounts[key];
        return Number.isFinite(value) && value > 0 ? value : 0;
    });
    const total = counts.reduce((sum, value) => sum + value, 0);
    if (!total) return labels.map(() => 0);
    const exact = counts.map(value => (value / total) * 100);
    const floors = exact.map(value => Math.floor(value));
    let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
    const order = exact
        .map((value, index) => ({ index, frac: value - floors[index] }))
        .sort((a, b) => b.frac - a.frac);
    const result = [...floors];
    for (let i = 0; i < order.length && remainder > 0; i += 1) {
        result[order[i].index] += 1;
        remainder -= 1;
    }
    return result;
};

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

const TimerBadge = ({ endTime, ended, t }) => (
    <View style={styles.timerBadge}>
        <Icon name="time-outline" size={10} color={ended ? '#A32D2D' : '#888780'} style={{ marginRight: 3 }} />
        <Text style={[styles.timerText, ended && styles.timerTextEnded]}>
            {formatBattleCountdown(endTime, t)}
        </Text>
    </View>
);

const ModeBadge = ({ format, ended, isLive, t }) => (
    <View style={[styles.modeBadge, ended && styles.modeBadgeEnded]}>
        {!ended && (isLive ? <LiveDot /> : <View style={styles.modeBadgeDotOrange} />)}
        <Text style={[styles.modeBadgeText, ended && styles.modeBadgeTextEnded]} numberOfLines={2}>
            {format === 'POLL' ? t('battleCard.poll') : t('battleCard.battleMode')}
        </Text>
    </View>
);

const ParticipantAvatar = ({ avatarUrl, name, handle, isEmpty, onPress, onPressIn, t }) => {
    if (isEmpty) {
        return (
            <View style={styles.participantSlot}>
                <View style={styles.participantContent}>
                    <View style={styles.emptySlot}>
                        <Icon name="person-add-outline" size={15} color="#A78BFA" />
                    </View>
                    <Text style={styles.waitingLabel}>{t('battleCard.waiting')}</Text>
                    <Text style={styles.waitingSub}>{t('battleCard.openSlot')}</Text>
                </View>
            </View>
        );
    }
    return (
        <View style={styles.participantSlot}>
            <TouchableOpacity
                style={styles.participantContent}
                activeOpacity={0.75}
                onPress={onPress}
                onPressIn={onPressIn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
                <HexAvatar
                    uri={normalizeImageUrl(avatarUrl) || DEFAULT_AVATAR}
                    size={40}
                    borderWidth={2}
                    borderColor="#7F77DD"
                />
                <Text style={styles.participantName} numberOfLines={1}>{name}</Text>
                {!!handle && <Text style={styles.participantHandle} numberOfLines={1}>@{handle}</Text>}
            </TouchableOpacity>
        </View>
    );
};

const StakePill = ({ amount, t }) => (
    <View style={styles.stakePill}>
        <Icon name="flash" size={11} color="#7F77DD" />
        <Text style={styles.stakeText}>
            {t('battleCard.stakes')} <Text style={styles.stakeAmount}>{formatAmount(amount)}</Text>
        </Text>
    </View>
);

const OptionChip = ({ option, isSelected, onPress, disabled, avatarUrl, percent }) => (
    <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onPress}
        style={[styles.optionChip, isSelected && styles.optionChipSelected, disabled && styles.optionDisabled]}
    >
        <HexAvatar uri={normalizeImageUrl(avatarUrl) || DEFAULT_AVATAR} size={20} fadeDuration={0} />
        <View style={styles.optionChipTextWrap}>
            <Text style={[styles.optionChipLabel, isSelected && styles.optionChipLabelSelected]} numberOfLines={1}>
                {option?.label || option}
            </Text>
            {Number.isFinite(percent) && (
                <Text style={styles.optionChipPercent}>
                    {Math.max(0, Math.min(100, Math.round(percent)))}%
                </Text>
            )}
        </View>
        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
            {isSelected && <View style={styles.radioInner} />}
        </View>
    </TouchableOpacity>
);

const StatRow = ({ totalParticipants, totalLikes, totalComments }) => (
    <View style={styles.statsRow}>
        <View style={styles.statItem}>
            <Icon name="people-outline" size={12} color="#888780" />
            <Text style={styles.statText}>{formatBattleCount(totalParticipants)}</Text>
        </View>
        <View style={styles.statDot} />
        <View style={styles.statItem}>
            <View style={{ marginTop: 2 }}>
                <Icon name="chatbox-ellipses-outline" size={12} color="#888780" />
            </View>
            <Text style={styles.statText}>{formatBattleCount(totalComments)}</Text>
        </View>
    </View>
);

// ─── BattleCard ───────────────────────────────────────────────────────────────

const BattleCard = memo(({ item, selectedOption, onCardPress, onOptionSelect, onUserPress, fullWidth }) => {
    const { t } = useLanguage();
    const ended = formatBattleCountdown(item.endTime, t) === t('battleCard.ended');
    const isPoll = item.format === 'POLL';
    const soloOpponent = !isPoll && !item.opponent && isEmptyOpponent(item.user2);

    const suppressCardPressRef = useRef({ active: false, timer: null });
    const suppressNextCardPress = useCallback(() => {
        suppressCardPressRef.current.active = true;
        if (suppressCardPressRef.current.timer) clearTimeout(suppressCardPressRef.current.timer);
        suppressCardPressRef.current.timer = setTimeout(() => {
            suppressCardPressRef.current.active = false;
            suppressCardPressRef.current.timer = null;
        }, 350);
    }, []);

    const handleCardPress = useCallback(() => {
        if (suppressCardPressRef.current.active) {
            suppressCardPressRef.current.active = false;
            if (suppressCardPressRef.current.timer) clearTimeout(suppressCardPressRef.current.timer);
            suppressCardPressRef.current.timer = null;
            return;
        }
        onCardPress(item);
    }, [item, onCardPress]);

    const handleUserPress = useCallback((user, event) => {
        event?.stopPropagation?.();
        suppressNextCardPress();
        onUserPress?.(user);
    }, [onUserPress, suppressNextCardPress]);

    useEffect(() => () => {
        if (suppressCardPressRef.current.timer) clearTimeout(suppressCardPressRef.current.timer);
    }, []);

    const optionImages = Array.isArray(item?.optionImages) ? item.optionImages : [];

    const handleOption = useCallback(
        label => { if (!ended) onOptionSelect(item.id, label); },
        [ended, item.id, onOptionSelect],
    );

    const optionLabels = useMemo(
        () => (Array.isArray(item?.options) ? item.options : []).map(opt => String(opt?.label || opt || '')),
        [item?.options],
    );

    const optionPercents = useMemo(() => {
        const hasPredictionCounts = item?.predictionCounts && Object.keys(item.predictionCounts).length > 0;
        const countsSource = isPoll && hasPredictionCounts ? item.predictionCounts : item.voteCounts;
        return computePercentages(optionLabels, countsSource || {});
    }, [isPoll, item?.predictionCounts, item?.voteCounts, optionLabels]);

    const formattedEndDate = formatBattleDate(item.endTime);

    if (isPoll) {
        return (
            <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.card, ended && styles.cardEnded, fullWidth && styles.cardFullWidth]}
                onPress={handleCardPress}
            >
                <View style={styles.cardTopRow}>
                    <View style={styles.pollCreatorRowContainer}>
                        {onUserPress ? (
                            <TouchableOpacity
                                style={styles.pollCreatorPressable}
                                activeOpacity={0.75}
                                onPressIn={suppressNextCardPress}
                                onPress={event => handleUserPress(item.creator, event)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <HexAvatar uri={normalizeImageUrl(item.creator.avatar) || DEFAULT_AVATAR} size={28} borderWidth={2} borderColor="#7F77DD" />
                                <View style={styles.pollCreatorTextWrap}>
                                    <Text style={styles.pollCreatorName} numberOfLines={1}>{item.creator.name}</Text>
                                    <Text style={styles.pollCreatorHandle} numberOfLines={1}>@{item.creator.userName}</Text>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.pollCreatorPressable}>
                                <HexAvatar uri={normalizeImageUrl(item.creator.avatar) || DEFAULT_AVATAR} size={28} borderWidth={2} borderColor="#7F77DD" />
                                <View style={styles.pollCreatorTextWrap}>
                                    <Text style={styles.pollCreatorName} numberOfLines={1}>{item.creator.name}</Text>
                                    <Text style={styles.pollCreatorHandle} numberOfLines={1}>@{item.creator.userName}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                    <ModeBadge format="POLL" ended={ended} isLive={item.isLive} t={t}/>
                </View>

                <TimerBadge endTime={item.endTime} ended={ended} t={t} />
                <Text style={[styles.question, { marginTop: 4 }]} numberOfLines={3}>{item.title}</Text>

                {item.options?.length > 0 && (
                    <View style={styles.pollOptions}>
                        {item.options.slice(0, 4).map((option, idx) => {
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
                                    percent={optionPercents[idx]}
                                />
                            );
                        })}
                    </View>
                )}

                <View style={styles.metaRow}>
                    <StakePill amount={formatAmount(item.stakeAmount || 0)} t={t} />
                    <Text style={styles.metaText}>
                        {formattedEndDate
                            ? `${t('battleCard.ends')} ${formattedEndDate}`
                            : t('battleCard.noEndDate')}
                    </Text>
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
            style={[styles.card, ended && styles.cardEnded, fullWidth && styles.cardFullWidth]}
            onPress={handleCardPress}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
            <View style={styles.cardTopRow}>
                <View style={styles.pollCreatorRowContainer}>
                    {onUserPress ? (
                        <TouchableOpacity
                            style={styles.pollCreatorPressable}
                            activeOpacity={0.75}
                            onPressIn={suppressNextCardPress}
                            onPress={event => handleUserPress(
                                { id: item.creator?.id, userName: item.creator?.userName, image: item.creator?.avatar, displayName: item.creator?.name },
                                event
                            )}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                            <HexAvatar
                                uri={normalizeImageUrl(item.creator?.avatar) || DEFAULT_AVATAR}
                                size={28}
                                borderWidth={2}
                                borderColor="#7F77DD"
                            />
                            <View style={styles.pollCreatorTextWrap}>
                                <Text style={styles.pollCreatorName} numberOfLines={1}>
                                    {item.creator?.name}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pollCreatorPressable}>
                            <HexAvatar
                                uri={normalizeImageUrl(item.creator?.avatar) || DEFAULT_AVATAR}
                                size={28}
                                borderWidth={2}
                                borderColor="#7F77DD"
                            />
                            <View style={styles.pollCreatorTextWrap}>
                                <Text style={styles.pollCreatorName} numberOfLines={1}>
                                    {item.creator?.name}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
                <ModeBadge format={item.format} ended={ended} isLive={item.isLive} t={t}/>
            </View>
            <TimerBadge endTime={item.endTime} ended={ended} t={t} />

            <View style={styles.versusRow}>
                <ParticipantAvatar
                    avatarUrl={item.user1.avatar}
                    name={item.user1.name}
                    handle={item.user1.userName}
                    isEmpty={false}
                    onPressIn={suppressNextCardPress}
                    onPress={event => handleUserPress({ id: item.creator?.id, userName: item.user1.userName, image: item.user1.avatar, displayName: item.user1.name }, event)}
                    t={t}
                />
                <Text style={styles.vsIcon}>⚔️</Text>
                {item.opponent ? (
                    <ParticipantAvatar
                        avatarUrl={item.opponent.avatar}
                        name={item.user2.name}
                        handle={item.opponent.userName}
                        isEmpty={false}
                        onPressIn={suppressNextCardPress}
                        onPress={event => handleUserPress({ id: item.opponent?.id, userName: item.opponent.userName, image: item.opponent.avatar, displayName: item.user2.name }, event)}
                        t={t}
                    />
                ) : (
                    <ParticipantAvatar
                        avatarUrl={item.user2?.avatar}
                        name={item.user2?.name}
                        handle={item.user2?.userName}
                        isEmpty={soloOpponent}
                        onPressIn={soloOpponent ? undefined : suppressNextCardPress}
                        onPress={soloOpponent ? undefined : event => handleUserPress({ id: item.user2?.id, userName: item.user2?.userName, image: item.user2?.avatar, displayName: item.user2?.name }, event)}
                        t={t}
                    />
                )}
            </View>

            <Text style={styles.question} numberOfLines={2}>{item.title}</Text>
            <StakePill amount={item.stakeAmount || 0} t={t} />

            {!soloOpponent && item.options?.length > 0 && (
                <View style={styles.pollOptions}>
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
                                percent={optionPercents[idx]}
                            />
                        );
                    })}
                </View>
            )}
            {soloOpponent && (
                <TouchableOpacity style={styles.acceptBtn} onPress={() => onCardPress(item)} activeOpacity={0.85}>
                    <Icon name="add-circle-outline" size={13} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.acceptBtnText}>{t('battleCard.acceptChallenge')}</Text>
                </TouchableOpacity>
            )}

            <View style={styles.divider} />
            <StatRow totalParticipants={item.totalParticipants} totalLikes={item.totalLikes} totalComments={item.totalComments} />
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.item?.id === nextProps.item?.id &&
        prevProps.selectedOption === nextProps.selectedOption &&
        prevProps.item?.isLive === nextProps.item?.isLive &&
        prevProps.item?.status === nextProps.item?.status &&
        prevProps.onCardPress === nextProps.onCardPress &&
        prevProps.onOptionSelect === nextProps.onOptionSelect &&
        prevProps.onUserPress === nextProps.onUserPress &&
        JSON.stringify(prevProps.item?.optionImages) === JSON.stringify(nextProps.item?.optionImages) &&
        JSON.stringify(prevProps.item?.opponent) === JSON.stringify(nextProps.item?.opponent)
    );
});

export default BattleCard;

// ─── AutoScrollBattleRow ──────────────────────────────────────────────────────

const CARD_WIDTH = 220;
const CARD_GAP = 8;
const RESUME_DELAY_MS = 1000;
const AUTO_SCROLL_SPEED_PX_PER_MS = 0.055;
const START_DELAY_MS = 300;
const ROW_PADDING_LEFT = 10;

export const AutoScrollBattleRow = ({ children, style }) => {
    const scrollViewRef = useRef(null);
    const autoScrollFrameRef = useRef(null);
    const resumeTimeoutRef = useRef(null);
    const pausedRef = useRef(false);
    const offsetRef = useRef(0);
    const lastFrameTsRef = useRef(0);
    const halfWidthRef = useRef(0);
    const [contentWidth, setContentWidth] = useState(0);
    const allChildren = React.Children.toArray(children);
    const isCarouselEnabled = allChildren.length > 1;

    useEffect(() => {
        halfWidthRef.current = contentWidth / 2;
    }, [contentWidth]);

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

    const scrollTo = useCallback((x) => {
        scrollViewRef.current?.scrollTo({ x, animated: false });
        offsetRef.current = x;
    }, []);

    const startAutoScroll = useCallback(() => {
        if (!isCarouselEnabled || pausedRef.current) return;
        stopAutoScroll();
        const tick = (timestamp) => {
            if (pausedRef.current || !isCarouselEnabled) {
                stopAutoScroll();
                return;
            }
            if (!lastFrameTsRef.current) lastFrameTsRef.current = timestamp;
            const deltaMs = timestamp - lastFrameTsRef.current;
            lastFrameTsRef.current = timestamp;
            let next = offsetRef.current + deltaMs * AUTO_SCROLL_SPEED_PX_PER_MS;
            const half = halfWidthRef.current;
            if (half > 0 && next >= half) {
                next = next - half;
                scrollViewRef.current?.scrollTo({ x: next, animated: false });
                offsetRef.current = next;
            } else {
                scrollViewRef.current?.scrollTo({ x: next, animated: false });
                offsetRef.current = next;
            }
            autoScrollFrameRef.current = requestAnimationFrame(tick);
        };
        autoScrollFrameRef.current = requestAnimationFrame(tick);
    }, [isCarouselEnabled, stopAutoScroll]);

    useEffect(() => {
        if (!isCarouselEnabled) return undefined;
        const timer = setTimeout(() => startAutoScroll(), START_DELAY_MS);
        return () => {
            clearTimeout(timer);
            clearResumeTimer();
            stopAutoScroll();
        };
    }, [isCarouselEnabled, startAutoScroll, clearResumeTimer, stopAutoScroll]);

    useEffect(() => () => {
        clearResumeTimer();
        stopAutoScroll();
    }, [clearResumeTimer, stopAutoScroll]);

    const handleInteractionStart = useCallback(() => {
        clearResumeTimer();
        pausedRef.current = true;
        stopAutoScroll();
    }, [clearResumeTimer, stopAutoScroll]);

    const handleInteractionEnd = useCallback(() => {
        clearResumeTimer();
        if (!isCarouselEnabled) {
            pausedRef.current = false;
            return;
        }
        resumeTimeoutRef.current = setTimeout(() => {
            pausedRef.current = false;
            startAutoScroll();
        }, RESUME_DELAY_MS);
    }, [isCarouselEnabled, clearResumeTimer, startAutoScroll]);

    if (!isCarouselEnabled) {
        return (
            <View style={[{ flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: ROW_PADDING_LEFT }, style]}>
                {allChildren}
            </View>
        );
    }

    return (
        <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={true}
            bounces={false}
            alwaysBounceHorizontal={false}
            overScrollMode="never"
            keyboardShouldPersistTaps="handled"
            delayContentTouches={false}
            scrollEventThrottle={16}
            onContentSizeChange={(width) => setContentWidth(width)}
            onScroll={(event) => {
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
        padding: 10,
        marginBottom: 8,
    },
    cardEnded: { opacity: 0.7 },
    cardFullWidth: { width: '100%', marginRight: 0 },

    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },

    // Mode badge
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: PURPLE_LIGHT,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
        gap: 4,
        flexShrink: 0,
    },
    modeBadgeEnded: { backgroundColor: GRAY_BG },
    modeBadgeDotOrange: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: '#F97316',
    },
    modeBadgeText: {
        fontSize: 9, fontWeight: '700',
        color: PURPLE_DARK, letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    modeBadgeTextEnded: { color: GRAY_MID },

    // Live dot
    liveDotWrapper: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
    liveDotRing: {
        position: 'absolute',
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: GREEN, opacity: 0.3,
    },
    liveDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },

    // Timer
    timerBadge: { flexDirection: 'row', alignItems: 'center' },
    timerText: { fontSize: 10, color: GRAY_MID, fontWeight: '500' },
    timerTextEnded: { color: '#A32D2D' },

    // Versus row
    versusRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 8, gap: 6,
    },
    participantSlot: { flex: 1, alignItems: 'center', minWidth: 0 },
    participantContent: { alignItems: 'center', gap: 2, maxWidth: 72 },
    participantName: { fontSize: 11, fontWeight: '500', color: TEXT, textAlign: 'center', maxWidth: 64 },
    participantHandle: { fontSize: 10, color: GRAY_MID, textAlign: 'center' },
    vsIcon: { fontSize: 16, flexShrink: 0 },

    // Empty opponent slot
    emptySlot: {
        width: 40, height: 40,
        borderRadius: 8,
        borderWidth: 2, borderColor: '#C4B5FD', borderStyle: 'dashed',
        backgroundColor: PURPLE_LIGHT,
        alignItems: 'center', justifyContent: 'center',
    },
    waitingLabel: { fontSize: 10, fontWeight: '600', color: PURPLE, textAlign: 'center' },
    waitingSub: { fontSize: 9, color: GRAY_MID, textAlign: 'center' },

    // Question
    question: { fontSize: 12, fontWeight: '700', color: TEXT, marginBottom: 6, lineHeight: 16 },

    // Stakes
    stakePill: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: PURPLE_LIGHT, borderRadius: 20,
        paddingVertical: 3, paddingHorizontal: 8, marginBottom: 6, gap: 4,
    },
    stakeText: { fontSize: 11, color: PURPLE_DARK },
    stakeAmount: { fontWeight: '700', color: PURPLE_DARK },

    // Option chips
    pollOptions: { width: '100%', gap: 6, marginBottom: 6 },
    optionChip: {
        width: '100%', flexDirection: 'row', alignItems: 'center',
        gap: 4, borderRadius: 24, borderWidth: 1, borderColor: BORDER,
        backgroundColor: '#fff', paddingVertical: 4, paddingHorizontal: 5, minWidth: 0,
    },
    optionChipSelected: { borderColor: PURPLE, backgroundColor: PURPLE_LIGHT },
    optionChipTextWrap: { flex: 1, minWidth: 0 },
    optionChipLabel: { fontSize: 10, fontWeight: '500', color: TEXT },
    optionChipLabelSelected: { color: PURPLE_DARK },
    optionChipPercent: { marginTop: 1, fontSize: 9, fontWeight: '700', color: GRAY_MID },
    radioCircle: {
        width: 13, height: 13, borderRadius: 6.5,
        borderWidth: 1.5, borderColor: BORDER,
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
    },
    radioCircleSelected: { borderColor: PURPLE },
    radioInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: PURPLE },
    optionDisabled: { opacity: 0.45 },

    // Accept challenge
    acceptBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: PURPLE, borderRadius: 20,
        paddingVertical: 6, paddingHorizontal: 12, marginBottom: 6,
    },
    acceptBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

    // Poll creator
    pollCreatorRowContainer: { flex: 1, marginRight: 8, minWidth: 0 },
    pollCreatorPressable: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minWidth: 0 },
    pollCreatorTextWrap: { marginLeft: 6, flexShrink: 1, minWidth: 0 },
    pollCreatorName: { fontSize: 12, fontWeight: '500', color: TEXT,flexShrink: 1,  },
    pollCreatorHandle: { fontSize: 10, color: GRAY_MID },

    // Meta
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    metaText: { fontSize: 10, color: GRAY_MID },

    // Divider
    divider: { height: 0.5, backgroundColor: BORDER, marginBottom: 6 },

    // Stats
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 11, color: GRAY_MID },
    statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: BORDER },
    creatorByline: {
        fontSize: 12,
        color: "#000",
        fontWeight: '700',
        marginTop: 2,
        marginLeft: 2,
    },
});
