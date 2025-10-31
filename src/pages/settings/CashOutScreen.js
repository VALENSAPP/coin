import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TextGradient from '../../assets/textgradient/TextGradient';
import { AuthHeader } from '../../components/auth';

const { height } = Dimensions.get('window');

export default function CashOutScreen({ navigation }) {
  const [address, setAddress] = useState('');

  const isValidAddress = useMemo(() => {
    const v = address.trim();
    if (!v.startsWith('0x') || v.length !== 42) return false;
    return /^[0-9a-fA-F]{40}$/.test(v.slice(2));
  }, [address]);

  const hasError = address.length > 0 && !isValidAddress;

  const handleDone = () => {
    if (!isValidAddress) {
      Alert.alert('Invalid Address', 'Enter a valid Ethereum address (0x + 40 hex characters).');
      return;
    }
    Alert.alert('Success', `Address linked: ${address.trim()}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header to match theme */}
      <AuthHeader
        title="Cash out"
        subtitle="Link your wallet to convert the Sparks you've earned to Ethereum."
        onBackPress={() => navigation?.goBack?.()}
      />

      {/* Card wrapper (same look & feel) */}
      <View style={styles.formWrapper}>
        <View style={styles.card}>
          {/* Top section with brand */}
          <View style={styles.welcomeSection}>
            {/* <TextGradient
              style={{ fontWeight: 'bold', fontSize: 30 }}
              locations={[0, 1]}
              colors={['#513189bd', '#e54ba0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              text="VALENS"
            /> */}
            {/* <Text style={styles.welcomeTitle}>Cash out your Sparks instantly</Text> */}
            <Text style={styles.welcomeSubtitle}>
              Link your wallet to withdraw your Sparks as ETH.
            </Text>
          </View>

          {/* Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Address</Text>

              <View style={[styles.inputGroup, hasError && styles.inputError]}>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter an address (starts with 0x)"
                  placeholderTextColor="#9CA3AF"
                  style={styles.textInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* Paste pill */}
                <TouchableOpacity
                  style={styles.pill}
                  onPress={() => setAddress('0x123...mock')}
                >
                  <Ionicons name="clipboard-outline" size={16} color="#1F2937" />
                  <Text style={styles.pillText}>Paste</Text>
                </TouchableOpacity>
              </View>

              {hasError && (
                <Text style={styles.errorText}>
                  Enter a valid Ethereum address (0x + 40 hex characters)
                </Text>
              )}
            </View>

            {/* Info box */}
            <View style={styles.infoSection}>
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color="#5a2d82"
                  style={styles.infoIcon}
                />
                <Text style={styles.infoText}>
                  We’ll only use this address to send your ETH when you cash out.
                </Text>
              </View>
            </View>

            {/* Primary action (matches theme) */}
            <TouchableOpacity
              onPress={handleDone}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Page / theme
  container: { flex: 1, backgroundColor: '#f8f2fd' },
  contentContainer: { flexGrow: 1, backgroundColor: '#f8f2fd' },

  // Card wrapper (same structure as Forgot Password)
  formWrapper: { flex: 1, marginTop: -20, paddingHorizontal: 7 },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    minHeight: height * 0.75,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },

  // Title area
  welcomeSection: { alignItems: 'center', marginBottom: 24 },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  // Input group (mirrors Forgot Password styles)
  inputContainer: { width: '100%' },
  inputWrapper: { marginBottom: 20 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '400',
    paddingVertical: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pillText: { marginLeft: 6, fontSize: 14, fontWeight: '700', color: '#1F2937' },

  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },

  // Info box (same pattern)
  infoSection: { marginBottom: 24 },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#5a2d82',
  },
  infoIcon: { marginRight: 12, marginTop: 1 },
  infoText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  // Primary button (matches Continue)
  primaryButton: {
    height: 52,
    backgroundColor: '#5a2d82',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
