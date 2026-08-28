// components/NotificationToast.js
import React, { useEffect, useRef } from 'react';
import {
  Animated, TouchableOpacity, View, Text, Image,
  StyleSheet, PanResponder, Modal, Pressable, ScrollView,
} from 'react-native';

const CATEGORY_CONFIG = {
  NEW_FOLLOWER: {
    icon: '👤',
    accentColor: '#7C4DFF',
  },
  LIKE: {
    icon: '❤️',
    accentColor: '#FF4D6D',
  },
  COMMENT: {
    icon: '💬',
    accentColor: '#00B4D8',
  },
  DEFAULT: {
    icon: '🔔',
    accentColor: '#7C4DFF',
  },
};

export default function NotificationToast({ notification, onDismiss, onAction }) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const data = notification?.data || {};
  const notif = notification?.notification || {};
  const category = data?.notificationCategory || data?.category || 'DEFAULT';
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.DEFAULT;
  const title = notif?.title || data?.expandedTitle || data?.big_title || 'Notification';
  const body = notif?.body || '';
  const expandedText = data?.big_text || data?.expandedBody || body;
  const subtitle = data?.subtitle || notif?.ios?.subtitle;
  const imageUrl = data?.image_url || notif?.android?.imageUrl;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();
  }, [opacity, translateY]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 80,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss?.());
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 50) {
          dismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>
      <View style={styles.modalRoot}>
        <Animated.View
          style={[styles.container, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={[styles.accentBar, { backgroundColor: config.accentColor }]} />

          <View style={styles.headerRow}>
            {data?.followerImage ? (
              <Image source={{ uri: data.followerImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: config.accentColor }]}>
                <Text style={styles.avatarIcon}>{config.icon}</Text>
              </View>
            )}

            <View style={styles.textBlock}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
              ) : null}
              {body ? (
                <Text style={styles.body} numberOfLines={2}>
                  {body}
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.expandedSection,
              imageUrl ? styles.expandedSectionWithImage : styles.expandedSectionTextOnly,
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.expandedInner}
              showsVerticalScrollIndicator={false}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.expandedImage} />
              ) : null}

              {expandedText && expandedText !== body ? (
                <Text style={styles.expandedText}>{expandedText}</Text>
              ) : null}

              {(data?.totalFollowers || data?.accuracyRate) && (
                <View style={styles.statsRow}>
                  {data?.totalFollowers && (
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{data.totalFollowers}</Text>
                      <Text style={styles.statLabel}>Followers</Text>
                    </View>
                  )}
                  {data?.accuracyRate && (
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{data.accuracyRate}%</Text>
                      <Text style={styles.statLabel}>Accuracy</Text>
                    </View>
                  )}
                </View>
              )}

              {(data?.primaryAction || data?.secondaryAction) && (
                <View style={styles.actionsRow}>
                  {data?.primaryAction && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: config.accentColor }]}
                      onPress={() => { onAction?.(data.primaryAction, data); dismiss(); }}
                    >
                      <Text style={styles.actionBtnText}>
                        {data.primaryAction === 'VIEW_PROFILE' ? 'View Profile' : data.primaryAction}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {data?.secondaryAction && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: config.accentColor }]}
                      onPress={() => { onAction?.(data.secondaryAction, data); dismiss(); }}
                    >
                      <Text style={[styles.actionBtnText, { color: config.accentColor }]}>
                        {data.secondaryAction === 'FOLLOW_BACK' ? 'Follow Back' : data.secondaryAction}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: '#1E1B2E',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#7C4DFF',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 20 },
  textBlock: { flex: 1 },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  body: {
    color: '#A09BC0',
    fontSize: 13,
  },
  expandedText: {
    color: '#D6D1F0',
    fontSize: 13,
    lineHeight: 19,
  },
  subtitle: {
    color: '#D6D1F0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  expandedSection: {
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  expandedSectionTextOnly: {
    height: 180,
  },
  expandedSectionWithImage: {
    height: 340,
  },
  expandedInner: {
    paddingTop: 4,
    paddingBottom: 14,
    gap: 12,
  },
  expandedImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: '#151222',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    paddingLeft: 56, // align under text
  },
  stat: { alignItems: 'flex-start' },
  statValue: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  statLabel: {
    color: '#A09BC0',
    fontSize: 11,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingLeft: 56,
  },
  actionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: {
    color: '#A09BC0',
    fontWeight: '600',
    fontSize: 13,
  },
});
