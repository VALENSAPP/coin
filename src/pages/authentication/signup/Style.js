import { StyleSheet, Dimensions } from 'react-native';
const { width, height } = Dimensions.get('window');
const createStyles = () => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f8f2fd',
    },
    contentContainer: {
      flexGrow: 1,
      backgroundColor: '#f8f2fd',
    },

    // Form wrapper styles
    formWrapper: {
      flex: 1,
      marginTop: -30,
      paddingHorizontal: 7,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      padding: 24,
      flex: 1,
      minHeight: height * 0.65,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      elevation: 8,
    },

    // Welcome Section
    welcomeSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
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

    // Enhanced Input Styles
    inputContainer: {
      width: '100%',
    },
    inputWrapper: {
      marginBottom: 20,
    },
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
      paddingHorizontal: 16,
    },
    textInput: {
      flex: 1,
      fontSize: 16,
      color: '#1F2937',
      fontWeight: '400',
    },
    eyeIcon: {
      padding: 4,
    },
    inputError: {
      borderColor: '#EF4444',
      backgroundColor: '#FEF2F2',
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
      fontWeight: '500',
    },

    // Sign Up Button
    signupButton: {
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
    signupButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // Divider
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: '#E5E7EB',
    },
    orText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: '#6B7280',
      fontWeight: '500',
    },

    // Social Buttons
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#E5E7EB',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#374151',
      marginLeft: 12,
    },
    twitterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      backgroundColor: '#1DA1F2',
      borderRadius: 16,
      marginBottom: 24,
      shadowColor: '#1DA1F2',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    twitterButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      marginLeft: 12,
    },

    // Terms Text
    termsText: {
      fontSize: 12,
      color: '#6B7280',
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 20,
      marginBottom: 24,
    },

    // Login Section
    loginSection: {
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
    },
    loginText: {
      fontSize: 16,
      color: '#6B7280',
      fontWeight: '400',
    },
    loginLink: {
      color: '#5a2d82',
      fontWeight: '700',
    },
    socialButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 32,
      gap: 12,
    },
    socialButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#E5E7EB',
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    socialButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#374151',
      marginLeft: 8,
    },
    appleSocialButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#E5E7EB',
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      marginTop: -18,
      marginBottom: 11
    },

    // Social Section Header
    socialSectionHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    socialSectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#5a2d82',
      textAlign: 'center',
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      marginTop: -8
    },
    text: {
      marginLeft: 10,
      fontSize: 16,
      fontWeight: '400',
      color: '#374151',
    },

  });
  return styles;
};
export default createStyles;
