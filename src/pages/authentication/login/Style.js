import { StyleSheet, Dimensions } from "react-native";
import { useAppTheme } from "../../../theme/useApptheme";

const { width, height } = Dimensions.get('window');

const createStyles = () => {
  const { bg, text } = useAppTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
    },
    contentContainer: {
      flexGrow: 1,
      backgroundColor: bg,
    },
    
    // Form wrapper styles
    formWrapper: {
      flex: 1,
      marginTop: -20,
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
      fontSize: 28,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 8,
    },
    welcomeSubtitle: {
      fontSize: 16,
      color: '#6B7280',
      fontWeight: '400',
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
    inputError: {
      borderColor: '#EF4444',
      backgroundColor: '#FEF2F2',
    },
    passwordToggle: {
      padding: 4,
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      marginTop: 4,
      marginLeft: 4,
      fontWeight: '500',
    },

    // Enhanced Button Styles
    forgotPasswordBtn: {
      alignSelf: 'flex-end',
      marginBottom: 24,
      padding: 4,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: text, // Using the darker purple for consistency
      fontWeight: '600',
    },
    loginButtonGradient: {
      height: 52,
      backgroundColor: text, // Using the darker purple for the button
      borderRadius: 16,
      marginBottom: 24,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    loginButton: {
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    loginButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // Enhanced Divider
    dividerSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#E5E7EB',
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: '#6B7280',
      fontWeight: '500',
    },

    // Enhanced Social Buttons
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
      color: text,
      textAlign: 'center',
    },

    // Sign Up Section
    signupSection: {
      alignItems: 'center',
    },
    signupText: {
      fontSize: 16,
      color: '#6B7280',
      fontWeight: '400',
    },
    signupLink: {
      color: text, // Using consistent purple color
      fontWeight: '700',
    },

    // Legacy styles (keeping for compatibility)
    headings: {
      fontSize: 14,
      fontWeight: '600',
      color: '#000',
      marginBottom: 7
    },
    input: {
      height: 45,
      borderColor: '#dbdbdb',
      borderWidth: 1,
      borderRadius: 9,
      marginBottom: 12,
      paddingHorizontal: 10,
      backgroundColor: '#fff',
      color: '#000',
    },
    icon: {
      position: 'absolute',
      right: 10,
      top: 32,
    },
    forgotText: {
      color: '#000',
      marginTop: 10,
      fontSize: 14,
      marginBottom: 10,
      textAlign: 'right',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
      width: '100%',
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: '#dbdbdb',
    },
    orText: {
      marginHorizontal: 10,
      color: '#8e8e8e',
      fontWeight: '600',
    },
    fbContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fbIcon: {
      width: 20,
      height: 20,
      marginRight: 8,
      tintColor: '#3897f0',
    },
    fbText: {
      color: '#3897f0',
      fontWeight: '600',
    },
    signupContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
      marginBottom: 10,
    },
    socialBtn: {
      width: '100%',
      height: 45,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    socialBtnText: {
      color: '#3897f0',
      fontSize: 16,
      fontWeight: '600',
    },
    socialBtnText2: {
      color: bg,
      fontSize: 16,
      fontWeight: '600',
    },
    socialBtnText3: {
      color: 'black',
      fontSize: 16,
      fontWeight: '600',
    },
    instagramBtn: {
      backgroundColor: bg,
      color: '#3897f0',
      borderWidth: 1,
      borderColor: '#3897f0',
    },
    twitterBtn: {
      backgroundColor: 'black',
    },
    metamaskBtn: {
      backgroundColor: bg,
      marginTop: 10,
      width: '100%',
      borderWidth: 1,
      borderColor: 'black',
    },
  });
  
  return styles;
};

export default createStyles;