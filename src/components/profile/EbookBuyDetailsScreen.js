import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getMarketplaceEbookById } from '../../services/post';
import { formSurfaces, themedCard } from '../../utils/closetTheme';

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

  const { bgStyle, text, card, border, mutedText, accent, bg } = useAppTheme(userData?.profile);
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const brandAccent = accent || '#5A2D82';
  const primaryText = text || (isDarkMode ? '#ffffff' : '#111827');
  const muted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const surfaceBorder = border || surfaces.listBorder;

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
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>E-book Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrapper}>
          <View style={[styles.coverShadow, { shadowColor: brandAccent, backgroundColor: surface }]}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={[styles.fallbackCover, { backgroundColor: brandAccent }]}>
                <Text style={styles.fallbackTitle}>{title}</Text>
                <Text style={styles.fallbackAuthor}>{author.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.infoWrapper}>
          <Text style={[styles.titleText, { color: primaryText }]}>{title}</Text>
          <Text style={[styles.authorText, { color: muted }]}>by {author}</Text>
          <Text style={[styles.descriptionText, { color: muted }]}>{description}</Text>

          {ebook?.tableContent && ebook.tableContent.length > 0 && (
            <View style={styles.chaptersWrapper}>
              <Text style={[styles.chaptersTitle, { color: primaryText }]}>Table of Contents</Text>
              {ebook.tableContent.map((ch, idx) => (
                <View key={idx} style={styles.chapterItem}>
                  <Ionicons name="bookmark-outline" size={14} color={brandAccent} style={styles.chapterIcon} />
                  <Text style={[styles.chapterText, { color: muted }]}>{idx + 1}. {ch}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statCard, themedCard(surface, surfaceBorder)]}>
              <Ionicons name="document-text-outline" size={20} color={brandAccent} />
              <Text style={[styles.statLabel, { color: muted }]}>Pages</Text>
              <Text style={[styles.statValue, { color: primaryText }]}>{chapterCount * 8} approx</Text>
            </View>
            <View style={[styles.statCard, themedCard(surface, surfaceBorder)]}>
              <Ionicons name="globe-outline" size={20} color={brandAccent} />
              <Text style={[styles.statLabel, { color: muted }]}>Language</Text>
              <Text style={[styles.statValue, { color: primaryText }]}>English</Text>
            </View>
            <View style={[styles.statCard, themedCard(surface, surfaceBorder)]}>
              <Ionicons name="download-outline" size={20} color={brandAccent} />
              <Text style={[styles.statLabel, { color: muted }]}>Format</Text>
              <Text style={[styles.statValue, { color: primaryText }]}>PDF</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: isDarkMode ? bg || '#121212' : '#fff',
            borderTopColor: surfaceBorder,
          },
        ]}
      >
        <View style={styles.priceContainer}>
          <Text style={[styles.priceLabelLabel, { color: muted }]}>Price</Text>
          <Text style={[styles.priceValueText, { color: primaryText }]}>{priceLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.buyBtn, { backgroundColor: brandAccent }]}
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
  screen: { flex: 1, paddingTop: '10%' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4, width: 30 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSpacer: { width: 30 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  coverWrapper: {
    alignItems: 'center',
    marginVertical: 20,
  },
  coverShadow: {
    width: 200,
    height: 280,
    borderRadius: 16,
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
    marginBottom: 4,
  },
  authorText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  chaptersWrapper: {
    marginBottom: 24,
  },
  chaptersTitle: {
    fontSize: 16,
    fontWeight: '800',
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
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    borderTopWidth: 1,
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
