import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { normalizeProfileType } from '../../utils/supportEligibility';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useLanguage } from '../../i18n';

const FALLBACK_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

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
const normalizeSideKey = value =>
  String(value || '')
    .trim()
    .toLowerCase();
const getAvatarUri = (...values) =>
  String(pickFirst(...values, FALLBACK_AVATAR) || FALLBACK_AVATAR).trim() ||
  FALLBACK_AVATAR;

const withAlpha = (hex, alpha) => {
  if (typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
};

const filterHeadToHeadCountableEntries = entries => {
  return Array.isArray(entries) ? entries : [];
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
  const { comments: passedComments, selectedUserId, selectedSpeakerLabel } = route.params || {};
  const initialSelectedSide = String(route?.params?.selectedSide || '').trim();
  const initialSelectedSideLabel = String(
    route?.params?.selectedSideLabel || initialSelectedSide || '',
  ).trim();
  const [selectedSide, setSelectedSide] = useState(initialSelectedSide);
  const [selectedSideLabel, setSelectedSideLabel] = useState(
    initialSelectedSideLabel,
  );
  const resolvedProfileType = normalizeProfileType(profile);
  const { bgStyle, cardStyle, accent, card, border, mutedText, bg } = useAppTheme(resolvedProfileType);
  const { isDarkMode } = useThemeContext();
  const labelColor = isDarkMode ? '#ffffff' : '#111827';
  const inputSurface = isDarkMode ? 'rgba(255,255,255,0.08)' : card;

  const palette = useMemo(
    () => ({
      primary: accent || '#5A2D82',
      border: border || withAlpha(accent || '#5A2D82', '22'),
      surface: isDarkMode ? withAlpha(accent || '#5A2D82', '14') : withAlpha(accent || '#5A2D82', '08'),
      soft: isDarkMode ? withAlpha(accent || '#5A2D82', '24') : withAlpha(accent || '#5A2D82', '10'),
      muted: mutedText || withAlpha(accent || '#5A2D82', '99'),
    }),
    [accent, border, card, isDarkMode, mutedText],
  );

  const [loading] = useState(false);
  const [refreshing] = useState(false);

  const [activeTab] = useState(
    route?.params?.mode === 'comments' ? 'comments' : 'votes',
  );

  useEffect(() => {
    const nextSelectedSide = String(route?.params?.selectedSide || '').trim();
    const nextSelectedSideLabel = String(
      route?.params?.selectedSideLabel || nextSelectedSide || '',
    ).trim();

    setSelectedSide(nextSelectedSide);
    setSelectedSideLabel(nextSelectedSideLabel);
  }, [route?.params?.selectedSide, route?.params?.selectedSideLabel]);

  const options = useMemo(() => {
    const rawOptions = Array.isArray(battle?.options) ? battle.options : [];
    const normalized = rawOptions.map((opt, idx) => normalizeOption(opt, idx));
    if (normalized.length > 0) return normalized;

    const headToHeadSides = battle?.headToHeadSides;
    const creatorSide = pickFirst(
      headToHeadSides?.creatorSide,
      headToHeadSides?.creator?.side,
    );
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

      const participants = Array.isArray(battle?.participants)
        ? battle.participants
        : [];
      const matchedParticipant = participants.find(
        p => p?.userId === userId || p?.user?.id === userId,
      );
      if (matchedParticipant?.user) {
        return {
          displayName: pickFirst(
            matchedParticipant.user.displayName,
            matchedParticipant.user.name,
            'User',
          ),
          displayHandle: pickFirst(
            matchedParticipant.user.userName,
            matchedParticipant.user.handle,
            '',
          ),
          displayAvatar: getAvatarUri(
            matchedParticipant.user.image,
            matchedParticipant.user.avatar,
            matchedParticipant.user.profileImage,
            matchedParticipant.user.profilePicture,
            matchedParticipant.user.userImage,
          ),
        };
      }

      const comments = Array.isArray(battle?.comments) ? battle.comments : [];
      const matchedCommentAuthor = comments.find(c => c?.userId === userId);
      if (matchedCommentAuthor) {
        return {
          displayName: pickFirst(
            matchedCommentAuthor.authorName,
            matchedCommentAuthor.name,
            'User',
          ),
          displayHandle: pickFirst(
            matchedCommentAuthor.authorHandle,
            matchedCommentAuthor.handle,
            '',
          ),
          displayAvatar: getAvatarUri(
            matchedCommentAuthor.avatar,
            matchedCommentAuthor.image,
            matchedCommentAuthor.profileImage,
            matchedCommentAuthor.profilePicture,
          ),
        };
      }

      if (battle?.creatorId && battle.creatorId === userId && battle?.creator) {
        return {
          displayName: pickFirst(battle.creator.name, 'User'),
          displayHandle: pickFirst(battle.creator.handle, ''),
          displayAvatar: getAvatarUri(
            battle.creator.avatar,
            battle.creator.image,
            battle.creator.profileImage,
            battle.creator.profilePicture,
          ),
        };
      }

      if (
        battle?.invitedUserId &&
        battle.invitedUserId === userId &&
        battle?.invitedUser
      ) {
        return {
          displayName: pickFirst(battle.invitedUser.name, 'User'),
          displayHandle: pickFirst(battle.invitedUser.handle, ''),
          displayAvatar: getAvatarUri(
            battle.invitedUser.avatar,
            battle.invitedUser.image,
            battle.invitedUser.profileImage,
            battle.invitedUser.profilePicture,
          ),
        };
      }

      return null;
    },
    [battle],
  );

  const resolveOptionForSide = useCallback(
    sideValue => {
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

  const buildSections = useCallback(
    (entries, entryType) => {
      const normalizedSelectedSide = normalizeSideKey(selectedSide);
      const list = filterHeadToHeadCountableEntries(entries).filter(entry => {
        if (entryType !== 'votes' || !normalizedSelectedSide) return true;

        const side = String(
          pickFirst(
            entry?.side,
            entry?.option,
            entry?.selection,
            entry?.choice,
            '',
          ) || '',
        );
        return normalizeSideKey(side) === normalizedSelectedSide;
      });
      const grouped = new Map();

      const ensureGroup = title => {
        const key = String(title || '').trim() || 'Other';
        if (!grouped.has(key)) grouped.set(key, []);
        return grouped.get(key);
      };

      options
        .filter(opt => {
          if (entryType !== 'votes' || !normalizedSelectedSide) return true;
          return (
            normalizeSideKey(opt?.sideKey) === normalizedSelectedSide ||
            normalizeSideKey(opt?.label) === normalizedSelectedSide
          );
        })
        .forEach(opt => {
          const title = String(opt?.label || '').trim();
          if (title) ensureGroup(title);
        });

      list.forEach(entry => {
        const userId = String(
          pickFirst(entry?.userId, entry?.user?.id, entry?.id, '') || '',
        );
        const side = String(
          pickFirst(
            entry?.side,
            entry?.option,
            entry?.selection,
            entry?.choice,
            '',
          ) || '',
        ).trim();

        const meta = entry?.user
          ? {
            displayName: pickFirst(
              entry.user.displayName,
              entry.user.name,
              'User',
            ),
            displayHandle: pickFirst(
              entry.user.userName,
              entry.user.handle,
              '',
            ),
            displayAvatar: getAvatarUri(
              entry.user.image,
              entry.user.avatar,
              entry.user.profileImage,
              entry.user.profilePicture,
              entry.user.userImage,
            ),
          }
          : resolveUserMeta(userId);

        const fallbackName = entryType === 'votes' ? 'Voter' : 'Predictor';
        const matchedOption = resolveOptionForSide(side);
        const row = {
          userId,
          displayName: pickFirst(meta?.displayName, fallbackName),
          displayHandle: pickFirst(meta?.displayHandle, ''),
          displayAvatar: getAvatarUri(meta?.displayAvatar),
          side: matchedOption?.label || side,
        };

        const groupTitle = matchedOption?.label || side || 'Other';

        ensureGroup(groupTitle).push(row);
      });

      return Array.from(grouped.entries()).map(([title, data]) => ({
        title,
        data,
        countableTotal: data.length,
      }));
    },
    [options, resolveOptionForSide, resolveUserMeta, selectedSide],
  );

  const votesSections = useMemo(
    () => buildSections(battle?.votes, 'votes'),
    [battle?.votes, buildSections],
  );

  const predictionsSections = useMemo(
    () => buildSections(battle?.predictions, 'predictions'),
    [battle?.predictions, buildSections],
  );

  const selectedUserHighlight = useMemo(() => {
    if (activeTab !== 'comments') return null;

    const allComments = Array.isArray(passedComments)
      ? passedComments
      : Array.isArray(battle?.comments)
        ? battle.comments
        : [];
    const normalizedSelectedSide = normalizeSideKey(selectedSide);
    const sideComments = normalizedSelectedSide
      ? allComments.filter(
        comment => normalizeSideKey(comment?.side) === normalizedSelectedSide,
      )
      : allComments;

    const creatorId = String(
      pickFirst(battle?.creatorId, battle?.creator?.id, battle?.creator?._id, ''),
    ).trim();
    const invitedUserId = String(
      pickFirst(
        battle?.invitedUserId,
        battle?.invitedUser?.id,
        battle?.invitedUser?._id,
        '',
      ),
    ).trim();
    const participantIds = new Set(
      [creatorId, invitedUserId].filter(id => !!String(id || '').trim()),
    );
    const participantComments = sideComments.filter(comment => {
      const commentUserId = String(comment?.userId || comment?.user?.id || '').trim();
      return participantIds.has(commentUserId);
    });

    if (participantComments.length === 0) return null;

    const preferredComment =
      (selectedUserId
        ? participantComments.find(
          comment => String(comment?.userId || '') === String(selectedUserId),
        )
        : null) || participantComments[0];

    const preferredUserId = String(preferredComment?.userId || '');
    const meta = preferredUserId ? resolveUserMeta(preferredUserId) : null;
    const authorName = String(
      pickFirst(
        preferredComment?.authorName,
        preferredComment?.authorHandle,
        selectedSpeakerLabel,
        meta?.displayName,
        'User',
      ),
    );
    const message = String(
      pickFirst(preferredComment?.message, preferredComment?.comment, preferredComment?.text, ''),
    );
    const sideLabel = String(
      pickFirst(
        resolveOptionForSide(preferredComment?.side)?.label,
        preferredComment?.side,
        selectedSide,
        '',
      ),
    );

    return {
      userId: preferredUserId,
      authorName,
      avatar: getAvatarUri(
        preferredComment?.avatar,
        preferredComment?.image,
        preferredComment?.profileImage,
        preferredComment?.profilePicture,
        meta?.displayAvatar,
      ),
      message,
      side: sideLabel,
    };
  }, [
    activeTab,
    battle?.comments,
    passedComments,
    resolveOptionForSide,
    resolveUserMeta,
    selectedSide,
    selectedSpeakerLabel,
    selectedUserId,
  ]);

  const commentSections = useMemo(() => {
    const allComments = Array.isArray(passedComments)
      ? passedComments
      : Array.isArray(battle?.comments)
        ? battle.comments
        : [];
    const normalizedSelectedSide = normalizeSideKey(selectedSide);
    let data = normalizedSelectedSide
      ? allComments.filter(
        comment => normalizeSideKey(comment?.side) === normalizedSelectedSide,
      )
      : allComments;

    if (selectedUserId) {
      data = data.filter(
        comment => String(comment?.userId || '') !== String(selectedUserId),
      );
    }

    return [
      {
        title: t('battleVoteDetails.commentsTitle', 'Comments'),
        data,
      },
    ];
  }, [battle?.comments, passedComments, selectedSide, selectedUserId, t]);

  const sections =
    activeTab === 'comments'
      ? commentSections
      : activeTab === 'votes'
        ? votesSections
        : predictionsSections;

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

  const handleSelectOption = useCallback(
    option => {
      const nextSide = String(option?.sideKey || option?.label || '').trim();
      const nextLabel = String(option?.label || option?.sideKey || '').trim();
      if (!nextSide) return;

      setSelectedSide(nextSide);
      setSelectedSideLabel(nextLabel);

      navigation.setParams?.({
        selectedSide: nextSide,
        selectedSideLabel: nextLabel,
      });
    },
    [navigation],
  );

  const renderCommentCard = (item, { onPress = true } = {}) => {
    const authorName = pickFirst(
      item?.authorName,
      item?.authorHandle,
      item?.user?.userName,
      item?.user?.username,
      item?.authorName,
      item?.user?.name,
      item?.user?.displayName,
      'User',
    );
    const avatar = getAvatarUri(
      item?.avatar,
      item?.image,
      item?.profileImage,
      item?.profilePicture,
      item?.user?.image,
      item?.user?.avatar,
      item?.user?.profileImage,
      item?.user?.profilePicture,
      item?.user?.userImage,
    );
    const message = pickFirst(item?.message, item?.comment, item?.text, '');

    const card = (
      <View
        style={[
          styles.commentRow,
          cardStyle,
          {
            borderColor: palette.border,
          },
        ]}
      >
        <View style={styles.commentHeader}>
          <HexAvatar
            uri={avatar || FALLBACK_AVATAR}
            size={38}
            borderWidth={1}
            borderColor={palette.border}
          />
          <View style={styles.commentAuthorText}>
            <Text
              numberOfLines={1}
              style={[styles.commentName, { color: labelColor }]}
            >
              {authorName}
            </Text>
          </View>
          {!!item?.side && (
            <View
              style={[
                styles.sideBadge,
                { borderColor: palette.border, backgroundColor: palette.soft },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.sideBadgeText, { color: palette.primary }]}
              >
                {item.side}
              </Text>
            </View>
          )}
        </View>

        {!!message && (
          <Text style={[styles.commentMessage, { color: labelColor }]}>{message}</Text>
        )}
      </View>
    );

    if (!onPress || !item?.userId) {
      return card;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenUser(item?.userId)}
      >
        {card}
      </TouchableOpacity>
    );
  };

  const renderCommentRow = ({ item }) => renderCommentCard(item);

  const renderRow = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenUser(item.userId)}
        style={[
          styles.row,
          cardStyle,
          {
            borderColor: palette.border,
          },
        ]}
      >
        <HexAvatar
          uri={item.displayAvatar || FALLBACK_AVATAR}
          size={44}
          borderWidth={1}
          borderColor={palette.border}
        />

        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.name, { color: labelColor }]}>
            {item.displayName}
          </Text>

          {!!item.displayHandle && (
            <Text
              numberOfLines={1}
              style={[styles.handle, { color: palette.muted }]}
            >
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
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.badgeText, { color: palette.primary }]}
            >
              {item.side}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const titleText =
    activeTab === 'comments'
      ? t('battleVoteDetails.commentsTitle', 'Comments')
      : activeTab === 'votes'
        ? selectedSideLabel
          ? `${selectedSideLabel} ${t('battleVoteDetails.votesTitle', 'Votes')}`
          : t('battleVoteDetails.votesTitle', 'Votes')
        : t('battleVoteDetails.predictionsTitle', 'Predictions');

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      {/* HEADER */}

      <View
        style={[
          styles.header,
          // {
          //   borderBottomColor: palette.border,
          // },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={accent} />
        </TouchableOpacity>



        <View style={styles.headerRight} />
      </View>

      {/* CONTENT */}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={palette.primary} />

          <Text style={[styles.loadingText, { color: palette.muted }]}>
            {t('battleVoteDetails.loading', 'Loading...')}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            `${pickFirst(item?.id, item?._id, item?.userId, 'row')}-${index}`
          }
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { }}
          renderItem={activeTab === 'comments' ? renderCommentRow : renderRow}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: labelColor }]}>
                {activeTab === 'comments'
                  ? t('battleVoteDetails.commentsTitle', 'Comments')
                  : section.title}
              </Text>

              {activeTab !== 'comments' && (
                <Text style={[styles.sectionCount, { color: palette.muted }]}>
                  {section.data.length}
                </Text>
              )}
            </View>
          )}
          renderSectionFooter={({ section }) => {
            if (Array.isArray(section?.data) && section.data.length > 0) {
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
                ]}
              >
                <Text
                  style={[styles.sectionEmptyText, { color: palette.muted }]}
                >
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
              <View
                style={[
                  styles.headerText,
                  cardStyle,
                  {
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text numberOfLines={1} style={[styles.headerTitle, { color: labelColor }]}>
                  {battle?.question ||
                    battle?.title ||
                    t('battleVoteDetails.untitledBattle', 'Untitled battle')}
                </Text>
                <View style={{marginTop: 10}}/>
              {options.length > 0 && (
                <View style={styles.optionCardsRow}>
                  {options.slice(0, 2).map((option, index) => {
                    const normalizedSelectedSide = normalizeSideKey(selectedSide);
                    const isSelected =
                      !!normalizedSelectedSide &&
                      (normalizeSideKey(option.sideKey) === normalizedSelectedSide ||
                        normalizeSideKey(option.label) === normalizedSelectedSide);

                    return (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleSelectOption(option)}
                        key={option.id || `option-${index}`}
                        style={[
                          styles.optionCard,
                          cardStyle,
                          { borderColor: palette.border },
                          isSelected && {
                            borderColor: palette.primary,
                            backgroundColor: palette.soft,
                          },
                        ]}
                        >
                          <Text
                            numberOfLines={3}
                            style={[styles.optionCardText, { color: labelColor }]}
                          >
                            {option.label}
                          </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              </View>


              {!!selectedUserHighlight && (
                <View style={styles.featuredCommentWrap}>
                  {renderCommentCard(selectedUserHighlight, { onPress: true })}
                </View>
              )}

              {activeTab !== 'comments' && (
                <View
                  style={[
                    styles.summaryCard,
                    cardStyle,
                    {
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.summaryTitle, { color: labelColor }]}>
                    {titleText}
                  </Text>
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
              ]}
            >
              <Text style={[styles.emptyTitle, { color: labelColor }]}>
                {t('battleVoteDetails.emptyTitle', 'No data yet')}
              </Text>

              <Text style={[styles.emptyText, { color: palette.muted }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    // borderBottomWidth: 1,
  },

  backBtn: {
    padding: 6,
    marginRight: 8,
  },

  headerText: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  optionCardsRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 12,
    justifyContent: 'space-evenly',
  },

  optionCard: {
    // flex: 1,
    width: '40%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 8,
    // minHeight: 40,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  optionCardText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },

  headerRight: {
    width: 28,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
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
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },

  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },

  featuredCommentWrap: {
    marginBottom: 12,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  rowText: {
    flex: 1,
    marginLeft: 10,
  },

  commentRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
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
    marginRight: 8,
  },

  commentMessage: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },

  name: {
    fontSize: 14,
    fontWeight: '800',
  },

  commentName: {
    fontSize: 14,
    fontWeight: '900',
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

  sideBadge: {
    maxWidth: 116,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },

  sideBadgeText: {
    fontSize: 11,
    fontWeight: '900',
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
