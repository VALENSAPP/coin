import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';

const chaptersFallback = [
  'Build your personal brand',
  'Create content that connects',
  'Monetize your knowledge',
  'Grow your audience',
];

const EbookDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const ebook = route?.params?.ebook || {};
  const { bgStyle } = useAppTheme(route?.params?.userData?.profile);
  const chapters = useMemo(() => route?.params?.chapters || chaptersFallback, [route?.params?.chapters]);

  const title = ebook.title || "The Creator's Playbook";
  const author = ebook.author || 'Steven Austin';
  const descriptionLines = [
    'Build your brand.',
    'Create impact.',
    'Share your knowledge.',
    'Earn your freedom.',
  ];

  return (
    <View style={[styles.screen, bgStyle]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <View style={styles.authorWrap}>
            <View style={styles.avatarStack}>
              <Image source={{ uri: 'https://i.pravatar.cc/80?img=32' }} style={styles.avatar} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.authorTextWrap}>
              <View style={styles.authorTopLine}>
                <Text style={styles.authorName}>{author}</Text>
                <Ionicons name="checkmark-circle" size={16} color="#2F80ED" />
              </View>
              <Text style={styles.metaText}>2m ago</Text>
            </View>
            <View style={styles.subscriberPill}>
              <Text style={styles.subscriberPillText}>Subscribers</Text>
            </View>
          </View>
        </View>

        <Text style={styles.postText}>
          Excited to share my new e-book with you all!{'\n'}
          Hope you find it helpful 💜
        </Text>

        <View style={styles.previewCard}>
          <View style={styles.cardLeft}>
            <View style={styles.cover}>
              <Text style={styles.coverText} numberOfLines={3}>{title}</Text>
              <Text style={styles.coverSub}>Build. Share. Earn.</Text>
              <Text style={styles.coverAuthor}>STEVEN AUSTIN</Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.ebookTitle}>{title}</Text>
            <Text style={styles.byline}>By {author}</Text>
            <Text style={styles.description}>
              {descriptionLines.map((line) => `${line}\n`)}
            </Text>
            <View style={styles.metricsRow}>
              <Text style={styles.metric}>📚 {ebook.chapters || 5} Chapters</Text>
              <Text style={styles.metric}>📄 {ebook.pages || 24} Pages</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.readButton}>
          <Ionicons name="book-outline" size={16} color="#5A2D82" />
          <Text style={styles.readButtonText}>Read e-book</Text>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="heart-outline" size={20} color="#ef4444" />
            <Text style={styles.actionCount}>32</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={20} color="#6b7280" />
            <Text style={styles.actionCount}>12</Text>
          </TouchableOpacity>
          <View style={styles.actionSpacer} />
          <TouchableOpacity style={styles.bookmarkBtn}>
            <Ionicons name="bookmark-outline" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default memo(EbookDetailScreen);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,

  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop:'10%'
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  authorWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 15
  },
  avatarStack: {
    marginRight: 10,
    position: 'relative',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#fff',
  },
  authorTextWrap: { flex: 1 },
  authorTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  metaText: { fontSize: 11, color: '#8b8b94', marginTop: 1 },
  subscriberPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f4ecfb',
    borderWidth: 1,
    borderColor: '#eadcf7',
    marginLeft: 8,
  },
  subscriberPillText: { fontSize: 11, color: '#6b4b8f', fontWeight: '700' },
  menuBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#202124',
    marginBottom: 12,
  },
  previewCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ece5f5',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardLeft: { marginRight: 12 },
  cover: {
    width: 112,
    height: 160,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#5A2D82',
    justifyContent: 'space-between',
  },
  coverText: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  coverSub: { color: '#E8DAF7', fontSize: 10, fontWeight: '600' },
  coverAuthor: { color: '#fff', fontSize: 10, letterSpacing: 1.1 },
  cardRight: { flex: 1 },
  ebookTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 4 },
  byline: { fontSize: 12, color: '#7b7b85', marginBottom: 10 },
  description: { fontSize: 13, color: '#4b5563', lineHeight: 19, marginBottom: 10 },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metric: { fontSize: 11, color: '#6b7280', fontWeight: '700' },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2D3F4',
    backgroundColor: '#F8F1FF',
    borderRadius: 14,
    paddingVertical: 11,
    gap: 6,
    marginTop: 14,
  },
  readButtonText: { color: '#5A2D82', fontWeight: '800' },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  actionSpacer: { flex: 1 },
  bookmarkBtn: {
    width: 34,
    alignItems: 'flex-end',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 10, marginTop: 6 },
  learnList: {
    paddingBottom: 14,
  },
  learnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  learnBullet: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#5A2D82',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chapterText: { fontSize: 13, color: '#1F2937', fontWeight: '600', flex: 1 },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  commentAvatar: { width: 26, height: 26, borderRadius: 13, marginRight: 10 },
  commentPlaceholder: { flex: 1, color: '#9ca3af', fontSize: 13 },
  sendBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
