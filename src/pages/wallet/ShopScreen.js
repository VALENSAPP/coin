import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useLanguage } from '../../i18n';
import { getMyClosetMe } from '../../services/myCloset';

const mixWithWhite = (hex, amount = 0.85) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f3f4f6';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = c => Math.round(c + (255 - c) * amount);
  const toHex = c => mix(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const ShopScreen = ({ navigation, isOwnProfile, userData }) => {
  const [profileType, setProfileType] = useState('company');
  const [displayName, setDisplayName] = useState('');
  const { bgStyle, textStyle, text, cardStyle, accent } = useBusinessProfileTheme();
  const { t } = useLanguage();
  const [shopCheckComplete, setShopCheckComplete] = useState(false);
  const [shopExists, setShopExists] = useState(false);
  const [loggedInUserId, setLoggedInUserId] = useState(null);
  useEffect(() => {
    const loadProfileData = async () => {
      const storedName = await AsyncStorage.getItem('currentUsername');
      if (storedName) setDisplayName(storedName);
    };

    loadProfileData();
  }, []);
  useEffect(() => {
    const loadUser = async () => {
      const userId = await AsyncStorage.getItem('userId');
      setLoggedInUserId(userId);
    };

    loadUser();
  }, []);
  const handleStartShopPress = useCallback(async () => {
    try {
      const response = await getMyClosetMe();
      const data = response?.data || response;
      const exists =
        response?.statusCode === 200 &&
        Boolean(data?.shopName || data?.id || data?.data);

      if (exists) {
        setShopExists(true);
        setShopCheckComplete(true);
        return;
      }
    } catch (error) {
      // If the lookup fails, fall back to the create flow.
    }

    navigation.navigate('ProfileMain', { screen: 'MyClosetCreateShop' });
  }, [navigation]);

  useEffect(() => {
    let isMounted = true;

    const checkShopState = async () => {
      if (!isOwnProfile) {
        if (isMounted) setShopCheckComplete(true);
        return;
      }

      try {
        const response = await getMyClosetMe();
        const data = response?.data || response;
        const exists =
          response?.statusCode === 200 &&
          Boolean(data?.shopName || data?.id || data?.data);

        if (isMounted) {
          setShopExists(exists);
        }
      } catch (error) {
        if (isMounted) {
          setShopExists(false);
        }
      } finally {
        if (isMounted) {
          setShopCheckComplete(true);
        }
      }
    };

    checkShopState();

    return () => {
      isMounted = false;
    };
  }, [isOwnProfile]);
  return (
    <ScrollView
      style={[styles.screen, bgStyle]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.marketingCard,
          cardStyle,
          { borderColor: withAlpha(text, 0.12) },
        ]}
      >
        <LinearGradient
          colors={[withAlpha(text, 0.16), withAlpha(text, 0.06)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.leftRail}
        >
          <View
            style={[
              styles.railIconBubble,
              {
                backgroundColor: mixWithWhite(text, 0.9),
                marginTop: isOwnProfile ? '50%' : '80%',
              },
            ]}
          >
            <Ionicons name="bag-handle" size={34} color={text} />
          </View>
        </LinearGradient>

        <View style={styles.marketingBody}>
          {isOwnProfile || loggedInUserId ? (
            <>
              <Text style={[styles.marketingTitle, textStyle]}>
                {displayName
                  ? `${displayName} ${t('shop.title')}`
                  : t('shop.title')}
              </Text>

              <Text style={[styles.marketingText, textStyle]}>
                {t('shop.welcome')}
              </Text>

              <Text style={[styles.marketingText, textStyle]}>
                {t('shop.description')}
              </Text>

              <TouchableOpacity
                activeOpacity={0.9}
                // onPress={() =>
                //   navigation.navigate('ProfileMain', {
                //     screen: 'MyClosetCreateShop',
                //   })
                // }
                onPress={handleStartShopPress}
                style={[styles.ctaButton, { backgroundColor: text }]}
              >
                <Text style={styles.ctaText}>
                  {t('shop.ctaButton')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.marketingTitle, textStyle]}>
                {(userData?.displayName ||
                  userData?.userName ||
                  t('privateContent.businessFallback'))}{' '}
                {t('privateContent.shopSuffix')}
              </Text>

              <Text style={[styles.marketingText, textStyle]}>
                {t('privateContent.shopGuestWelcome')}
              </Text>

              <Text style={[styles.marketingText, textStyle]}>
                {t('privateContent.shopGuestDescription')}
              </Text>

              <TouchableOpacity
                activeOpacity={0.9}
                // onPress={onSubscribePress}
                style={[styles.ctaButton, { backgroundColor: text }]}
              >
                <Text style={styles.ctaText}>
                  {t('privateContent.shopNowButton')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    // justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 24,
  },
  marketingCard: {
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    flexDirection: 'row',
  },
  leftRail: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railIconBubble: {
    height: 58,
    width: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketingBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  marketingTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  marketingText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  ctaButton: {
    borderRadius: 18,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default ShopScreen;
