import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0'];

export default function OpenBattleScreen() {
  const navigation = useNavigation();
  const { bgStyle, text } = useAppTheme();
  const [selectedFormat, setSelectedFormat] = useState('poll');

  const formatOptions = useMemo(
    () => [
      {
        key: 'poll',
        title: 'Battle Poll',
        subtitle: 'Just create your question',
      },
      {
        key: 'duel',
        title: 'Head-to-Head Duel',
        subtitle: '1 vs 1 Challenge',
      },
    ],
    [],
  );

  const steps = useMemo(
    () => [
      { title: 'Choose your Format' },
      { title: 'Define Your Question', subtitle: 'Write a clear question' },
      { title: 'Set Battle Rules', subtitle: 'Duration, resolution & rewards' },
      { title: 'Set the Stake (Optional)', subtitle: 'Points, reputation or credits' },
      { title: 'Publish Your Battle', subtitle: 'Make it live and invite others' },
      { title: 'Battle Resolution', subtitle: 'Verify outcome & score' },
      { title: 'See Results & Rewards', subtitle: 'Check winners & leaderboards' },
    ],
    [],
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          style={styles.headerIconBtn}
        >
          <Ionicons name="chevron-back" size={24} color={text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: text }]}>How to Create a Battle</Text>

        <TouchableOpacity
          onPress={() => Alert.alert('Info', 'Battle creation guide.')}
          accessibilityRole="button"
          style={styles.headerIconBtn}
        >
          <Ionicons name="help-circle-outline" size={22} color={text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.illustration}>
            <Ionicons name="trophy-outline" size={32} color="#7C3AED" />
          </View>
          <Text style={[styles.heroText, { color: text }]}>
            Start a skill-based challenge on Valens!
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: text }]}>1. Choose your Format</Text>
          <View style={styles.formatRow}>
            {formatOptions.map(option => {
              const isSelected = selectedFormat === option.key;
              const Wrapper = isSelected ? LinearGradient : View;
              const wrapperProps = isSelected
                ? { colors: PRIMARY_GRADIENT, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }
                : {};

              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.formatCell}
                  activeOpacity={0.85}
                  onPress={() => setSelectedFormat(option.key)}
                >
                  <Wrapper
                    {...wrapperProps}
                    style={[
                      styles.formatCard,
                      !isSelected && { backgroundColor: '#EEF2FF', borderColor: '#D1D5DB' },
                    ]}
                  >
                    <Text style={[styles.formatTitle, { color: isSelected ? '#fff' : '#111827' }]}>
                      {option.title}
                    </Text>
                    <Text
                      style={[styles.formatSubtitle, { color: isSelected ? '#F3F4F6' : '#6B7280' }]}
                      numberOfLines={1}
                    >
                      {option.subtitle}
                    </Text>
                  </Wrapper>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.steps}>
          {steps.slice(1).map((step, idx) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{idx + 2}.</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={[styles.stepTitle, { color: text }]}>{step.title}</Text>
                {!!step.subtitle && <Text style={styles.stepSubtitle}>{step.subtitle}</Text>}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footerHint}>Turn opinions into smart competitions!</Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => Alert.alert('Coming soon', 'Create Battle flow will be added next.')}
        >
          <LinearGradient
            colors={PRIMARY_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createBtn}
          >
            <Text style={styles.createBtnText}>CREATE BATTLE</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  illustration: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  section: {
    marginTop: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatCell: {
    flex: 1,
    minWidth: 0,
  },
  formatCard: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  formatTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  formatSubtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  steps: {
    marginTop: 5,
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop:10
  },
  stepIndex: {
    width: 24,
    alignItems: 'flex-end',
    paddingTop: 1,
  },
  stepIndexText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerHint: {
    marginTop: 14,
    textAlign: 'center',
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 12,
  },
  bottomBar: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    marginBottom:'20%'
  },
  createBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
  },
});

