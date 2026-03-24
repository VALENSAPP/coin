import React, { useMemo, useRef, useEffect } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../theme/useApptheme';

const DEFAULT_GRADIENT = ['#513189bd', '#e54ba0'];

export default function BattleExploreTabs({
  tabs,
  activeKey,
  onChange,
  highlightKey,
}) {
  const { text } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const list = useMemo(() => tabs ?? [], [tabs]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {list.map(tab => {
        const isActive = tab.key === activeKey;
        const shouldHighlight = tab.key === highlightKey;
        const Wrapper = isActive ? LinearGradient : View;
        const wrapperProps = isActive
          ? { colors: DEFAULT_GRADIENT, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }
          : {};

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange?.(tab.key)}
            activeOpacity={0.85}
            style={styles.tabOuter}
          >
            <Wrapper
              {...wrapperProps}
              style={[
                styles.tab,
                !isActive && { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
              ]}
            >
              <Text style={[styles.tabText, { color: isActive ? '#fff' : text }]} numberOfLines={1}>
                {tab.label}
              </Text>
              {shouldHighlight && (
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                      transform: [
                        {
                          scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }),
                        },
                      ],
                    },
                  ]}
                />
              )}
            </Wrapper>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tabOuter: {
    flexShrink: 0,
  },
  tab: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
});

