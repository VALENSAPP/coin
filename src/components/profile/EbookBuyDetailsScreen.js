import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getMarketplaceEbookById } from '../../services/post';

const themeStyles = {
  purple: { bg: '#5A2D82', tint: '#EDE3FA' },
  sand: { bg: '#C08B47', tint: '#FFF1D9' },
  forest: { bg: '#274C3A', tint: '#DDEFE3' },
  gold: { bg: '#8A6B1C', tint: '#F8EBC2' },
  ink: { bg: '#1F2937', tint: '#E5E7EB' },
};

const getCoverImage = (item) => {
  if (!item) return null;
  const img = item.images?.[0] || item.image || item.thumbnail;
  if (typeof img === 'string') return img;
  if (img?.uri) return img.uri;
  if (img?.url) return img.url;
  return null;
};

const getDescription = (item) => {
  if (!item) return 'No description available';
  if (typeof item.text === 'string') {
    try {
      const parsed = JSON.parse(item.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch (e) {
      return item.text || 'No description available';
    }
  }
  if (Array.isArray(item.text) && item.text.length > 0) {
    return item.text[0];
  }
  return item.description || 'No description available';
};

const EbookBuyDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { ebook, userData, loggedInUserId } = route.params || {};
  const [loadedEbook, setLoadedEbook] = useState(null);
  useEffect(() => {
    const fetchFreshData = async () => {
      const ebookId = String(ebook?.id || ebook?._id || '').trim();
      if (!ebookId) return;
      try {
        const res = await getMarketplaceEbookById(ebookId);
        const fetchedData = res?.data?.ebook || res?.data?.data?.ebook || res?.ebook || res?.data || res;
        if (fetchedData) {
          setLoadedEbook(fetchedData);
        }
      } catch (err) {
        console.log('Error fetching fresh ebook details:', err);
      }
    };
    fetchFreshData();
  }, [ebook]);

  const currentEbook = loadedEbook || ebook;

  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);
  const accentColor = text || '#5A2D82';

  const coverImage = getCoverImage(currentEbook);
  const title = currentEbook?.caption || currentEbook?.title || 'E-book';
  const author =
    currentEbook?.purchasedFrom ||
    route?.params?.username ||
    currentEbook?.userName ||
    currentEbook?.username ||
    currentEbook?.creator?.name ||
    currentEbook?.creator?.username ||
    currentEbook?.user?.name ||
    currentEbook?.user?.username ||
    userData?.shopName ||
    userData?.shopUsername ||
    userData?.displayName ||
    'Unknown Author';
  const description = getDescription(currentEbook);
  const palette = themeStyles[currentEbook?.theme] || themeStyles.purple;

  const priceLabel = currentEbook?.amount != null ? `$${parseFloat(currentEbook.amount).toFixed(2)}` : 'Free';
  const chapterCount = currentEbook?.tableContent?.length || 4;

  const handleBuyNow = () => {
    navigation.navigate('EbookCheckout', {
      ebook: currentEbook,
      userData,
      loggedInUserId,
    });
  };

  return (
    <View style={[styles.screen, bgStyle]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>E-book Details</Text>
        <Text style={styles.cartBadgeText} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cover Preview */}
        <View style={styles.coverWrapper}>
          <View style={[styles.coverShadow, { shadowColor: accentColor }]}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={[styles.fallbackCover, { backgroundColor: text }]}>
                <Text style={styles.fallbackTitle}>{title}</Text>
                <Text style={styles.fallbackAuthor}>{author.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Ebook Info */}
        <View style={styles.infoWrapper}>
          <Text style={[styles.titleText, textStyle]}>{title}</Text>
          <Text style={styles.authorText}>by {author}</Text>

          {/* Description */}
          <Text style={styles.descriptionText}>{description}</Text>

          {/* Chapters List */}
          {ebook?.tableContent && ebook.tableContent.length > 0 && (
            <View style={styles.chaptersWrapper}>
              <Text style={[styles.chaptersTitle, textStyle]}>Table of Contents</Text>
              {ebook.tableContent.map((ch, idx) => (
                <View key={idx} style={styles.chapterItem}>
                  <Ionicons name="bookmark-outline" size={14} color={accentColor} style={styles.chapterIcon} />
                  <Text style={styles.chapterText}>{idx + 1}. {ch}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="document-text-outline" size={20} color={accentColor} />
              <Text style={styles.statLabel}>Pages</Text>
              <Text style={[styles.statValue, textStyle]}>{chapterCount * 8} approx</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="globe-outline" size={20} color={accentColor} />
              <Text style={styles.statLabel}>Language</Text>
              <Text style={[styles.statValue, textStyle]}>English</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="download-outline" size={20} color={accentColor} />
              <Text style={styles.statLabel}>Format</Text>
              <Text style={[styles.statValue, textStyle]}>PDF</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Purchase Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabelLabel}>Price</Text>
          <Text style={[styles.priceValueText, { color: accentColor }]}>{priceLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.buyBtn, { backgroundColor: accentColor }]}
          onPress={handleBuyNow}
          activeOpacity={0.88}
        >
          <Text style={styles.buyBtnText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default EbookBuyDetailsScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingTop: '10%' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  cartBtn: { padding: 4, position: 'relative' },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  coverWrapper: {
    alignItems: 'center',
    marginVertical: 20,
  },
  coverShadow: {
    width: 200,
    height: 280,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  fallbackCover: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fallbackTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },
  fallbackAuthor: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 20,
  },
  infoWrapper: {
    marginTop: 10,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  authorText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 4,
  },
  reviewsText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 24,
  },
  chaptersWrapper: {
    marginBottom: 24,
  },
  chaptersTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  chapterIcon: {
    marginRight: 8,
  },
  chapterText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E1F3',
    borderRadius: 12,
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  priceContainer: {
    flexDirection: 'column',
  },
  priceLabelLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
  },
  priceValueText: {
    fontSize: 22,
    fontWeight: '900',
  },
  buyBtn: {
    flex: 1,
    marginLeft: 24,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
