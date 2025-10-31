import { StyleSheet } from 'react-native';

const createStyles = () => {
    const styles = StyleSheet.create({
    // attachment modal style
    AttachmentModaloverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    attachmentmodalContainer: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      elevation: 10,
      marginBottom: 100,
      marginLeft: 18,
      width: '30%',
    },
    AttachmentModaloption: {
      paddingVertical: 10,
    },
    AttachmentModaloptionText: {
      fontSize: 14,
      fontWeight: '400',
      color: '#000',
    },
  });
  return styles;
};

export default createStyles;