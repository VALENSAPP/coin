import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { normalizeProfileType } from '../../utils/supportEligibility';
import { useLanguage } from '../../i18n';

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const ShopScreen = ({ navigation, isOwnProfile, userData }) => {
  const [displayName, setDisplayName] = useState('');
  const profileThemeType =
    normalizeProfileType(userData?.profile) === 'company' ? 'company' : undefined;
  const { bgStyle, textStyle, text, cardStyle, accent } = useAppTheme(profileThemeType);
  const { t } = useLanguage();

  useEffect(() => {
    const loadProfileData = async () => {
      const storedName = await AsyncStorage.getItem('currentUsername');
      if (storedName) setDisplayName(storedName);
    };

    loadProfileData();
  }, []);
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
                backgroundColor: withAlpha(accent, 0.18),
                marginTop: isOwnProfile ? '50%' : '80%',
              },
            ]}
          >
            <Ionicons name="bag-handle" size={34} color={accent} />
          </View>
        </LinearGradient>

        <View style={styles.marketingBody}>
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
            onPress={() =>
              navigation.navigate('ProfileMain', {
                screen: 'MyClosetCreateShop',
              })
            }
            style={[styles.ctaButton, { backgroundColor: text }]}
          >
            <Text style={styles.ctaText}>{t('shop.ctaButton')}</Text>
          </TouchableOpacity>
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
