import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';

const DEFAULT_EBOOKS = [
  {
    id: 'ebook-1',
    title: "The Creator's Playbook",
    author: 'Steven Austin',
    description: 'Build your brand. Create impact. Share your knowledge.',
    pages: 24,
    chapters: 5,
    theme: 'purple',
  },
  {
    id: 'ebook-2',
    title: 'Mindset Mastery',
    author: 'Steven Austin',
    description: 'Develop the right mindset to overcome challenges and achieve your goals.',
    pages: 18,
    chapters: 4,
    theme: 'sand',
  },
  {
    id: 'ebook-3',
    title: 'Content That Connects',
    author: 'Steven Austin',
    description: 'Learn how to create content that attracts, engages, and builds your audience.',
    pages: 32,
    chapters: 6,
    theme: 'forest',
  },
  {
    id: 'ebook-4',
    title: 'Monetize Your Impact',
    author: 'Steven Austin',
    description: 'Proven strategies to turn your knowledge and influence into sustainable income.',
    pages: 27,
    chapters: 5,
    theme: 'gold',
  },
  {
    id: 'ebook-5',
    title: 'Build Your Personal Brand',
    author: 'Steven Austin',
    description: 'Step-by-step guidance to build a brand that stands out and creates opportunities.',
    pages: 40,
    chapters: 8,
    theme: 'ink',
  },
];

const themeStyles = {
  purple: { bg: '#5A2D82', tint: '#EDE3FA' },
  sand: { bg: '#C08B47', tint: '#FFF1D9' },
  forest: { bg: '#274C3A', tint: '#DDEFE3' },
  gold: { bg: '#8A6B1C', tint: '#F8EBC2' },
  ink: { bg: '#1F2937', tint: '#E5E7EB' },
};

const EbookCard = memo(({ item, onPress }) => {
  const palette = themeStyles[item.theme] || themeStyles.purple;
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.card}>
      <View style={[styles.cover, { backgroundColor: palette.bg }]}>
        <Text style={styles.coverTitle} numberOfLines={3}>{item.title}</Text>
        <Text style={styles.coverAuthor}>{item.author}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>📄 {item.pages} Pages</Text>
          <Text style={styles.meta}>📚 {item.chapters} Chapters</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#6b7280" />
    </TouchableOpacity>
  );
});

const ProfileEbookScreen = ({ userData, ebooks, onOpenEbook }) => {
  const { bgStyle } = useAppTheme(userData?.profile);
  const data = useMemo(() => (Array.isArray(ebooks) && ebooks.length ? ebooks : DEFAULT_EBOOKS), [ebooks]);

  const openEbook = (item) => {
    onOpenEbook?.(item);
  };

  return (
    <View style={[styles.screen, bgStyle]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>E-books</Text>
        <Text style={styles.headerCount}>{data.length} E-books</Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EbookCard item={item} onPress={() => openEbook(item)} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default memo(ProfileEbookScreen);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  headerCount: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E1F3',
  },
  cover: {
    width: 68,
    height: 92,
    borderRadius: 12,
    padding: 8,
    justifyContent: 'space-between',
    marginRight: 12,
  },
  coverTitle: { color: '#fff', fontWeight: '800', fontSize: 12 },
  coverAuthor: { color: '#fff', fontSize: 10, opacity: 0.9 },
  cardBody: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  desc: { fontSize: 12, color: '#6b7280', lineHeight: 16, marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap' },
  meta: { fontSize: 11, color: '#5A2D82', fontWeight: '700', marginRight: 10, marginBottom: 2 },
});
