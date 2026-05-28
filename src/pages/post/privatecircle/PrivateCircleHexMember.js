import React from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HexAvatar from '../../../components/home/story.js/HexAvatar';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function PrivateCircleHexMember({
  member,
  size = 76,
  selected = false,
  accentColor = '#513189',
  empty = false,
}) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {empty ? (
        <View style={[styles.emptyHex, { width: size, height: size, borderColor: '#E5E7EB' }]}>
          <Ionicons name="person-outline" size={size * 0.36} color="#C4C4C4" />
        </View>
      ) : (
        <HexAvatar
          uri={member?.avatar || DEFAULT_AVATAR}
          size={size}
          borderWidth={2}
          borderColor="#E5E7EB"
        />
      )}
      {selected && !empty && (
        <View style={[styles.badge, { backgroundColor: accentColor }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHex: {
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    transform: [{ rotate: '0deg' }],
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
