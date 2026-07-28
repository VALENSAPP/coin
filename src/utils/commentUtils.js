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
 * @param {object} [styles] - Optional style overrides + press handlers:
 *   { hashtag, mention, plain, onMentionPress, onHashtagPress }
 * @returns {React.ReactNode[]}
 */
export function parseText(text, styles = {}) {
  const hashtagStyle = styles.hashtag ?? { color: '#385898' };
  const mentionStyle = styles.mention ?? { color: '#00376b' };
  const plainStyle = styles.plain;
  const { onMentionPress, onHashtagPress } = styles;

  return String(text || '')
    .split(/([#@][\w.]+)/g)
    .map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <Text
            key={i}
            style={hashtagStyle}
            suppressHighlighting
            onPress={onHashtagPress ? () => onHashtagPress(part) : undefined}
          >
            {part}
          </Text>
        );
      }
      if (part.startsWith('@')) {
        return (
          <Text
            key={i}
            style={mentionStyle}
            suppressHighlighting
            onPress={onMentionPress ? () => onMentionPress(part) : undefined}
          >
            {part}
          </Text>
        );
      }
      return (
        <Text key={i} style={plainStyle}>
          {part}
        </Text>
      );
    });
}
