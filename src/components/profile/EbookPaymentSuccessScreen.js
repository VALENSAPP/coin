import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { formSurfaces, themedCard } from '../../utils/closetTheme';

const getCoverImage = (item) => {
  if (!item) return null;
  const img = item.images?.[0] || item.image || item.thumbnail;
  if (typeof img === 'string') return img;
  if (img?.uri) return img.uri;
  if (img?.url) return img.url;
  return null;
};

const EbookPaymentSuccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { ebook, userData, loggedInUserId } = route.params || {};

  const { bgStyle, text, card, border, mutedText, accent, bg } = useAppTheme(userData?.profile);
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const brandAccent = accent || '#5A2D82';
  const primaryText = text || (isDarkMode ? '#ffffff' : '#111827');
  const muted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const surfaceBorder = border || surfaces.listBorder;

  const coverImage = getCoverImage(ebook);
  const title = ebook?.caption || ebook?.title || 'E-book';
  const author = ebook?.userName || userData?.displayName || 'Unknown Author';
  const price = Number(ebook?.amount || 0);

  const handleGoToLibrary = () => {
    navigation.navigate('EbookDetail', {
      ebook,
      userData,
      loggedInUserId,
      username: userData?.userName || userData?.username || ebook?.userName,
      sourceScreen: 'AllEbooks',
    });
  };

  const handleContinueShopping = () => {
    navigation.navigate('ProfileMain', { screen: 'MyClosetStorefront' });
  };

  return (
    <View style={[styles.screen, bgStyle]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleContinueShopping} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Payment</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.successWrapper}>
          <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
          <Text style={[styles.successTitle, { color: primaryText }]}>Payment Successful!</Text>
          <Text style={[styles.successSubtitle, { color: muted }]}>
            Your e-book has been purchased successfully.
          </Text>
        </View>

        <View style={[styles.summaryCard, themedCard(surface, surfaceBorder)]}>
          <View style={[styles.coverContainer, { backgroundColor: isDarkMode ? surfaces.inputSurface : '#f3f4f6' }]}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={[styles.fallbackCover, { backgroundColor: brandAccent }]}>
                <Text style={styles.fallbackText}>{title.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.summaryDetails}>
            <Text style={[styles.summaryTitle, { color: primaryText }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.summaryAuthor, { color: muted }]} numberOfLines={1}>by {author}</Text>
            <Text style={[styles.summaryPrice, { color: brandAccent }]}>${price.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: isDarkMode ? bg || '#121212' : '#fff',
            borderTopColor: surfaceBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.libraryBtn, { backgroundColor: brandAccent }]}
          onPress={handleGoToLibrary}
          activeOpacity={0.88}
        >
          <Text style={styles.libraryBtnText}>Go to My Library</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinueShopping}
          activeOpacity={0.7}
        >
          <Text style={[styles.continueBtnText, { color: brandAccent }]}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default EbookPaymentSuccessScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: '10%' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  placeholder: { width: 30 },
  content: { padding: 16, alignItems: 'center' },
  successWrapper: {
    alignItems: 'center',
    marginVertical: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    width: '100%',
    marginTop: 12,
  },
  coverContainer: {
    width: 60,
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  fallbackCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  summaryDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryAuthor: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  summaryPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  libraryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  libraryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  continueBtn: {
    paddingVertical: 8,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
