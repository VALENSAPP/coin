import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { getMyClosetMe } from '../../services/myCloset';

const mixWithWhite = (hex, amount = 0.85) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f3f4f6';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const toHex = (c) => mix(c).toString(16).padStart(2, '0');
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

const Shop = memo(({ isOwnProfile = false, userData, onStartPress }) => {
  const { bgStyle, textStyle, text, cardStyle, accent } = useAppTheme(userData?.profile);
  const navigation = useNavigation();
  const { t } = useLanguage();
  const [hasCloset, setHasCloset] = useState(false);
  const [checkedCloset, setCheckedCloset] = useState(!isOwnProfile);

  useEffect(() => { }, [userData]);

  useEffect(() => {
    let isMounted = true;

    const checkCloset = async () => {
      if (!isOwnProfile) {
        if (isMounted) setCheckedCloset(true);
        return;
      }

      try {
        const response = await getMyClosetMe();
        const closetData = response?.data || response;
        const exists =
          response?.statusCode === 200 &&
          Boolean(closetData?.data || closetData?.shopName || closetData?.id);

        if (isMounted) {
          setHasCloset(exists);
        }
      } catch (error) {
        if (isMounted) {
          setHasCloset(false);
        }
      } finally {
        if (isMounted) {
          setCheckedCloset(true);
        }
      }
    };

    checkCloset();

    return () => {
      isMounted = false;
    };
  }, [isOwnProfile]);

  const bullets = useMemo(
    () => [
      t('shopComponent.bulletClothes'),
      t('shopComponent.bulletAccessories'),
      t('shopComponent.bulletPersonalItems'),
      t('shopComponent.bulletExclusivePieces'),
    ],
    [t],
  );

  const handleStartPress = async () => {
    if (typeof onStartPress === 'function') {
      onStartPress();
      return;
    }

    try {
      const response = await getMyClosetMe();
      const closetData = response?.data || response;
      const exists =
        response?.statusCode === 200 &&
        Boolean(closetData?.data || closetData?.shopName || closetData?.id);

      if (exists) {
        setHasCloset(true);
        setCheckedCloset(true);
        return;
      }
    } catch (error) {
      // Fall back to the create flow if the lookup fails.
    }

    navigation.navigate('ProfileMain', {
      screen: 'MyClosetCreateShop',
    });
  };

  return (
    <ScrollView
      style={[styles.container, bgStyle]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {isOwnProfile ? (
        <View style={[styles.card, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
          <LinearGradient
            colors={[withAlpha(text, 0.16), withAlpha(text, 0.06)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.leftRail}
          >
            <View style={[styles.railIconBubble, { backgroundColor: withAlpha(accent, 0.18), marginTop: '200%' }]}>
              <Ionicons name="bag-handle" size={34} color={accent} />
            </View>
          </LinearGradient>

          <View style={styles.cardBody}>
            <Text style={[styles.title, textStyle]}>{t('shopComponent.ownTitle')}</Text>
            <Text style={[styles.paragraph, textStyle]}>
              {t('shopComponent.ownTagline')}
            </Text>
            <Text style={[styles.paragraph, textStyle]}>
              {t('shopComponent.ownDescription')}
            </Text>

            <Text style={[styles.sectionTitle, textStyle]}>{t('shopComponent.sellLabel')}</Text>
            {bullets.map((item) => (
              <Text key={item} style={[styles.bullet, textStyle]}>
                • {item}
              </Text>
            ))}

            <Text style={[styles.paragraph, textStyle]}>{t('shopComponent.ownSimple')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('shopComponent.ownListIt')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('shopComponent.ownYourStyle')}</Text>

            {!checkedCloset || hasCloset ? null : (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleStartPress}
                style={[styles.ctaButton, { backgroundColor: accent }]}
              >
                <Text style={styles.ctaText}>{t('shopComponent.startNowButton')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.card, cardStyle, { borderColor: withAlpha(text, 0.12) }]}>
          <LinearGradient
            colors={[withAlpha(text, 0.16), withAlpha(text, 0.06)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.leftRail}
          >
            <View style={[styles.railIconBubble, { backgroundColor: withAlpha(accent, 0.18), marginTop: '35%' }]}>
              <Ionicons name="bag-handle" size={34} color={accent} />
            </View>
          </LinearGradient>

          <View style={styles.cardBody}>
            <Text style={[styles.title, textStyle]}>{t('shopComponent.guestTitle')}</Text>
            <Text style={[styles.paragraph, textStyle]}>
              {t('shopComponent.guestIntro')}
            </Text>
            <Text style={[styles.paragraph, textStyle]}>
              {t('shopComponent.guestDescription')}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 40,
  },
  card: {
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
    justifyContent: 'space-between',
  },
  railIconBubble: {
    height: 58,
    width: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railMiniBubble: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    // justifyContent: 'space-between',
    flexShrink: 1, // ✅ important
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 12,
    lineHeight: 14,
    marginBottom: 10,
    flexShrink: 1,     // ✅ important
    flexWrap: 'wrap',  // ✅ ensures wrapping
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 12,
    textAlign: 'left',
    lineHeight: 14,
    marginBottom: 4,
  },
  ctaButton: {
    borderRadius: 18,
    alignItems: 'center',
    minHeight: 40, // ✅ ensures full visibility
    justifyContent: 'center',
    marginTop: 8
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default Shop;
