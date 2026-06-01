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
    Dimensions,
    Platform,
    PanResponder,
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
    if (!value) return null;
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
                    size={28}
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
                renderToHardwareTextureAndroid
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
                                <HexAvatar uri={normalizeImageUrl(item.creator.avatar) || DEFAULT_AVATAR} size={20} borderWidth={2} borderColor="#7F77DD" fadeDuration={0} />
                                <View style={styles.pollCreatorTextWrap}>
                                    <Text style={styles.pollCreatorName} numberOfLines={1}>{item.creator.name}</Text>
                                    <Text style={styles.pollCreatorHandle} numberOfLines={1}>@{item.creator.userName}</Text>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.pollCreatorPressable}>
                                <HexAvatar uri={normalizeImageUrl(item.creator.avatar) || DEFAULT_AVATAR} size={20} borderWidth={2} borderColor="#7F77DD" fadeDuration={0} />
                                <View style={styles.pollCreatorTextWrap}>
                                    <Text style={styles.pollCreatorName} numberOfLines={1}>{item.creator.name}</Text>
                                    <Text style={styles.pollCreatorHandle} numberOfLines={1}>@{item.creator.userName}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                    <ModeBadge format="POLL" ended={ended} isLive={item.isLive} t={t} />
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
            renderToHardwareTextureAndroid
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
                                size={20}
                                borderWidth={2}
                                borderColor="#7F77DD"
                                fadeDuration={0}
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
                                size={20}
                                borderWidth={2}
                                borderColor="#7F77DD"
                                fadeDuration={0}
                            />
                            <View style={styles.pollCreatorTextWrap}>
                                <Text style={styles.pollCreatorName} numberOfLines={1}>
                                    {item.creator?.name}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
                <ModeBadge format={item.format} ended={ended} isLive={item.isLive} t={t} />
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_WIDTH = 220;
const CARD_GAP = 8;
const RESUME_DELAY_MS = 1000;
const AUTO_SCROLL_SPEED_PX_PER_MS = 0.04;
const START_DELAY_MS = 300;
const ROW_PADDING_LEFT = 10;

const AndroidBattleRow = ({ children, style }) => {
    const allChildren = React.Children.toArray(children);

    if (allChildren.length === 0) return null;

    if (allChildren.length === 1) {
        return (
            <View style={[{ flexDirection: 'row', paddingHorizontal: ROW_PADDING_LEFT }, style]}>
                {allChildren}
            </View>
        );
    }

    const loopedChildren = [...allChildren, ...allChildren];
    const totalWidth = allChildren.length * (CARD_WIDTH + CARD_GAP);

    const translateX = useRef(new Animated.Value(0)).current;
    const animRef = useRef(null);
    const animOffsetRef = useRef(0);
    const isDraggingRef = useRef(false);
    const dragStartOffsetRef = useRef(0);
    const resumeTimerRef = useRef(null);
    const isPausedForCardRef = useRef(false);

    useEffect(() => {
        const id = translateX.addListener(({ value }) => {
            animOffsetRef.current = value;
        });
        return () => translateX.removeListener(id);
    }, [translateX]);

    // scroll one card width, pause 1s, then next card, loop forever
    const startStepScroll = useCallback((fromX = 0) => {
        if (isDraggingRef.current) return;
        animRef.current?.stop();

        const stepSize = CARD_WIDTH + CARD_GAP;

        // snap fromX to nearest card boundary
        const snapped = Math.round(fromX / stepSize) * stepSize;
        const nextStop = snapped - stepSize;

        // wrap: if we've gone past one full set, reset to equivalent position in first set
        const wrappedFrom = snapped % -totalWidth === 0 && snapped !== 0
            ? 0
            : snapped;

        translateX.setValue(wrappedFrom);
        animOffsetRef.current = wrappedFrom;

        const target = wrappedFrom - stepSize;

        // scroll to next card
        animRef.current = Animated.timing(translateX, {
            toValue: target,
            duration: stepSize / AUTO_SCROLL_SPEED_PX_PER_MS,
            useNativeDriver: true,
            isInteraction: false,
        });

        animRef.current.start(({ finished }) => {
            if (!finished || isDraggingRef.current) return;

            animOffsetRef.current = target;
            isPausedForCardRef.current = true;

            // pause 1 second at this card
            resumeTimerRef.current = setTimeout(() => {
                isPausedForCardRef.current = false;

                // wrap if needed
                const nextFrom = target <= -totalWidth ? target + totalWidth : target;
                startStepScroll(nextFrom);
            }, 500);
        });
    }, [totalWidth, translateX]);

    useEffect(() => {
        const timer = setTimeout(() => startStepScroll(0), START_DELAY_MS);
        return () => {
            clearTimeout(timer);
            animRef.current?.stop();
            if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        };
    }, [startStepScroll]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                const { dx, dy } = gestureState;
                return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 2;
            },
            onMoveShouldSetPanResponderCapture: () => false,

            onPanResponderGrant: () => {
                isDraggingRef.current = true;
                animRef.current?.stop();
                if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
                dragStartOffsetRef.current = animOffsetRef.current;
                translateX.setValue(animOffsetRef.current);
            },

            onPanResponderMove: (_, gestureState) => {
                let next = dragStartOffsetRef.current + gestureState.dx;
                if (next > 0) next -= totalWidth;
                if (next < -totalWidth) next += totalWidth;
                translateX.setValue(next);
                animOffsetRef.current = next;
            },

            onPanResponderRelease: () => {
                isDraggingRef.current = false;
                // snap to nearest card then resume step scroll
                resumeTimerRef.current = setTimeout(() => {
                    startStepScroll(animOffsetRef.current);
                }, RESUME_DELAY_MS);
            },

            onPanResponderTerminate: () => {
                isDraggingRef.current = false;
                resumeTimerRef.current = setTimeout(() => {
                    startStepScroll(animOffsetRef.current);
                }, RESUME_DELAY_MS);
            },
        })
    ).current;

    useEffect(() => () => {
        animRef.current?.stop();
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    }, []);

    return (
        <View
            style={[{ overflow: 'hidden', paddingLeft: ROW_PADDING_LEFT }, style]}
            collapsable={false}
            {...panResponder.panHandlers}
        >
            <Animated.View
                style={{
                    flexDirection: 'row',
                    gap: CARD_GAP,
                    transform: [{ translateX }],
                }}
            >
                {loopedChildren.map((child, i) => (
                    <View
                        key={`android-card-${i}`}
                        style={{ width: CARD_WIDTH }}
                        renderToHardwareTextureAndroid
                        collapsable={false}
                    >
                        {child}
                    </View>
                ))}
            </Animated.View>
        </View>
    );
};

// ─── iOS: original ScrollView implementation (untouched) ──────────────────────

const IOSBattleRow = ({ children, style }) => {
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

// ✅ Android gets HeroCarousel, iOS keeps original — evaluated once at module load
export const AutoScrollBattleRow = Platform.OS === 'android' ? AndroidBattleRow : IOSBattleRow;

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
        padding: 4,
        marginBottom: 8,
        overflow: 'hidden',
    },
    cardEnded: { opacity: 0.7 },
    cardFullWidth: { width: '100%', marginRight: 0 },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
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
    liveDotWrapper: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
    liveDotRing: {
        position: 'absolute',
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: GREEN, opacity: 0.3,
    },
    liveDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
    timerBadge: { flexDirection: 'row', alignItems: 'center' },
    timerText: { fontSize: 10, color: GRAY_MID, fontWeight: '500' },
    timerTextEnded: { color: '#A32D2D' },
    versusRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 2, gap: 1,
    },
    participantSlot: { flex: 1, alignItems: 'center', minWidth: 0 },
    participantContent: { alignItems: 'center', gap: 2, maxWidth: 72 },
    participantName: { fontSize: 10, fontWeight: '500', color: TEXT, textAlign: 'center', maxWidth: 64 },
    participantHandle: { fontSize: 10, color: GRAY_MID, textAlign: 'center' },
    vsIcon: { fontSize: 16, flexShrink: 0 },
    emptySlot: {
        width: 40, height: 40,
        borderRadius: 8,
        borderWidth: 2, borderColor: '#C4B5FD', borderStyle: 'dashed',
        backgroundColor: PURPLE_LIGHT,
        alignItems: 'center', justifyContent: 'center',
    },
    waitingLabel: { fontSize: 10, fontWeight: '600', color: PURPLE, textAlign: 'center' },
    waitingSub: { fontSize: 9, color: GRAY_MID, textAlign: 'center' },
    question: { fontSize: 11, fontWeight: '700', color: TEXT, marginBottom: 1, lineHeight: 13 },
    stakePill: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: PURPLE_LIGHT, borderRadius: 20,
        paddingVertical: 2, paddingHorizontal: 8, marginBottom: 3, gap: 4,
    },
    stakeText: { fontSize: 11, color: PURPLE_DARK },
    stakeAmount: { fontWeight: '700', color: PURPLE_DARK },
    pollOptions: { width: '100%', gap: 2, marginBottom: 3 },
    optionChip: {
        width: '100%', flexDirection: 'row', alignItems: 'center',
        gap: 4, borderRadius: 24, borderWidth: 1, borderColor: BORDER,
        backgroundColor: '#fff', paddingVertical: 1, paddingHorizontal: 5, minWidth: 0,
    },
    optionChipSelected: { borderColor: PURPLE, backgroundColor: PURPLE_LIGHT },
    optionChipTextWrap: { flex: 1, minWidth: 0 },
    optionChipLabel: { fontSize: 9, fontWeight: '500', color: TEXT },
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
    acceptBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: PURPLE, borderRadius: 20,
        paddingVertical: 6, paddingHorizontal: 12, marginBottom: 6,
    },
    acceptBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    pollCreatorRowContainer: { flex: 1, marginRight: 8, minWidth: 0 },
    pollCreatorPressable: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minWidth: 0 },
    pollCreatorTextWrap: { marginLeft: 6, flexShrink: 1, minWidth: 0 },
    pollCreatorName: { fontSize: 12, fontWeight: '500', color: TEXT, flexShrink: 1 },
    pollCreatorHandle: { fontSize: 10, color: GRAY_MID },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
    metaText: { fontSize: 10, color: GRAY_MID },
    divider: { height: 0.5, backgroundColor: BORDER, marginBottom: 3 },
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