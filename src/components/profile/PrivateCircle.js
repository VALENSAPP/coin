import React, { memo, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

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

const PrivateCircle = memo(({ isOwnProfile = false, onStartPress, userData }) => {
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme(userData?.profile);
  const { t } = useLanguage();

  useEffect(() => {
    console.log(userData);
  }, [userData]);

  const bullets = useMemo(
    () => [
      t('privateCircle.bulletCloseFriends'),
      t('privateCircle.bulletImportantMoments'),
      t('privateCircle.bulletVipFollowers'),
      t('privateCircle.bulletPrivateUpdates'),
    ],
    [t],
  );

  const handleStartPress = () => {
    if (typeof onStartPress === 'function') onStartPress();
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
            <View style={[styles.railIconBubble, { backgroundColor: mixWithWhite(text, 0.9), marginTop: '200%' }]}>
              <Ionicons name="lock-closed" size={34} color={text} />
            </View>
          </LinearGradient>

          <View style={styles.cardBody}>
            <Text style={[styles.title, textStyle]}>{t('privateCircle.ownTitle')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownComingSoon')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownChoose')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownDescription')}</Text>

            <Text style={[styles.sectionTitle, textStyle]}>{t('privateCircle.perfectFor')}</Text>
            {bullets.map((item) => (
              <Text key={item} style={[styles.bullet, textStyle]}>
                • {item}
              </Text>
            ))}

            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownYourSpace')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.ownComingSoonProfile')}</Text>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleStartPress}
              style={[styles.ctaButton, { backgroundColor: text }]}
            >
              <Text style={styles.ctaText}>{t('privateCircle.startNowButton')}</Text>
            </TouchableOpacity>
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
            <View style={[styles.railIconBubble, { backgroundColor: mixWithWhite(text, 0.9), marginTop: '100%' }]}>
              <Ionicons name="lock-closed" size={34} color={text} />
            </View>
          </LinearGradient>

          <View style={styles.cardBody}>
            <Text style={[styles.title, textStyle]}>{t('privateCircle.guestTitle')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestNotPublic')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestNeedInvite')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestAudience')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestInviteOnly')}</Text>
            <Text style={[styles.paragraph, textStyle]}>{t('privateCircle.guestStayConnected')}</Text>
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
    // paddingTop: 16,
    // paddingBottom: 14,
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
    paddingHorizontal: 15,
    paddingVertical: 14,
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
  ctaGradient: {
    // paddingVertical: 12,
    // paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    minHeight: 40, // ✅ ensures full visibility
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default PrivateCircle;
