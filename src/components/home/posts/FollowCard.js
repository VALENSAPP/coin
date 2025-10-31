import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';

export default function FollowCard({
  userId,
  username,
  avatar,
  isFollowing,
  loading,
  onToggle,
  onClose,
}) {
  const navigation = useNavigation();
  const handleUserProfile = userId => {
    navigation.navigate('UsersProfile', { userId });
  };

  return (
    <View style={styles.card}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      {/* Avatar */}
      <TouchableOpacity onPress={() => handleUserProfile(userId)}>
        <Image
          source={{
            uri: avatar
              ? avatar
              : 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          }}
          style={styles.avatar}
        />
      </TouchableOpacity>

      {/* Username */}
      <Text style={styles.username} numberOfLines={1}>
        {username}
      </Text>

      {/* Follow Button */}
      <TouchableOpacity
        style={[styles.followButton, isFollowing && styles.unfollowButton]}
        onPress={onToggle}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.followText}>
            {isFollowing ? 'Vallowing' : 'Vallow'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginRight: 16,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#5a2d82',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    // elevation: 5,
    marginBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    // backgroundColor: 'rgba(90,45,130,0.1)',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeText: {
    fontSize: 14,
    color: '#5a2d82',
    fontWeight: '600',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#5a2d82',
    backgroundColor: '#f8f2fd',
    marginBottom: 12,
  },
  username: {
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  followButton: {
    backgroundColor: '#5a2d82',
    paddingVertical: 8,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    // elevation: 3,
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
