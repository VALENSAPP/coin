import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useNavigation, useRoute } from '@react-navigation/native';

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

const EbookPaymentSuccessScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { ebook, userData, loggedInUserId } = route.params || {};

  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);
  const accentColor = text || '#5A2D82';

  const coverImage = getCoverImage(ebook);
  const title = ebook?.caption || ebook?.title || 'E-book';
  const author = ebook?.userName || userData?.displayName || 'Unknown Author';
  const palette = themeStyles[ebook?.theme] || themeStyles.purple;

  const price = Number(ebook?.amount || 0);

  const handleGoToLibrary = () => {
    // Navigate directly to EbookDetail so they can read immediately
    navigation.navigate('EbookDetail', {
      ebook,
      userData,
      loggedInUserId,
      username: userData?.userName || userData?.username || ebook?.userName
    });
  };

  const handleContinueShopping = () => {
    // Pop back or navigate back to MyClosetShopFront
    navigation.navigate('ProfileMain', { screen: 'MyClosetStorefront' });
  };

  return (
    <View style={[styles.screen, bgStyle]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleContinueShopping} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>Payment</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Success Icon & Info */}
        <View style={styles.successWrapper}>
          <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
          <Text style={[styles.successTitle, textStyle]}>Payment Successful!</Text>
          <Text style={styles.successSubtitle}>Your e-book has been purchased successfully.</Text>
        </View>

        {/* Ebook Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.coverContainer}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={[styles.fallbackCover, { backgroundColor: palette.bg }]}>
                <Text style={styles.fallbackText}>{title.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.summaryDetails}>
            <Text style={[styles.summaryTitle, textStyle]} numberOfLines={1}>{title}</Text>
            <Text style={styles.summaryAuthor} numberOfLines={1}>by {author}</Text>
            <Text style={[styles.summaryPrice, { color: accentColor }]}>${price.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.libraryBtn, { backgroundColor: accentColor }]}
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
          <Text style={[styles.continueBtnText, { color: accentColor }]}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default EbookPaymentSuccessScreen;

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
  placeholder: { width: 30 },
  content: { padding: 16, alignItems: 'center' },
  successWrapper: {
    alignItems: 'center',
    marginVertical: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E1F3',
    padding: 12,
    width: '100%',
    marginTop: 12,
  },
  coverContainer: {
    width: 60,
    height: 84,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
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
    color: '#111827',
    marginBottom: 4,
  },
  summaryAuthor: {
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#fff',
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
