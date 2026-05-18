import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const PRIMARY_GRADIENT = ['#513189bd', '#e54ba0'];

export default function ProfileBattleTab({ isLive = false, battle: battleProp }) {
  const { text } = useAppTheme();
  const { t } = useLanguage();
  const [selectedOption, setSelectedOption] = useState(null);

  const battle = useMemo(
    () =>
      battleProp ?? {
        type: t('battleTab.defaultType'),
        title: t('battleTab.defaultTitle'),
        subtitle: t('battleTab.defaultSubtitle'),
        options: [
          { key: 'a', label: t('battleTab.defaultOptionA') },
          { key: 'b', label: t('battleTab.defaultOptionB') },
        ],
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [battleProp],
    // Note: intentionally excluding `t` so the fallback labels only resolve
    // once on mount, matching the original single-memo behaviour. If your app
    // needs live language switching for the fallback, add `t` to the deps array.
  );

  if (!isLive) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="radio-outline" size={36} color="#9CA3AF" />
        <Text style={[styles.emptyTitle, { color: text }]}>{t('battleTab.noLiveTitle')}</Text>
        <Text style={styles.emptySub}>{t('battleTab.noLiveSub')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <LinearGradient
          colors={PRIMARY_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.livePill}
        >
          <Text style={styles.livePillText}>{t('battleTab.livePill')}</Text>
        </LinearGradient>
        <Text style={[styles.typeText, { color: text }]}>
          {battle.type} {t('battleTab.battleLabel')}
        </Text>
      </View>

      <Text style={[styles.title, { color: text }]}>{battle.title}</Text>
      {!!battle.subtitle && <Text style={styles.subtitle}>{battle.subtitle}</Text>}

      <View style={styles.options}>
        {battle.options.map((option) => {
          const isSelected = selectedOption === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              activeOpacity={0.9}
              onPress={() => setSelectedOption(option.key)}
              style={[styles.optionBtn, isSelected && styles.optionBtnSelected]}
            >
              <Text
                style={[styles.optionText, isSelected && styles.optionTextSelected]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {isSelected && <Ionicons name="checkmark-circle" size={18} color="#22C55E" />}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (!selectedOption) {
            Alert.alert(t('battleTab.selectOptionTitle'), t('battleTab.selectOptionMessage'));
            return;
          }
          Alert.alert(t('battleTab.voteSuccessTitle'), t('battleTab.voteSuccessMessage'));
        }}
      >
        <LinearGradient
          colors={PRIMARY_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.voteBtn}
        >
          <Text style={styles.voteBtnText}>{t('battleTab.voteButton')}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  container: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  livePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  livePillText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
    fontSize: 11,
  },
  typeText: {
    fontWeight: '800',
    fontSize: 13,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  options: {
    marginTop: 14,
    gap: 10,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  optionBtnSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    marginRight: 10,
  },
  optionTextSelected: {
    color: '#166534',
  },
  voteBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  voteBtnText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
