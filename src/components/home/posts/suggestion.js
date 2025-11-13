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
import Svg, { Defs, ClipPath, Polygon } from 'react-native-svg';
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

  // Hexagon dimensions - MUST MATCH FollowCard exactly
  const cardWidth = 200;
  const cardHeight = 210;
  const hexRadius = 98;
  const centerX = cardWidth / 2;
  const centerY = cardHeight / 2;

  // Flat-top hexagon - EXACT COPY from FollowCard (starts at 0, not PI/6)
  const points = [
    `${centerX + hexRadius * Math.cos(0)},${centerY + hexRadius * Math.sin(0)}`,
    `${centerX + hexRadius * Math.cos(Math.PI / 3)},${centerY + hexRadius * Math.sin(Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(2 * Math.PI / 3)},${centerY + hexRadius * Math.sin(2 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(Math.PI)},${centerY + hexRadius * Math.sin(Math.PI)}`,
    `${centerX + hexRadius * Math.cos(4 * Math.PI / 3)},${centerY + hexRadius * Math.sin(4 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(5 * Math.PI / 3)},${centerY + hexRadius * Math.sin(5 * Math.PI / 3)}`,
  ].join(' ');
    
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Suggested for you</Text>
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
              <View style={[styles.seeMoreContainer, { width: cardWidth, height: cardHeight }]}>
                {/* Hexagon Background */}
                <Svg 
                  width={cardWidth} 
                  height={cardHeight} 
                  style={styles.hexagonBackground}
                >
                  <Defs>
                    <ClipPath id="hexClip-see-more">
                      <Polygon points={points} />
                    </ClipPath>
                  </Defs>

                  <Polygon
                    points={points}
                    fill="#ffffff"
                    stroke="#5a2d82"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                </Svg>

                {/* Content */}
                <TouchableOpacity
                  style={styles.seeMoreContent}
                  onPress={onSeeMore}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#5a2d82" size="large" />
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
  
  // Hexagon "See More" card
  seeMoreContainer: {
    marginRight: 16,
    marginBottom: 20,
    position: 'relative',
    // shadowColor: '#5a2d82',
    // shadowOpacity: 0.15,
    // shadowRadius: 10,
    // shadowOffset: { width: 0, height: 4 },
    // elevation: 5,
  },
  hexagonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  seeMoreContent: {
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
  seeMoreText: {
    color: '#5a2d82',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});