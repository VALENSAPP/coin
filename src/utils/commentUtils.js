import React from 'react';
import { Text } from 'react-native';

/**
 * Returns a human-readable relative time string (e.g. "5m ago", "2h ago").
 * @param {number} ts - Timestamp in milliseconds
 * @returns {string}
 */
export function getTimeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return 'now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

/**
 * Splits text by hashtags (#word) and mentions (@word) and returns an array of Text elements.
 * Used for consistent comment/reply display across CommentItem and ReplyItem.
 * @param {string} text - Raw comment text
 * @param {object} [styles] - Optional style overrides: { hashtag, mention, plain }
 * @returns {React.ReactNode[]}
 */
export function parseText(text, styles = {}) {
  const hashtagStyle = styles.hashtag ?? { color: '#385898' };
  const mentionStyle = styles.mention ?? { color: '#00376b' };
  return text.split(/([#@][\w_]+)/g).map((part, i) =>
    part.startsWith('#') ? (
      <Text key={i} style={hashtagStyle}>{part}</Text>
    ) : part.startsWith('@') ? (
      <Text key={i} style={mentionStyle}>{part}</Text>
    ) : (
      <Text key={i}>{part}</Text>
    )
  );
}
