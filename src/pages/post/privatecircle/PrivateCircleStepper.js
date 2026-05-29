import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../../i18n';

const PURPLE = '#513189';
const GREY = '#9CA3AF';
const LINE_GREY = '#E5E7EB';

const STEPS = [
  { icon: 'person', labelKey: 'privateCircleMint.stepWelcome' },
  { icon: 'person-add-outline', labelKey: 'privateCircleMint.stepInvite' },
  { icon: 'people-outline', labelKey: 'privateCircleMint.stepSelect' },
  { icon: 'people', labelKey: 'privateCircleMint.stepReview' },
  { icon: 'checkmark', labelKey: 'privateCircleMint.stepCreate' },
];

export default function PrivateCircleStepper({ currentStep = 0, accentColor = PURPLE }) {
  const { t } = useLanguage();

  const labels = useMemo(() => STEPS.map((step) => t(step.labelKey)), [t]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.trackRow}>
        <View style={styles.line} />
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <View key={step.labelKey} style={styles.stepCol}>
              <View
                style={[
                  styles.iconCircle,
                  isActive && [styles.iconCircleActive, { backgroundColor: accentColor }],
                  !isActive && !isComplete && styles.iconCircleInactive,
                  isComplete && [styles.iconCircleComplete, { backgroundColor: accentColor }],
                ]}
              >
                <Ionicons
                  name={isComplete ? 'checkmark' : step.icon}
                  size={14}
                  color={isActive || isComplete ? '#fff' : GREY}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labelRow}>
        {labels.map((label, index) => {
          const isActive = index === currentStep;
          return (
            <Text
              key={STEPS[index].labelKey}
              style={[styles.label, isActive && { color: accentColor, fontWeight: '700' }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    paddingHorizontal: 4,
  },
  line: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: 15,
    height: 2,
    backgroundColor: LINE_GREY,
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  iconCircleActive: {},
  iconCircleInactive: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: LINE_GREY,
  },
  iconCircleComplete: {
    opacity: 0.9,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: GREY,
    fontWeight: '500',
  },
});
