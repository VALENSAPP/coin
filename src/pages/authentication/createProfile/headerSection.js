import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme/useApptheme';
import { useThemeContext } from '../../../theme/ThemeContext';

const { width } = Dimensions.get('window');

export default function StepHeader({ currentStep }) {
  const { t } = useLanguage();
  const { border, mutedText, accent } = useAppTheme();
  const { isDarkMode } = useThemeContext();

  const ui = useMemo(() => ({
    labelColor: isDarkMode ? '#ffffff' : '#111827',
    upcomingColor: mutedText,
    completeBg: isDarkMode ? accent : '#000000',
    currentBorder: isDarkMode ? accent : '#000000',
    currentBg: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff',
    upcomingCircleBg: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
    currentNumberColor: isDarkMode ? '#ffffff' : '#000000',
  }), [isDarkMode, mutedText, accent]);

  const steps = [
    t('stepHeader.email'),
    t('stepHeader.profile'),
    t('stepHeader.kyc'),
    t('stepHeader.wallet'),
  ];

  return (
    <View style={styles.stepsRow}>
      {steps.map((label, index) => {
        const status =
          index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        return (
          <View key={index} style={styles.stepItemWrapper}>
            <View style={styles.stepContainer}>
              <View
                style={[
                  styles.circleSmall,
                  status === 'upcoming' && { backgroundColor: ui.upcomingCircleBg },
                  status === 'complete' && { backgroundColor: ui.completeBg },
                  status === 'current' && {
                    borderWidth: 2,
                    borderColor: ui.currentBorder,
                    backgroundColor: ui.currentBg,
                  },
                ]}
              >
                {status === 'complete' ? (
                  <Icon name="check" size={16} color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      { color: status === 'current' ? ui.currentNumberColor : ui.upcomingColor },
                      status === 'current' && styles.textCurrent,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: status === 'current' ? ui.labelColor : ui.upcomingColor },
                  status === 'current' && styles.labelCurrent,
                ]}
              >
                {label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View style={[styles.stepDivider, { backgroundColor: border }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: width - 32,
    marginVertical: 24,
  },
  stepItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepDivider: {
    height: 1,
    width: 16,
    marginHorizontal: 8,
  },
  circleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 14,
  },
  textCurrent: {
    fontWeight: '600',
  },
  stepLabel: {
    marginTop: 4,
    fontSize: 11,
  },
  labelCurrent: {
    fontWeight: '600',
  },
});
