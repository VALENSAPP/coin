// src/pages/authentication/termsAndPrivacy.js
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';

export default function TermsCondition() {
  const navigation = useNavigation();
  const toast = useToast();

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [errors, setErrors] = useState({});

  // Handle opening links
  const openLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        toast.show('Cannot open this link', { type: 'warning' });
      }
    } catch (error) {
      console.error('Error opening link:', error);
      toast.show('Error opening link', { type: 'danger' });
    }
  };

  // Validate agreements
  const validateAgreements = () => {
    const newErrors = {};
    if (!acceptTerms) {
      newErrors.terms = 'You must accept the Terms and Conditions';
    }
    if (!acceptPrivacy) {
      newErrors.privacy = 'You must accept the Privacy Policy';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle continue button
  const handleContinue = () => {
    if (validateAgreements()) {
      const agreementData = {
        acceptTerms,
        acceptPrivacy,
        agreementTimestamp: new Date().toISOString(),
      };
      console.log('createProfile')
      navigation.navigate('CreateProfile', { agreementData });
    } else {
      Alert.alert(
        'Agreements Required',
        'Please accept both the Terms and Conditions and Privacy Policy to continue.'
      );
    }
  };

  const isValid = acceptTerms && acceptPrivacy;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                style={styles.iconGradient}
              >
                <Icon name="shield-check" size={32} color="#FFF" />
              </LinearGradient>
            </View>
            
            <Text style={styles.title}>Legal Agreements</Text>
            <Text style={styles.subtitle}>
              Before joining Valens, please review and accept our platform policies to ensure a safe and respectful community for everyone.
            </Text>
          </View>

          {/* Terms and Conditions Card */}
          <View style={styles.agreementCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Icon name="file-text" size={20} color="#4F46E5" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Terms and Conditions</Text>
                <Text style={styles.cardSubtitle}>Platform rules and user conduct</Text>
              </View>
              {/* <TouchableOpacity 
                style={styles.readButton}
                onPress={() => openLink('https://valens.com/terms')}
              >
                <Text style={styles.readButtonText}>Read</Text>
                <Icon name="external-link" size={14} color="#4F46E5" />
              </TouchableOpacity> */}
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardDescription}>
                Our Terms and Conditions cover:
              </Text>
              <View style={styles.bulletPoints}>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>Platform rules and user responsibilities</Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>Coin system usage and guidelines</Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>Anti-discrimination and harassment policies</Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>Community standards and moderation</Text>
                </View>
              </View>
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}
                onPress={() => {
                  setAcceptTerms(!acceptTerms);
                  if (errors.terms) {
                    setErrors(prev => ({ ...prev, terms: '' }));
                  }
                }}
              >
                {acceptTerms && <Icon name="check" size={16} color="#FFF" />}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                I have read and agree to the Terms and Conditions
              </Text>
            </View>
            {errors.terms && (
              <Text style={styles.errorText}>{errors.terms}</Text>
            )}
          </View>

          {/* Privacy Policy Card */}
          <View style={styles.agreementCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconContainer}>
                <Icon name="lock" size={20} color="#059669" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Privacy Policy</Text>
                <Text style={styles.cardSubtitle}>Data protection and privacy</Text>
              </View>
              {/* <TouchableOpacity 
                style={[styles.readButton, styles.readButtonPrivacy]}
                onPress={() => openLink('https://valens.com/privacy')}
              >
                <Text style={[styles.readButtonText, styles.readButtonTextPrivacy]}>Read</Text>
                <Icon name="external-link" size={14} color="#059669" />
              </TouchableOpacity> */}
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardDescription}>
                Our Privacy Policy explains:
              </Text>
              <View style={styles.bulletPoints}>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>What personal data we collect</Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>How we use and protect your information</Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>Your privacy rights and controls</Text>
                </View>
                <View style={styles.bulletPoint}>
                  <Icon name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.bulletText}>Data sharing and security measures</Text>
                </View>
              </View>
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, acceptPrivacy && styles.checkboxChecked]}
                onPress={() => {
                  setAcceptPrivacy(!acceptPrivacy);
                  if (errors.privacy) {
                    setErrors(prev => ({ ...prev, privacy: '' }));
                  }
                }}
              >
                {acceptPrivacy && <Icon name="check" size={16} color="#FFF" />}
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                I have read and accept the Privacy Policy
              </Text>
            </View>
            {errors.privacy && (
              <Text style={styles.errorText}>{errors.privacy}</Text>
            )}
          </View>

          {/* Important Notice */}
          <View style={styles.noticeContainer}>
            <View style={styles.noticeIcon}>
              <Icon name="info" size={18} color="#F59E0B" />
            </View>
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>Important Notice</Text>
              <Text style={styles.noticeText}>
                Valens is committed to creating a safe, inclusive, and respectful environment. 
                We have zero tolerance for discrimination, harassment, or abuse of any kind. 
                Violations may result in immediate account suspension or permanent ban.
              </Text>
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            style={[styles.continueButton, isValid && styles.continueButtonActive]}
            disabled={!isValid}
          >
            <Text
              style={[
                styles.continueButtonText,
                isValid && styles.continueButtonTextActive,
              ]}
            >
              Continue to Profile Setup
            </Text>
            <Icon 
              name="arrow-right" 
              size={18} 
              color={isValid ? "#FFF" : "#9CA3AF"} 
            />
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you confirm that you understand and agree to be bound by these terms.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    paddingHorizontal: 20,
  },
  
  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },

  // Agreement Cards
  agreementCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  readButtonPrivacy: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  readButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
    marginRight: 4,
  },
  readButtonTextPrivacy: {
    color: '#059669',
  },
  
  // Card Content
  cardContent: {
    marginBottom: 20,
  },
  cardDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    fontWeight: '500',
  },
  bulletPoints: {
    marginLeft: 8,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },

  // Checkbox
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '500',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 8,
    marginLeft: 36,
  },

  // Notice Section
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    marginBottom: 32,
  },
  noticeIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 14,
    color: '#B45309',
    lineHeight: 20,
  },

  // Continue Button
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  continueButtonActive: {
    backgroundColor: '#1F2937',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    marginRight: 8,
  },
  continueButtonTextActive: {
    color: '#FFF',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});