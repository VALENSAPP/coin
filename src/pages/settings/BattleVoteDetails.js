import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAppTheme } from '../../theme/useApptheme';
import { normalizeProfileType } from '../../utils/supportEligibility';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useLanguage } from '../../i18n';

const FALLBACK_AVATAR =
  'https://ui-avatars.com/api/?name=User&background=random';

const isMeaningfulValue = value => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return (
      !!trimmed &&
      trimmed.toLowerCase() !== 'undefined' &&
      trimmed.toLowerCase() !== 'null'
    );
  }
  return true;
};

const pickFirst = (...values) => values.find(isMeaningfulValue);
const normalizeSideKey = value => String(value || '').trim().toLowerCase();

const isHeadToHeadParticipantUserId = (userId, creatorId, invitedUserId) => {
  const id = String(userId || '');
  if (!id) return false;
  return id === String(creatorId || '') || id === String(invitedUserId || '');
};

const filterHeadToHeadCountableEntries = (entries, battleFormat, battle) => {
  if (battleFormat !== 'HEAD_TO_HEAD') return Array.isArray(entries) ? entries : [];
  const creatorId = String(battle?.creatorId || '');
  const invitedUserId = String(battle?.invitedUserId || '');
  return (Array.isArray(entries) ? entries : []).filter(entry => {
    const userId = String(pickFirst(entry?.userId, entry?.user?.id, entry?.user?._id, '') || '');
    return userId && !isHeadToHeadParticipantUserId(userId, creatorId, invitedUserId);
  });
};

const normalizeOption = (option, index) => {
  if (typeof option === 'string') {
    return { id: `${index}`, label: option, sideKey: String(option) };
  }
  // Prefer a user-facing label; keep `side` as a separate matching key.
  const label = pickFirst(
    option?.label,
    option?.title,
    option?.text,
    option?.name,
    option?.value,
    option?.option,
    option?.side,
    `Option ${index + 1}`,
  );
  const sideKey = pickFirst(option?.side, option?.key, option?.code, label);
  return {
    id: String(pickFirst(option?.id, option?._id, index)),
    label: String(label),
    sideKey: String(sideKey),
  };
};

export default function BattleVoteDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();

  const { profile } = route.params || {};
  const { battle } = route.params || {};
  const selectedSide = String(route?.params?.selectedSide || '').trim();
  const selectedSideLabel = String(route?.params?.selectedSideLabel || selectedSide || '').trim();
  const resolvedProfileType = normalizeProfileType(profile);

  const { bgStyle, cardStyle, text } = useAppTheme(resolvedProfileType);

  const palette = {
    primary: '#7B61FF',
    border: 'rgba(255,255,255,0.08)',
    surface: 'rgba(255,255,255,0.03)',
    soft: 'rgba(123,97,255,0.12)',
    muted: '#9CA3AF',
  };

  const [loading] = useState(false);
  const [refreshing] = useState(false);

  const [activeTab] = useState(
    route?.params?.mode === 'comments' ? 'comments' : 'votes',
  );

  const battleType = battle?.type || 'PUBLIC';
  const battleFormat = battle?.format || 'HEAD_TO_HEAD';
  const battleStatus = battle?.status || 'LIVE';

  const options = useMemo(() => {
    const rawOptions = Array.isArray(battle?.options) ? battle.options : [];
    const normalized = rawOptions.map((opt, idx) => normalizeOption(opt, idx));
    if (normalized.length > 0) return normalized;

    const headToHeadSides = battle?.headToHeadSides;
    const creatorSide = pickFirst(headToHeadSides?.creatorSide, headToHeadSides?.creator?.side);
    const invitedSide = pickFirst(
      headToHeadSides?.invitedUserSide,
      headToHeadSides?.invitedUser?.side,
    );

    const fallback = [creatorSide, invitedSide].filter(isMeaningfulValue);
    return fallback.map((label, idx) => ({
      id: String(idx),
      label: String(label),
      sideKey: String(label),
    }));
  }, [battle]);

  const resolveUserMeta = useCallback(
    userId => {
      if (!userId) return null;

      const participants = Array.isArray(battle?.participants) ? battle.participants : [];
      const matchedParticipant = participants.find(p => p?.userId === userId || p?.user?.id === userId);
      if (matchedParticipant?.user) {
        return {
          displayName: pickFirst(matchedParticipant.user.displayName, matchedParticipant.user.name, 'User'),
          displayHandle: pickFirst(matchedParticipant.user.userName, matchedParticipant.user.handle, ''),
          displayAvatar: pickFirst(matchedParticipant.user.image, matchedParticipant.user.avatar, FALLBACK_AVATAR),
        };
      }

      const comments = Array.isArray(battle?.comments) ? battle.comments : [];
      const matchedCommentAuthor = comments.find(c => c?.userId === userId);
      if (matchedCommentAuthor) {
        return {
          displayName: pickFirst(matchedCommentAuthor.authorName, matchedCommentAuthor.name, 'User'),
          displayHandle: pickFirst(matchedCommentAuthor.authorHandle, matchedCommentAuthor.handle, ''),
          displayAvatar: pickFirst(matchedCommentAuthor.avatar, FALLBACK_AVATAR),
        };
      }

      if (battle?.creatorId && battle.creatorId === userId && battle?.creator) {
        return {
          displayName: pickFirst(battle.creator.name, 'User'),
          displayHandle: pickFirst(battle.creator.handle, ''),
          displayAvatar: pickFirst(battle.creator.avatar, FALLBACK_AVATAR),
        };
      }

      if (battle?.invitedUserId && battle.invitedUserId === userId && battle?.invitedUser) {
        return {
          displayName: pickFirst(battle.invitedUser.name, 'User'),
          displayHandle: pickFirst(battle.invitedUser.handle, ''),
          displayAvatar: FALLBACK_AVATAR,
        };
      }

      return null;
    },
    [battle],
  );

  const resolveOptionForSide = useCallback(
    (sideValue) => {
      const raw = String(sideValue || '').trim();
      if (!raw) return null;
      const normalized = normalizeSideKey(raw);
      return (
        options.find(opt => normalizeSideKey(opt?.sideKey) === normalized) ||
        options.find(opt => normalizeSideKey(opt?.label) === normalized) ||
        null
      );
    },
    [options],
  );

  const buildHeadToHeadSideChoices = useCallback(
    (entryType) => {
      if (battleFormat !== 'HEAD_TO_HEAD' || entryType !== 'votes') return [];

      const creatorId = String(battle?.creatorId || '');
      const invitedUserId = String(battle?.invitedUserId || '');
      const sides = battle?.headToHeadSides || {};
      const choices = [];

      const addChoice = (userId, sideValue, role) => {
        const side = String(sideValue || '').trim();
        if (!userId || !side) return;
        const meta = resolveUserMeta(userId);
        const matchedOption = resolveOptionForSide(side);
        choices.push({
          userId,
          displayName: pickFirst(meta?.displayName, role === 'creator' ? 'Creator' : 'Opponent'),
          displayHandle: pickFirst(meta?.displayHandle, ''),
          displayAvatar: pickFirst(meta?.displayAvatar, FALLBACK_AVATAR),
          side: matchedOption?.label || side,
          isSideChoice: true,
        });
      };

      addChoice(
        creatorId,
        pickFirst(
          sides?.creator?.side,
          sides?.creator?.choice,
          sides?.creatorSide,
          battle?.creatorChoice,
        ),
        'creator',
      );
      addChoice(
        invitedUserId,
        pickFirst(
          sides?.invitedUser?.side,
          sides?.invitedUser?.choice,
          sides?.opponent?.side,
          sides?.invitedUserSide,
          battle?.invitedUserChoice,
        ),
        'opponent',
      );

      return choices;
    },
    [battle, battleFormat, resolveOptionForSide, resolveUserMeta],
  );

  const buildSections = useCallback(
    (entries, entryType) => {
      const list = filterHeadToHeadCountableEntries(entries, battleFormat, battle);
      const grouped = new Map();

      const ensureGroup = title => {
        const key = String(title || '').trim() || 'Other';
        if (!grouped.has(key)) grouped.set(key, []);
        return grouped.get(key);
      };

      options.forEach(opt => {
        const title = String(opt?.label || '').trim();
        if (title) ensureGroup(title);
      });

      buildHeadToHeadSideChoices(entryType).forEach(choice => {
        ensureGroup(choice.side).push(choice);
      });

      list.forEach(entry => {
        const userId = String(pickFirst(entry?.userId, entry?.user?.id, entry?.id, '') || '');
        const side = String(pickFirst(entry?.side, entry?.option, entry?.selection, entry?.choice, '') || '').trim();

        const meta = entry?.user
          ? {
            displayName: pickFirst(entry.user.displayName, entry.user.name, 'User'),
            displayHandle: pickFirst(entry.user.userName, entry.user.handle, ''),
            displayAvatar: pickFirst(entry.user.image, entry.user.avatar, FALLBACK_AVATAR),
          }
          : resolveUserMeta(userId);

        const fallbackName = entryType === 'votes' ? 'Voter' : 'Predictor';
        const matchedOption = resolveOptionForSide(side);
        const row = {
          userId,
          displayName: pickFirst(meta?.displayName, fallbackName),
          displayHandle: pickFirst(meta?.displayHandle, ''),
          displayAvatar: pickFirst(meta?.displayAvatar, FALLBACK_AVATAR),
          side: matchedOption?.label || side,
          isSideChoice: false,
        };

        const groupTitle = matchedOption?.label || side || 'Other';

        ensureGroup(groupTitle).push(row);
      });

      // If API doesn't provide voter meta (only participants are available), still render participants
      // so users can see each participant and their chosen side under their details.
      if (entryType === 'votes' && list.length === 0) {
        const participants = Array.isArray(battle?.participants) ? battle.participants : [];
        participants.forEach(p => {
          const userId = String(pickFirst(p?.userId, p?.user?.id, '') || '');
          const side = String(pickFirst(p?.side, '') || '').trim();
          const meta = p?.user
            ? {
              displayName: pickFirst(p.user.displayName, p.user.name, 'User'),
              displayHandle: pickFirst(p.user.userName, p.user.handle, ''),
              displayAvatar: pickFirst(p.user.image, p.user.avatar, FALLBACK_AVATAR),
            }
            : resolveUserMeta(userId);

          const matchedOption = resolveOptionForSide(side);
          const groupTitle = matchedOption?.label || side || 'Participants';

          ensureGroup(groupTitle).push({
            userId,
            displayName: pickFirst(meta?.displayName, 'User'),
            displayHandle: pickFirst(meta?.displayHandle, ''),
            displayAvatar: pickFirst(meta?.displayAvatar, FALLBACK_AVATAR),
            side: matchedOption?.label || side,
          });
        });
      }

      return Array.from(grouped.entries()).map(([title, data]) => ({
        title,
        data,
        countableTotal: data.filter(row => !row.isSideChoice).length,
      }));
    },
    [battle, battleFormat, buildHeadToHeadSideChoices, options, resolveOptionForSide, resolveUserMeta],
  );

  const votesSections = useMemo(
    () => buildSections(battle?.votes, 'votes'),
    [battle?.votes, buildSections],
  );

  const predictionsSections = useMemo(
    () => buildSections(battle?.predictions, 'predictions'),
    [battle?.predictions, buildSections],
  );

  const commentSections = useMemo(() => {
    const comments = Array.isArray(battle?.comments) ? battle.comments : [];
    const normalizedSelectedSide = normalizeSideKey(selectedSide);
    const data = normalizedSelectedSide
      ? comments.filter(comment => normalizeSideKey(comment?.side) === normalizedSelectedSide)
      : comments;

    return [{
      title: selectedSideLabel || t('battleVoteDetails.commentsTitle', 'Comments'),
      data,
    }];
  }, [battle?.comments, selectedSide, selectedSideLabel, t]);

  const sections = activeTab === 'comments'
    ? commentSections
    : activeTab === 'votes' ? votesSections : predictionsSections;

  const optionSummaries = useMemo(() => {
    const sideCounts = activeTab === 'votes' ? battle?.voteCounts : battle?.predictionCounts;
    const fallbackCountsFromSections = sections.reduce((acc, section) => {
      const countable = Number.isFinite(section?.countableTotal)
        ? section.countableTotal
        : section.data.filter(row => !row.isSideChoice).length;
      acc[section.title] = (acc[section.title] || 0) + countable;
      return acc;
    }, {});

    const countForOption = (label, sideKey) => {
      const candidateKeys = [label, sideKey].filter(Boolean).map(v => String(v));
      if (candidateKeys.length === 0) return 0;

      if (battleFormat !== 'HEAD_TO_HEAD') {
        const direct = sideCounts && typeof sideCounts === 'object'
          ? candidateKeys.map(k => sideCounts[k]).find(v => v !== undefined)
          : undefined;
        const directNum = Number(direct);
        if (Number.isFinite(directNum)) return directNum;

        const normalizedTargets = candidateKeys.map(normalizeSideKey);
        if (sideCounts && typeof sideCounts === 'object') {
          const matchKey = Object.keys(sideCounts).find(k =>
            normalizedTargets.includes(normalizeSideKey(k)),
          );
          const matchNum = Number(matchKey ? sideCounts[matchKey] : undefined);
          if (Number.isFinite(matchNum)) return matchNum;
        }
      }

      const normalizedTargets = candidateKeys.map(normalizeSideKey);
      const fallbackKey = Object.keys(fallbackCountsFromSections).find(
        k => normalizedTargets.includes(normalizeSideKey(k)),
      );
      return fallbackKey ? Number(fallbackCountsFromSections[fallbackKey] || 0) : 0;
    };

    const base = options.length > 0 ? options : [{ id: '0', label: 'Other', sideKey: 'Other' }];
    return base.map((opt, idx) => ({
      sideKey: String(opt.id ?? idx),
      title: opt.label,
      count: countForOption(opt.label, opt.sideKey),
    }));
  }, [
    activeTab,
    battle?.voteCounts,
    battle?.predictionCounts,
    battleFormat,
    options,
    sections,
  ]);

  const selectedSideVoteCount = useMemo(() => {
    const normalizedSelectedSide = normalizeSideKey(selectedSide);
    if (!normalizedSelectedSide) return 0;

    const votes = filterHeadToHeadCountableEntries(battle?.votes, battleFormat, battle);
    return votes.filter(entry => {
      const side = String(pickFirst(entry?.side, entry?.option, entry?.selection, entry?.choice, '') || '');
      return normalizeSideKey(side) === normalizedSelectedSide;
    }).length;
  }, [battle, battle?.votes, battleFormat, selectedSide]);

  const handleOpenUser = useCallback(
    userId => {
      const targetUserId = String(userId || '').trim();
      if (!targetUserId) return;

      navigation.navigate('HomeMain', {
        screen: 'UsersProfile',
        params: {
          userId: targetUserId,
          returnTo: route?.name || 'BattleVoteDetails',
          returnParams: route?.params,
        },
      });
    },
    [navigation, route?.name, route?.params],
  );

  const renderCommentRow = ({ item }) => {
    const authorName = pickFirst(item?.authorName, item?.user?.name, item?.user?.displayName, 'User');
    const authorHandle = pickFirst(item?.authorHandle, item?.user?.userName, item?.user?.username, '');
    const avatar = pickFirst(item?.avatar, item?.user?.image, item?.user?.avatar, FALLBACK_AVATAR);
    const message = pickFirst(item?.message, item?.comment, item?.text, '');
    const likes = Number(pickFirst(item?.likes, item?.likeCount, item?.likesCount, 0));

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenUser(item?.userId)}
        style={[
          styles.commentRow,
          {
            borderColor: palette.border,
            backgroundColor: palette.surface,
          },
        ]}>
        <View style={styles.commentHeader}>
          <HexAvatar
            uri={avatar || FALLBACK_AVATAR}
            size={38}
            borderWidth={1}
            borderColor={palette.border}
          />
          <View style={styles.commentAuthorText}>
            <Text numberOfLines={1} style={[styles.name, { color: text }]}>
              {authorName}
            </Text>
            {!!authorHandle && (
              <Text numberOfLines={1} style={[styles.handle, { color: palette.muted }]}>
                @{authorHandle}
              </Text>
            )}
          </View>
          {!!item?.side && (
            <View style={[styles.badge, { borderColor: palette.border, backgroundColor: palette.soft }]}>
              <Text numberOfLines={1} style={[styles.badgeText, { color: palette.primary }]}>
                {item.side}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.commentMessage, { color: text }]}>
          {message}
        </Text>

        <View style={styles.commentMetaRow}>
          <Ionicons name={item?.isLiked ? 'heart' : 'heart-outline'} size={16} color={item?.isLiked ? '#E11D48' : palette.muted} />
          <Text style={[styles.commentMetaText, { color: item?.isLiked ? '#E11D48' : palette.muted }]}>
            {Number.isFinite(likes) ? likes : 0}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRow = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenUser(item.userId)}
        style={[
          styles.row,
          {
            borderColor: palette.border,
            backgroundColor: palette.surface,
          },
        ]}>
        <HexAvatar
          uri={item.displayAvatar || FALLBACK_AVATAR}
          size={44}
          borderWidth={1}
          borderColor={palette.border}
        />

        <View style={styles.rowText}>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: text }]}>
            {item.displayName}
          </Text>

          {!!item.displayHandle && (
            <Text
              numberOfLines={1}
              style={[styles.handle, { color: palette.muted }]}>
              @{item.displayHandle}
            </Text>
          )}
        </View>

        {!!item.side && (
          <View
            style={[
              styles.badge,
              {
                borderColor: palette.border,
                backgroundColor: palette.soft,
              },
            ]}>
            <Text
              numberOfLines={1}
              style={[styles.badgeText, { color: palette.primary }]}>
              {item.isSideChoice
                ? t('battleVoteDetails.sideChoice', 'Side choice')
                : item.side}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };


  const titleText =
    activeTab === 'comments'
      ? (selectedSideLabel
        ? `${selectedSideLabel} ${t('battleVoteDetails.commentsTitle', 'Comments')}`
        : t('battleVoteDetails.commentsTitle', 'Comments'))
      : activeTab === 'votes'
        ? t('battleVoteDetails.votesTitle', 'Votes')
        : t('battleVoteDetails.predictionsTitle', 'Predictions');

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      {/* HEADER */}

      <View
        style={[
          styles.header,
          {
            borderBottomColor: palette.border,
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Ionicons
            name="chevron-back"
            size={22}
            color={text}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: text }]}>
            {titleText}
          </Text>

          {/* <Text
            numberOfLines={1}
            style={[styles.headerSub, { color: palette.muted }]}>
            {totalCount}{' '}
            {activeTab === 'votes' ? 'votes' : 'predictions'}
          </Text> */}
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* CONTENT */}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={palette.primary}
          />

          <Text
            style={[
              styles.loadingText,
              { color: palette.muted },
            ]}>
            {t('battleVoteDetails.loading', 'Loading...')}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            `${item.userId}-${index}`
          }
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { }}
          renderItem={activeTab === 'comments' ? renderCommentRow : renderRow}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: text },
                ]}>
                {section.title}
              </Text>

              {activeTab !== 'comments' && (
                <Text
                  style={[
                    styles.sectionCount,
                    { color: palette.muted },
                  ]}>
                  {section.data.length}
                </Text>
              )}
            </View>
          )}
          renderSectionFooter={({ section }) => {
            const countableRows = Array.isArray(section?.data)
              ? section.data.filter(row => !row.isSideChoice)
              : [];
            if (countableRows.length > 0) {
              return null;
            }

            return (
              <View
                style={[
                  styles.sectionEmpty,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.soft,
                  },
                ]}>
                <Text
                  style={[
                    styles.sectionEmptyText,
                    { color: palette.muted },
                  ]}>
                  {activeTab === 'comments'
                    ? t(
                      'battleVoteDetails.noCommentsForSide',
                      'No comments for this side yet',
                    )
                    : activeTab === 'votes'
                      ? t(
                        'battleVoteDetails.noVotesForOption',
                        'No votes for this option',
                      )
                      : t(
                        'battleVoteDetails.noPredictionsForOption',
                        'No predictions for this option',
                      )}
                </Text>
              </View>
            );
          }}
          ListHeaderComponent={() => (
            <View>
              {/* SUMMARY */}

              <View
                style={[
                  styles.summaryCard,
                  cardStyle,
                  {
                    borderColor: palette.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.summaryTitle,
                    { color: text },
                  ]}>
                  {battle.question}
                </Text>

                <View style={styles.chipsRow}>
                  <View
                    style={[
                      styles.chip,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.soft,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: palette.primary },
                      ]}>
                      {battleType}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.chip,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.soft,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: palette.primary },
                      ]}>
                      {battleFormat}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.chip,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.soft,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: palette.primary },
                      ]}>
                      {battleStatus}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.summaryHint,
                    { color: palette.muted },
                  ]}>
                  {t(
                    'battleVoteDetails.tapUserHint',
                    'Tap a user to open profile.',
                  )}
                </Text>
              </View>

              {/* BREAKDOWN */}

              {activeTab === 'comments' && selectedSide ? (
                <View
                  style={[
                    styles.selectedSideCard,
                    cardStyle,
                    {
                      borderColor: palette.border,
                    },
                  ]}>
                  <Text style={[styles.selectedSideTitle, { color: text }]} numberOfLines={1}>
                    {selectedSideLabel || selectedSide}
                  </Text>
                  <View style={[styles.selectedSidePill, { backgroundColor: palette.soft, borderColor: palette.border }]}>
                    <Text style={[styles.selectedSidePillText, { color: palette.primary }]}>
                      {selectedSideVoteCount} {t('battleInProgress.votesLabel', 'votes')}
                    </Text>
                  </View>
                </View>
              ) : null}

              {activeTab !== 'comments' && optionSummaries.length > 0 && (
                <View
                  style={[
                    styles.breakdownCard,
                    cardStyle,
                    {
                      borderColor: palette.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.breakdownTitle,
                      { color: text },
                    ]}>
                    {t('battleVoteDetails.breakdownTitle', 'Breakdown')}
                  </Text>

                  <View style={styles.breakdownList}>
                    {optionSummaries.map(opt => (
                      <View
                        key={opt.sideKey}
                        style={[
                          styles.breakdownRow,
                          {
                            borderColor: palette.border,
                          },
                        ]}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.breakdownLabel,
                            {
                              color: palette.muted,
                            },
                          ]}>
                          {opt.title}
                        </Text>

                        <View
                          style={[
                            styles.breakdownPill,
                            {
                              backgroundColor:
                                palette.soft,
                              borderColor:
                                palette.border,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.breakdownCount,
                              {
                                color:
                                  palette.primary,
                              },
                            ]}>
                            {opt.count}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={() => (
            <View
              style={[
                styles.empty,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                },
              ]}>
              <Text
                style={[styles.emptyTitle, { color: text }]}>
                {t('battleVoteDetails.emptyTitle', 'No data yet')}
              </Text>

              <Text
                style={[
                  styles.emptyText,
                  { color: palette.muted },
                ]}>
                {t(
                  'battleVoteDetails.emptySubtitle',
                  'Come back later to check activity.',
                )}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  backBtn: {
    padding: 6,
    marginRight: 8,
  },

  headerText: {
    flex: 1,
  },

  headerRight: {
    width: 28,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },

  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },

  tabBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },

  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },

  listContent: {
    padding: 14,
    paddingBottom: 26,
  },

  summaryCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
  },

  summaryHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },

  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  rowText: {
    flex: 1,
    marginLeft: 10,
  },

  commentRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  commentAuthorText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  commentMessage: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },

  commentMetaText: {
    fontSize: 12,
    fontWeight: '800',
  },

  name: {
    fontSize: 14,
    fontWeight: '800',
  },

  handle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },

  badge: {
    maxWidth: 130,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  empty: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },

  emptyText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  chip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  chipText: {
    fontSize: 12,
    fontWeight: '800',
  },

  breakdownCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },

  selectedSideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },

  selectedSideTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    marginRight: 10,
  },

  selectedSidePill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  selectedSidePillText: {
    fontSize: 12,
    fontWeight: '900',
  },

  breakdownTitle: {
    fontSize: 13,
    fontWeight: '900',
  },

  breakdownList: {
    marginTop: 10,
    gap: 10,
  },

  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  breakdownLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 10,
  },

  breakdownPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  breakdownCount: {
    fontSize: 12,
    fontWeight: '900',
  },

  sectionEmpty: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  sectionEmptyText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
