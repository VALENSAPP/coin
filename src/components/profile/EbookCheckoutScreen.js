import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Linking, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { getPaymentSessionUrl, STRIPE_BROWSER_OPTIONS } from '../../utils/stripeOnboarding';
import { payMarketplaceEbook } from '../../services/stirpe';

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

const EbookCheckoutScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { ebook, userData, loggedInUserId } = route.params || {};
  console.log("-----------------ebook------------------",ebook)
  const { bgStyle, textStyle, text } = useAppTheme(userData?.profile);
  const accentColor = text || '#5A2D82';

  const [paying, setPaying] = useState(false);

  const coverImage = getCoverImage(ebook);
  const title = ebook?.caption || ebook?.title || 'E-book';
  const author = ebook?.userName || userData?.displayName || 'Unknown Author';
  const palette = themeStyles[ebook?.theme] || themeStyles.purple;

  const price = Number(ebook?.amount || 0);
  const fee = price * 0.10; // 10% platform fee
  const total = price + fee;

  const handlePay = async () => {
    setPaying(true);
    try {
      const payload = {
        amount: total,
        closetId: ebook?.closetId || ebook?.closet?._id || ebook?.closet?.id || route?.params?.closetId || userData?.closetId || userData?.myClosetId || userData?.closetDetails?.id || userData?.closetDetails?._id,
        ebookId: ebook.id || ebook._id,
      };

      const response = await payMarketplaceEbook(payload);
      const url = getPaymentSessionUrl(response);

      if (!url) {
        Alert.alert('Payment Failed', response?.message || response?.data?.message || 'Failed to create payment session. Please try again.');
        setPaying(false);
        return;
      }

      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(url, { ...STRIPE_BROWSER_OPTIONS, forceCloseOnRedirection: true });
      } else {
        await Linking.openURL(url);
      }

      // Save purchase status locally as fallback/simulated state
      const itemId = ebook.id || ebook._id;
      await AsyncStorage.setItem(`purchased_ebook_${itemId}`, 'true');

      setPaying(false);
      navigation.navigate('EbookPaymentSuccess', {
        ebook,
        userData,
        loggedInUserId,
      });
    } catch (err) {
      console.log('Error executing ebook payment:', err);
      Alert.alert('Payment Error', 'An error occurred during payment processing. Please try again.');
      setPaying(false);
    }
  };

  return (
    <View style={[styles.screen, bgStyle]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
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

        {/* Pricing Breakdown */}
        <View style={styles.invoiceSection}>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>Price</Text>
            <Text style={[styles.invoiceValue, textStyle]}>${price.toFixed(2)}</Text>
          </View>
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>Platform Fee</Text>
            <Text style={[styles.invoiceValue, textStyle]}>${fee.toFixed(2)}</Text>
          </View>
          <View style={[styles.invoiceRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, textStyle]}>Total</Text>
            <Text style={[styles.totalValue, { color: accentColor }]}>${total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <Text style={[styles.sectionTitle, textStyle]}>Payment Method</Text>
        <View style={styles.paymentMethods}>
          {/* Valens Secure Checkout */}
          <View
            style={[styles.methodItem, styles.methodSelected]}
          >
            <View style={styles.methodLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color={accentColor} />
              <Text style={[styles.methodText, styles.methodTextSelected]}>Valens Secure Checkout</Text>
            </View>
            <View style={[styles.radioCircle, { borderColor: accentColor }]}>
              <View style={[styles.radioInner, { backgroundColor: accentColor }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Pay Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.payBtn, { backgroundColor: accentColor }]}
          onPress={handlePay}
          disabled={paying}
          activeOpacity={0.88}
        >
          {paying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>Pay ${total.toFixed(2)}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.securedRow}>
          <Ionicons name="lock-closed" size={12} color="#9ca3af" />
          <Text style={styles.securedText}> Secured by Valens</Text>
        </View>
      </View>
    </View>
  );
};

export default EbookCheckoutScreen;

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
  content: { padding: 16 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E1F3',
    padding: 12,
    marginBottom: 24,
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
  invoiceSection: {
    backgroundColor: '#FAF9FC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  invoiceLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  invoiceValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E8E1F3',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  paymentMethods: {
    gap: 10,
  },
  methodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E1F3',
    backgroundColor: '#fff',
  },
  methodSelected: {
    borderColor: '#111827',
    backgroundColor: '#FAF9FC',
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '600',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  },
  payBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  securedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  securedText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  methodTextSelected: {
    fontWeight: '800',
    color: '#111827',
  },
});
