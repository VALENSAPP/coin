import { StyleSheet, Dimensions } from "react-native";
import { useAppTheme } from "../../../theme/useApptheme";

const { height } = Dimensions.get('window');

const createStyles = () => {
  const { bg, text, card, border, mutedText, accent, icon } = useAppTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
    },
    contentContainer: {
      flexGrow: 1,
      backgroundColor: bg,
    },
    backToAppBar: {
      paddingHorizontal: 16,
      paddingBottom: 6,
    },
    backToAppButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 14,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: border,
      top: 50,
      position: 'absolute',
      zIndex: 10,
      left: 16,
    },
    backToAppLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: text,
    },

    formWrapper: {
      flex: 1,
      marginTop: -20,
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
      fontSize: 28,
      fontWeight: '700',
      color: text,
      marginBottom: 8,
    },
    welcomeSubtitle: {
      fontSize: 16,
      color: mutedText,
      fontWeight: '400',
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

    langDropdown: {
      justifyContent: 'space-between',
    },
    langText: {
      flex: 1,
      fontSize: 16,
      color: text,
      marginLeft: 12,
      fontWeight: '400',
    },
    langDropdownList: {
      marginTop: -1,
      backgroundColor: card,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
      zIndex: 10,
      padding: 4,
      borderWidth: 1,
      borderColor: border,
    },
    langOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    langOptionText: {
      fontSize: 16,
      color: text,
      fontWeight: '500',
    },

    forgotPasswordBtn: {
      alignSelf: 'flex-end',
      marginBottom: 24,
      padding: 4,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: accent,
      fontWeight: '600',
    },
    loginButtonGradient: {
      height: 52,
      backgroundColor: accent,
      borderRadius: 16,
      marginBottom: 24,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: accent,
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

    dividerSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: border,
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 14,
      color: mutedText,
      fontWeight: '500',
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
      color: text,
      textAlign: 'center',
    },

    signupSection: {
      alignItems: 'center',
    },
    signupText: {
      fontSize: 16,
      color: mutedText,
      fontWeight: '400',
    },
    signupLink: {
      color: accent,
      fontWeight: '700',
    },

    headings: {
      fontSize: 14,
      fontWeight: '600',
      color: text,
      marginBottom: 7
    },
    input: {
      height: 45,
      borderColor: border,
      borderWidth: 1,
      borderRadius: 9,
      marginBottom: 12,
      paddingHorizontal: 10,
      backgroundColor: card,
      color: text,
    },
    icon: {
      position: 'absolute',
      right: 10,
      top: 32,
    },
    forgotText: {
      color: text,
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
      backgroundColor: border,
    },
    orText: {
      marginHorizontal: 10,
      color: mutedText,
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
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    socialBtnText3: {
      color: text,
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
      backgroundColor: '#111111',
    },
    metamaskBtn: {
      backgroundColor: bg,
      marginTop: 10,
      width: '100%',
      borderWidth: 1,
      borderColor: border,
    },
  });

  return styles;
};

export default createStyles;
