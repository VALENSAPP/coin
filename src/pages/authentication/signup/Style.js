import { StyleSheet, Dimensions } from 'react-native';
import { useAppTheme } from '../../../theme/useApptheme';

const { height } = Dimensions.get('window');

const useSignupStyles = () => {
  const { bg, text, card, border, mutedText, accent } = useAppTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
    },

    formWrapper: {
      flex: 1,
      marginTop: -30,
      paddingHorizontal: 7,
    },
    card: {
      backgroundColor: card,
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

    welcomeSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    welcomeTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: text,
      marginBottom: 12,
      textAlign: 'center',
    },
    welcomeSubtitle: {
      fontSize: 16,
      color: mutedText,
      fontWeight: '400',
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 10,
    },

    inputContainer: {
      width: '100%',
    },
    inputWrapper: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: text,
      marginBottom: 8,
    },
    inputLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    inputGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 52,
      backgroundColor: bg,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: border,
      paddingHorizontal: 12,
    },
    inputIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: `${accent}22`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    textInput: {
      flex: 1,
      fontSize: 16,
      color: text,
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
    optionalBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: bg,
      marginBottom: 8,
    },
    optionalBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    helperText: {
      color: mutedText,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 8,
      marginLeft: 4,
    },

    signupButton: {
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    signupButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: border,
    },
    orText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: mutedText,
      fontWeight: '500',
    },

    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      backgroundColor: card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: border,
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
      color: text,
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

    termsText: {
      fontSize: 12,
      color: mutedText,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 20,
      marginBottom: 24,
    },

    loginSection: {
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: border,
    },
    loginText: {
      fontSize: 16,
      color: mutedText,
      fontWeight: '400',
    },
    loginLink: {
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
      backgroundColor: card,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: border,
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
      color: text,
      marginLeft: 8,
    },
    appleSocialButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      backgroundColor: card,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: border,
      paddingHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      marginTop: -18,
      marginBottom: 11
    },

    socialSectionHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    socialSectionTitle: {
      fontSize: 18,
      fontWeight: '600',
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
      color: text,
    },

  });
  return styles;
};

export default useSignupStyles;
