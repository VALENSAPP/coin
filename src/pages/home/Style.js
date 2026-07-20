import { Platform, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

const createStyles = () => {
  const { bg, text, border, icon } = useAppTheme();
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bg,
      bottom: 0,
      // padding (not margin) so theme bg fills the tab-bar clearance — margin left a white gap
      paddingBottom: Platform.OS == 'android' ? 60 : 25,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: -13,
    },
    headerLeftContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 15,
      paddingVertical: 4,
      borderBottomColor: border,
      zIndex: 20,
      elevation: 20,
      backgroundColor: 'transparent',
    },
    appLogo: {
      resizeMode: 'contain',
    },
    logo: {
      fontFamily: 'Nunito-SemiBold',
      fontSize: 22,
      fontWeight: '700',
      color: '#4d2a88',
      marginTop: 10,
      marginLeft: -2
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIcon: {
      marginLeft: 20,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      fontSize: 18,
      color: '#666',
    },
    // --- Stories styles ---
    storiesContainer: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      backgroundColor: bg,
      borderBottomWidth: 0.5,
      borderBottomColor: border,
    },
    storyItem: {
      alignItems: 'center',
      marginRight: 16,
      width: 68,
    },
    avatarBorder: {
      borderWidth: 2,
      borderColor: '#c13584', // Instagram gradient pink
      borderRadius: 40,
      padding: 2,
      marginBottom: 4,
    },
    userBorder: {
      borderColor: '#999', // Gray for your own story
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 28,
      backgroundColor: '#eee',
    },
    storyUsername: {
      fontSize: 10,
      color: text,
      maxWidth: 60,
      textAlign: 'center',
      marginTop: 4,
      fontWeight: '500',
    },
    addIcon: {
      position: 'absolute',
      bottom: -8,
      right: -8,
      zIndex: 1000,
      backgroundColor: '#fff',
      borderRadius: 100,
    },
    addStoryOverlay: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      zIndex: 10,
    },
    addStoryButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#4da3ff',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
    },
    flashIcon: {
      left: 0,
    },
    icon: {
      marginLeft: -15,
      marginTop: 5
    },
    flatlistContainer: {
      marginBottom: 60,
    },
    positiom: {
      marginTop: '25%'
    },
    dropsText: {
      fontWeight: '500',
      fontSize: 15,
      color: text,
    },
  });
  return styles;
};
export default createStyles;
