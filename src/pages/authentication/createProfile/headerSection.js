import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');
const steps = ['Email', 'Profile', 'KYC', 'Wallet'];

export default function StepHeader({ currentStep }) {
  return (
    <View style={styles.stepsRow}>
      {steps.map((label, index) => {
        const status = index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        return (
          <View key={index} style={styles.stepItemWrapper}>
            <View style={styles.stepContainer}>
              <View
                style={[
                  styles.circleSmall,
                  status === 'complete' && styles.circleCompleteSmall,
                  status === 'current' && styles.circleCurrentSmall,
                ]}
              >
                {status === 'complete' ? (
                  <Icon name="check" size={16} color="#fff" />
                ) : (
                  <Text style={[styles.stepNumber, status === 'current' && styles.textCurrent]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, status === 'current' && styles.labelCurrent]}>
                {label}
              </Text>
            </View>
            {index < steps.length - 1 && <View style={styles.stepDivider} />}
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
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  circleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  circleCompleteSmall: {
    backgroundColor: '#000',
  },
  circleCurrentSmall: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  stepNumber: {
    fontSize: 14,
    color: '#6B7280',
  },
  textCurrent: {
    color: '#000',
    fontWeight: '600',
  },
  stepLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
  },
  labelCurrent: {
    fontWeight: '600',
    color: '#000',
  },
});