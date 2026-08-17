import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useToast } from 'react-native-toast-notifications';
import { useLanguage } from '../../i18n';
import { getPredictionCategories } from '../../services/battle';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0']; // user
const COMPANY_GRADIENT = ['#C9A15a', '#C9A15a'];   // company
const BORDER = '#D1D5DB';
const MUTED = '#6B7280';

const CATEGORY_ICONS = {
  SPORTS: 'football-outline',
  FINANCE: 'trending-up-outline',
  ELECTIONS: 'flag-outline',
  CRYPTO: 'logo-bitcoin',
};

const toTitleCase = value =>
  String(value || '')
    .toLowerCase()
    .replace(/(^|\s)\S/g, char => char.toUpperCase());

export default function PredictionCategoryScreen({
  profile,
  onBack,
  onSelectCategory,
}) {
  const toast = useToast();
  const { t } = useLanguage();
  const { bgStyle, accent, card, border, mutedText } = useAppTheme(profile);
  const { isDarkMode } = useThemeContext();
  const labelColor = isDarkMode ? '#ffffff' : '#111827';
  const inputBackground = isDarkMode ? 'rgba(255,255,255,0.08)' : (card || '#FFFFFF');
  const themeBorder = border || BORDER;
  const gradientColors = profile !== 'user' ? COMPANY_GRADIENT : PRIMARY_GRADIENT;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = useCallback(async ({ isRefresh = false } = {}) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await getPredictionCategories();
      const list = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.data)
          ? response.data.data
          : [];
      setCategories(list);
    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.message || t('openBattle.somethingWentWrong'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSelectCategory = category => {
    onSelectCategory?.(category);
  };

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.categoryCell}
      onPress={() => handleSelectCategory(item)}
    >
      <View
        style={[
          styles.categoryCard,
          { backgroundColor: inputBackground, borderColor: themeBorder },
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.categoryIconWrap}
        >
          <Ionicons
            name={CATEGORY_ICONS[item] || 'help-circle-outline'}
            size={22}
            color="#fff"
          />
        </LinearGradient>
        <Text style={[styles.categoryTitle, { color: labelColor }]}>
          {toTitleCase(item)}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={mutedText} />
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
        <Text style={[styles.headerTitle, { color: labelColor }]}>
          {t('openBattle.predictionCategoryTitle') || 'Choose a Category'}
        </Text>
        <View style={styles.headerIconBtn} />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroSubtitle}>
          {t('openBattle.predictionCategorySubtitle') ||
            'Pick a category to browse live prediction markets'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={item => item}
          renderItem={renderCategory}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCategories({ isRefresh: true })}
              tintColor={accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={{ color: mutedText, fontWeight: '600' }}>
                {t('openBattle.predictionNoCategories') || 'No categories available'}
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
  headerTitle: { fontSize: 16, fontWeight: '700' },
  hero: { paddingHorizontal: 14, paddingBottom: 6 },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
  },
  listContent: { paddingHorizontal: 14, paddingBottom: 24, paddingTop: 6 },
  categoryCell: { marginBottom: 12 },
  categoryCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
