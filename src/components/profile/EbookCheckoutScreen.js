import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Linking, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { getPaymentSessionUrl, STRIPE_BROWSER_OPTIONS } from '../../utils/stripeOnboarding';
import { payMarketplaceEbook } from '../../services/stirpe';
import { formSurfaces, selectedSurface, themedCard } from '../../utils/closetTheme';

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
  const { bgStyle, text, card, border, mutedText, accent, bg } = useAppTheme(userData?.profile);
  const { isDarkMode } = useThemeContext();
  const surfaces = formSurfaces(isDarkMode);
  const brandAccent = accent || '#5A2D82';
  const primaryText = text || (isDarkMode ? '#ffffff' : '#111827');
  const muted = mutedText || surfaces.mutedColor;
  const surface = card || surfaces.listSurface;
  const surfaceBorder = border || surfaces.listBorder;

  const [paying, setPaying] = useState(false);

  const coverImage = getCoverImage(ebook);
  const title = ebook?.caption || ebook?.title || 'E-book';
  const author = ebook?.userName || userData?.displayName || 'Unknown Author';

  const price = Number(ebook?.amount || 0);
  const total = price;

  const handlePay = async () => {
    setPaying(true);
    try {
      const payload = {
        amount: price,
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
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
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

        <View
          style={[
            styles.invoiceSection,
            {
              backgroundColor: isDarkMode ? surfaces.inputSurface : '#FAF9FC',
              borderColor: surfaceBorder,
            },
          ]}
        >
          <View style={styles.invoiceRow}>
            <Text style={[styles.invoiceLabel, { color: muted }]}>Price</Text>
            <Text style={[styles.invoiceValue, { color: primaryText }]}>${price.toFixed(2)}</Text>
          </View>
          <View style={[styles.invoiceRow, styles.totalRow, { borderTopColor: surfaceBorder }]}>
            <Text style={[styles.totalLabel, { color: primaryText }]}>Total</Text>
            <Text style={[styles.totalValue, { color: primaryText }]}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: primaryText }]}>Payment Method</Text>
        <View style={styles.paymentMethods}>
          <View
            style={[
              styles.methodItem,
              themedCard(surface, surfaceBorder),
              {
                borderColor: brandAccent,
                backgroundColor: selectedSurface(brandAccent, isDarkMode),
              },
            ]}
          >
            <View style={styles.methodLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color={brandAccent} />
              <Text style={[styles.methodText, { color: primaryText, fontWeight: '800' }]}>
                Valens Secure Checkout
              </Text>
            </View>
            <View style={[styles.radioCircle, { borderColor: brandAccent }]}>
              <View style={[styles.radioInner, { backgroundColor: brandAccent }]} />
            </View>
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
          style={[styles.payBtn, { backgroundColor: brandAccent }]}
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
          <Ionicons name="lock-closed" size={12} color={muted} />
          <Text style={[styles.securedText, { color: muted }]}> Secured by Valens</Text>
        </View>
      </View>
    </View>
  );
};

export default EbookCheckoutScreen;

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
  content: { padding: 16 },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 24,
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
  invoiceSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  invoiceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  invoiceValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalRow: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
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
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
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
    fontWeight: '600',
  },
});
