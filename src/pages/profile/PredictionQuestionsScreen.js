import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useToast } from 'react-native-toast-notifications';
import { useLanguage } from '../../i18n';
import { getPredictionQuestions } from '../../services/battle';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';

const BORDER = '#D1D5DB';
const MUTED = '#6B7280';

const toTitleCase = value =>
  String(value || '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, char => char.toUpperCase());

const formatCloseTime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function PredictionQuestionsScreen({
  category,
  profile,
  onBack,
  onSelectQuestion,
}) {
  const toast = useToast();
  const { t } = useLanguage();
  const { bgStyle, accent, card, border, mutedText } = useAppTheme(profile);
  const { isDarkMode } = useThemeContext();
  const labelColor = isDarkMode ? '#ffffff' : '#111827';
  const inputBackground = isDarkMode ? 'rgba(255,255,255,0.08)' : (card || '#FFFFFF');
  const themeBorder = border || BORDER;

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchText, setSearchText] = useState('');

  const filteredQuestions = useMemo(() => {
    const trimmed = searchText.trim().toLowerCase();
    if (!trimmed) {
      return questions;
    }
    return questions.filter(item =>
      String(item?.question || '').toLowerCase().includes(trimmed),
    );
  }, [questions, searchText]);

  const fetchQuestions = useCallback(
    async ({ isRefresh = false, nextPage = 1 } = {}) => {
      if (!category) return;

      if (isRefresh) {
        setRefreshing(true);
      } else if (nextPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await getPredictionQuestions({
          category,
          page: nextPage,
          limit: 20,
        });
        const list = Array.isArray(response?.data?.data?.data)
          ? response.data.data.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];

        setQuestions(prev => (nextPage === 1 ? list : [...prev, ...list]));
        setHasMore(list.length >= 20);
        setPage(nextPage);
      } catch (error) {
        showToastMessage(
          toast,
          'danger',
          error?.message || t('openBattle.somethingWentWrong'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [category, t, toast],
  );

  useEffect(() => {
    fetchQuestions({ nextPage: 1 });
  }, [fetchQuestions]);

  const handleSelectQuestion = question => {
    onSelectQuestion?.(question);
  };

  const renderQuestion = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[
        styles.questionCard,
        { backgroundColor: inputBackground, borderColor: themeBorder },
      ]}
      onPress={() => handleSelectQuestion(item)}
    >
      <View style={styles.questionTopRow}>
        <View>
          {/* <Text style={styles.providerBadgeText}>
            {toTitleCase(item?.provider)}
          </Text> */}
        </View>
        {!!item?.closeTime && (
          <Text style={styles.closeTimeText}>
            {t('openBattle.predictionCloses') || 'Closes'} {formatCloseTime(item.closeTime)}
          </Text>
        )}
      </View>

      <Text style={[styles.questionText, { color: labelColor }]} numberOfLines={3}>
        {item?.question}
      </Text>

      {Array.isArray(item?.options) && item.options.length > 0 && (
        <View style={styles.optionsRow}>
          {item.options.slice(0, 4).map((opt, index) => (
            <View
              key={`${opt}-${index}`}
              style={[styles.optionChip, { borderColor: themeBorder }]}
            >
              <Text style={[styles.optionChipText, { color: labelColor }]}>
                {opt}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.selectRow}>
        <Ionicons name="chevron-forward-circle" size={20} color={accent} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.headerIconBtn}
        >
          <Ionicons name="chevron-back" size={24} color={accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: labelColor }]} numberOfLines={1}>
          {toTitleCase(category)}
        </Text>
        <View style={styles.headerIconBtn} />
      </View>

      <View
        style={[
          styles.searchInputWrap,
          { backgroundColor: inputBackground, borderColor: themeBorder },
        ]}
      >
        <Ionicons name="search" size={18} color={mutedText} />
        <TextInput
          style={[styles.searchInput, { color: labelColor }]}
          placeholder={t('openBattle.predictionSearchPlaceholder') || 'Search questions'}
          placeholderTextColor={mutedText}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {!!searchText && (
          <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={mutedText} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          data={filteredQuestions}
          keyExtractor={(item, index) =>
            String(item?.externalMarketId || item?.externalEventId || index)
          }
          renderItem={renderQuestion}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchQuestions({ isRefresh: true, nextPage: 1 })}
              tintColor={accent}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && !loadingMore) {
              fetchQuestions({ nextPage: page + 1 });
            }
          }}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={accent} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={{ color: mutedText, fontWeight: '600' }}>
                {searchText
                  ? (t('openBattle.predictionNoSearchResults') || 'No questions match your search')
                  : (t('openBattle.predictionNoQuestions') || 'No questions found')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  searchInputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 46,
    marginHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: { paddingHorizontal: 14, paddingBottom: 24, paddingTop: 4 },
  questionCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  questionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  providerBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  providerBadgeText: { fontSize: 10, fontWeight: '800', color: '#7C3AED' },
  closeTimeText: { fontSize: 11, fontWeight: '600', color: MUTED },
  questionText: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionChipText: { fontSize: 11, fontWeight: '700' },
  selectRow: { alignItems: 'flex-end', marginTop: 8 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // paddingTop: 60,
  },
});
