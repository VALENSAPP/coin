import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';

export default function BlockedVerification() {
  const navigation = useNavigation();
  const route = useRoute();
  const normalizedProfileType = String(route?.params?.profile || 'user').toLowerCase();
  const profileType =
    normalizedProfileType === 'company' || normalizedProfileType === 'business'
      ? 'company'
      : 'user';
  const verificationType = profileType === 'company' ? 'KYB' : 'KYC';
  const { bg, text, card } = useAppTheme(profileType);

  const handleCompleteVerification = () => {
    if (profileType === 'company') {
      navigation.navigate('BusinessSetupAuth', { profile: 'company' });
      return;
    }

    navigation.navigate('KycVerifyAuth', { profile: 'user' });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>
      <View style={styles.container}>
        <View style={[styles.content, { backgroundColor: card }]}>
          <View style={[styles.iconWrap, { backgroundColor: text }]}>
            <Text style={styles.icon}>!</Text>
          </View>

          <Text style={[styles.title, { color: text }]}>
            Your account is blocked
          </Text>

          <Text style={styles.message}>
            Your account is blocked because profile verification was not completed within 3 days.
          </Text>

          <Text style={styles.subMessage}>
            Complete your {verificationType} to unlock your account and continue using Valens.
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleCompleteVerification}
            style={[styles.button, { backgroundColor: text }]}
          >
            <Text style={styles.buttonText}>Complete {verificationType}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  content: {
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 22,
  },
  button: {
    width: '100%',
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});
