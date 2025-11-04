// suggestion.js
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import FollowCard from './FollowCard';

export default function Suggestion({
  users = [],
  onToggleFollow,
  busyIds,
  onDismiss,
  onSeeMore,
  hasMore,
  isLoading = false,
  isBusinessProfile,
  executeFollowAction
}) {
  const data = hasMore
    ? [...users, { id: '__see_more__', username: 'See more' }]
    : users;
    
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Suggested for you</Text>
        {/* <Text style={styles.subtitle}>({users.length} users)</Text> */}
      </View>

      <FlatList
        horizontal
        data={data}
        keyExtractor={(u, i) => String(u?.id ?? `sugg-${i}`)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        renderItem={({ item }) => {
          if (item.id === '__see_more__') {
            return (
              <View style={styles.cardLike}>
                <TouchableOpacity
                  style={styles.seeMoreButton}
                  onPress={onSeeMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#5a2d82" />
                  ) : (
                    <Text style={styles.seeMoreText}>See more</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }
          const following =
            item.isFollow ?? item.isFollowing ?? item.following ?? false;

          return (
            <FollowCard
              userId={item.id}
              username={item.username || 'Unknown'}
              avatar={item.avatar || undefined}
              isFollowing={!!following}
              loading={busyIds.has(String(item.id))}
              onToggle={() => onToggleFollow(item.id, !following)}
              onClose={() => onDismiss(item.id)}
              item={item}
              isBusinessProfile={isBusinessProfile}
              executeFollowAction={executeFollowAction}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    color: '#5a2d82',
    fontSize: 18,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
  },

  // Card-like container (same as FollowCard base)
  cardLike: {
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5a2d82',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 20,
  },

  seeMoreButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  seeMoreText: {
    color: '#5a2d82',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});