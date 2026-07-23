import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Fan Subscriptions intro card (no bitmap image).
 * Left: stacked cards + gold coin. Center: copy. Right: crown.
 * Lavender / gold follows profile accent; bg follows light/dark.
 */
const FanSubscriptionIntroBanner = ({
  accent,
  mutedText,
  isDarkMode,
  isBusinessProfile,
  body1,
  body2,
}) => {
  const bannerBg = isDarkMode
    ? `${accent}18`
    : isBusinessProfile
      ? '#FBF7EF'
      : '#F3ECFA';
  const stackBack = isBusinessProfile
    ? isDarkMode
      ? '#4a3c28'
      : '#E6D2A0'
    : isDarkMode
      ? '#2d2040'
      : '#C9A8E8';
  const stackFront = isBusinessProfile
    ? isDarkMode
      ? '#6a5634'
      : '#D4B878'
    : isDarkMode
      ? '#3f2d58'
      : '#B08AD9';
  const crownBg = isBusinessProfile
    ? isDarkMode
      ? '#5a4a30'
      : '#E8D4A0'
    : isDarkMode
      ? '#4a3568'
      : '#D4C0EC';
  const bodyColor = isDarkMode ? mutedText : '#2A2730';

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: bannerBg,
          borderColor: isDarkMode ? `${accent}40` : `${accent}30`,
        },
      ]}
    >
      {/* Left: stacked cards + $ coin */}
      <View style={styles.side}>
        <View style={styles.leftArt}>
          <View
            style={[
              styles.stackCard,
              styles.stackBack,
              { backgroundColor: stackBack },
            ]}
          />
          <View
            style={[
              styles.stackCard,
              styles.stackFront,
              { backgroundColor: stackFront },
            ]}
          >
            <MaterialCommunityIcons name="crown" size={14} color="#FFFFFF" />
          </View>
          <View style={styles.coin}>
            <Text style={styles.coinText}>$</Text>
          </View>
          <MaterialCommunityIcons
            name="heart"
            size={9}
            color={accent}
            style={[styles.spark, { top: 0, left: 0 }]}
          />
          <MaterialCommunityIcons
            name="star-four-points"
            size={8}
            color={accent}
            style={[styles.spark, { bottom: 10, left: -2 }]}
          />
          <MaterialCommunityIcons
            name="heart"
            size={8}
            color={accent}
            style={[styles.spark, { top: 22, right: -2 }]}
          />
        </View>
      </View>

      {/* Center copy */}
      <View style={styles.copy}>
        <Text style={[styles.body, { color: bodyColor }]}>{body1}</Text>
        <Text style={[styles.body, styles.bodyGap, { color: bodyColor }]}>
          {body2}
        </Text>
      </View>

      {/* Right: crown */}
      <View style={styles.side}>
        <View style={styles.rightArt}>
          <View style={[styles.crownWrap, { backgroundColor: crownBg }]}>
            <MaterialCommunityIcons
              name="crown"
              size={26}
              color={isBusinessProfile ? '#8B6914' : accent}
            />
          </View>
          <MaterialCommunityIcons
            name="heart"
            size={9}
            color={accent}
            style={[styles.spark, { top: -2, right: 2 }]}
          />
          <MaterialCommunityIcons
            name="star-four-points"
            size={8}
            color={accent}
            style={[styles.spark, { bottom: 4, left: 0 }]}
          />
          <MaterialCommunityIcons
            name="heart"
            size={8}
            color={accent}
            style={[styles.spark, { bottom: 12, right: -2 }]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftArt: {
    width: 56,
    height: 62,
    position: 'relative',
  },
  stackCard: {
    position: 'absolute',
    width: 34,
    height: 44,
    borderRadius: 8,
  },
  stackBack: {
    left: 2,
    top: 6,
    transform: [{ rotate: '-14deg' }],
  },
  stackFront: {
    left: 12,
    top: 10,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '8deg' }],
  },
  coin: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E4B84A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  spark: {
    position: 'absolute',
  },
  rightArt: {
    width: 54,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  crownWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '10deg' }],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  body: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  bodyGap: {
    marginTop: 8,
  },
});

export default FanSubscriptionIntroBanner;
