import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, ClipPath, Polygon } from 'react-native-svg';
import HexAvatar from '../story.js/HexAvatar'; // Import your HexAvatar component

export default function FollowCard({
  userId,
  username,
  avatar,
  isFollowing,
  loading,
  onToggle,
  onClose,
  isBusinessProfile,
  executeFollowAction,
  item
}) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigation = useNavigation();
  
  const handleUserProfile = userId => {
    navigation.navigate('UsersProfile', { userId });
  };

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setCurrentUserId(id);
    };
    fetchUserId();
  }, []);

  // Hexagon dimensions for the card
  const cardWidth = 200;
  const cardHeight = 205; // Height adjusted for hexagon shape
  const hexRadius = cardWidth / 2;
  const centerX = cardWidth / 2;
  const centerY = cardHeight / 2;

  // Calculate hexagon points (flat-top orientation)
  const points = [
    `${centerX + hexRadius * Math.cos(0)},${centerY + hexRadius * Math.sin(0)}`,
    `${centerX + hexRadius * Math.cos(Math.PI / 3)},${centerY + hexRadius * Math.sin(Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(2 * Math.PI / 3)},${centerY + hexRadius * Math.sin(2 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(Math.PI)},${centerY + hexRadius * Math.sin(Math.PI)}`,
    `${centerX + hexRadius * Math.cos(4 * Math.PI / 3)},${centerY + hexRadius * Math.sin(4 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(5 * Math.PI / 3)},${centerY + hexRadius * Math.sin(5 * Math.PI / 3)}`,
  ].join(' ');

  return (
    <View style={[styles.cardContainer, { width: cardWidth, height: cardHeight }]}>
      <Svg 
        width={cardWidth} 
        height={cardHeight} 
        style={styles.hexagonBackground}
      >
        <Defs>
          <ClipPath id={`hexClip-card-${userId}`}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>

        {/* Background hexagon with shadow effect */}
        <Polygon
          points={points}
          fill="#fff"
          stroke="#5a2d82"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>

      <View 
        style={styles.card}
        pointerEvents="box-none"
      >
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Hexagonal Avatar */}
        <TouchableOpacity 
          onPress={() => handleUserProfile(userId)}
          style={styles.avatarContainer}
        >
          <HexAvatar
            uri={avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
            size={90}
            borderWidth={3}
            borderColor="#5a2d82"
          />
        </TouchableOpacity>

        {/* Username */}
        <Text style={styles.username} numberOfLines={1}>
          {username}
        </Text>

        {/* Follow Button */}
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.unfollowButton]}
          onPress={() => {
            if (!isBusinessProfile && item.UserId !== currentUserId) {
              if (item.profile === 'company') {
                executeFollowAction(item.UserId, !item.follow);
              } else {
                onToggle?.(item.UserId, !item.follow, item.userTokenAddress);
              }
            }
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.followText}>
              {isBusinessProfile ? "Support" :
                isFollowing ? 'Vallowing' : 'Vallow'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginRight: 16,
    marginBottom: 20,
    position: 'relative',
    // Shadow for the hexagon card
    shadowColor: '#5a2d82',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  hexagonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 25,
    right: 45,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  closeText: {
    fontSize: 14,
    color: '#5a2d82',
    fontWeight: '600',
  },
  avatarContainer: {
    marginTop: 5,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
    maxWidth: 120,
  },
  followButton: {
    backgroundColor: '#5a2d82',
    paddingVertical: 7,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 5,
  },
  unfollowButton: {
    backgroundColor: '#4c2a88b2',
  },
  followText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});