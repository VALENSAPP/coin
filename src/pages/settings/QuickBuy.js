import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AuthHeader } from '../../components/auth';

const { height } = Dimensions.get('window');

export default function QuickBuy({ navigation }) {
  const [amount, setAmount] = useState('');

  // digits only + strip leading zeros
  const normalized = useMemo(
    () => amount.replace(/\D/g, '').replace(/^0+/, ''),
    [amount]
  );

  const isTwoDigits = normalized.length > 0 && normalized.length < 3; // 1–2 digits
  const canSave = !isTwoDigits; // disable when 1–2 digits

  const handleSave = () => {
    if (!canSave) return;
    const digits = normalized.length === 0 ? '111' : normalized;
    Alert.alert('Saved', `Double tap amount set to ${digits} Sparks`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header to match Forgot Password component */}
      <AuthHeader
        title="Trade settings"
        subtitle="Set a custom amount for double tap to buy. By default, it's 111 Sparks (0.000111 ETH)."
        onBackPress={() => navigation?.goBack?.()}
      />

      {/* Card wrapper (same look & feel) */}
      <View style={styles.formWrapper}>
        <View style={styles.card}>
          {/* Title area */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Double tap amount</Text>
            <Text style={styles.welcomeSubtitle}>
              Choose the Sparks you want to buy on double tap.
            </Text>
          </View>

          {/* Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Amount</Text>

              <View style={[styles.inputGroup, isTwoDigits && styles.inputError]}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="111"
                  placeholderTextColor="#9CA3AF"
                  style={styles.textInput}
                  maxLength={7}
                  autoCapitalize="none"
                  keyboardType={Platform.select({
                    ios: 'number-pad',
                    android: 'numeric',
                  })}
                />

                {/* Unit pill (kept, but styled to blend in) */}
                <View style={styles.pill}>
                  <Ionicons name="sparkles-outline" size={16} color="#1F2937" />
                  <Text style={styles.pillText}>Sparks</Text>
                </View>
              </View>

              {isTwoDigits && (
                <Text style={styles.errorText}>Amount must be at least 100 Sparks</Text>
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
                  If you leave it empty, we’ll use 111 Sparks by default.
                </Text>
              </View>
            </View>

            {/* Save button (matches Continue button style) */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  !canSave && styles.primaryButtonTextDisabled,
                ]}
              >
                Save
              </Text>
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
  welcomeSection: { alignItems: 'center', marginBottom: 32 },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
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
    height: 52,
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
    paddingVertical: 0,
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
    marginBottom: 24,
  },
  primaryButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0.1,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
