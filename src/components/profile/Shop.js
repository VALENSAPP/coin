import React, { memo, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../theme/useApptheme';

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

const Shop = memo(({ isOwnProfile = false, onStartPress, userData }) => {
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme(userData?.profile);
useEffect(() => {
  
}, [userData]);
  const bullets = useMemo(
    () => ['clothes', 'accessories', 'personal items', 'exclusive pieces'],
    [],
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
            <View style={[styles.railIconBubble, { backgroundColor: mixWithWhite(text, 0.9),  marginTop: '200%' }]}>
              <Ionicons name="bag-handle" size={34} color={text} />
            </View>
            {/* <View style={[styles.railMiniBubble, { backgroundColor: mixWithWhite(text, 0.92) }]}>
              <Ionicons name="pricetag" size={18} color={text} />
            </View> */}
          </LinearGradient>

          <View style={styles.cardBody}>
            <Text style={[styles.title, textStyle]}>My Closet 🛍️</Text>
            <Text style={[styles.paragraph, textStyle]}>
              Turn your profile into your personal shop.
            </Text>
            <Text style={[styles.paragraph, textStyle]}>
              With My Closet, you can post items you own and let them go — directly to your followers
              or the Valens community.
            </Text>

            <Text style={[styles.sectionTitle, textStyle]}>Sell:</Text>
            {bullets.map((item) => (
              <Text key={item} style={[styles.bullet, textStyle]}>
                • {item}
              </Text>
            ))}

            <Text style={[styles.paragraph, textStyle]}>Simple, direct, and yours.</Text>
            <Text style={[styles.paragraph, textStyle]}>List it. Share it. Sell it.</Text>
            <Text style={[styles.paragraph, textStyle]}>Your style, your closet.</Text>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleStartPress}
              style={[styles.ctaButton, {backgroundColor: text}]}
            >
                <Text style={styles.ctaText}>Start it now</Text>
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
            <View style={[styles.railIconBubble, { backgroundColor: mixWithWhite(text, 0.9),  marginTop: '65%' }]}>
              <Ionicons name="bag-handle" size={34} color={text} />
            </View>
            {/* <View style={[styles.railMiniBubble, { backgroundColor: mixWithWhite(text, 0.92) }]}>
              <Ionicons name="heart" size={18} color={text} />
            </View> */}
          </LinearGradient>

          <View style={styles.cardBody}>
            <Text style={[styles.title, textStyle]}>My Closet 🛍️</Text>
            <Text style={[styles.paragraph, textStyle]}>
              Here you’ll find the pieces I’ve chosen to let go.
            </Text>
            <Text style={[styles.paragraph, textStyle]}>
              Items I’ve worn, loved, and now share — directly from me to you, made to be worn, loved,
              and lived in again.
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
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default Shop;
