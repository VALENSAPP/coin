import { StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

const createStyles = () => {
    const { bg } = useAppTheme();

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: bg,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: bg,
            borderBottomWidth: 1,
            borderBottomColor: '#e1e1e1',
        },
        backButton: {
            padding: 8,
        },
        headerTitle: {
            flex: 1,
            fontSize: 18,
            fontWeight: '600',
            color: '#262626',
            textAlign: 'center',
            marginRight: 40,
        },
        placeholder: {
            width: 40,
        },
        scrollView: {
            flex: 1,
            backgroundColor: bg,
        },
        section: {
            marginTop: 15,
        },
        sectionTitleContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            marginBottom: 16,
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: '#262626',
        },
        metaText: {
            fontSize: 16,
            fontWeight: '600',
            color: '#262626',
        },
        sectionHeader: {
            fontSize: 16,
            fontWeight: '600',
            color: '#262626',
            paddingHorizontal: 16,
            marginBottom: 16,
        },
        sectionDescription: {
            fontSize: 14,
            color: '#8e8e93',
            paddingHorizontal: 16,
            marginTop: 12,
            lineHeight: 18,
        },
        learnMore: {
            color: '#1877f2',
            fontWeight: '500',
        },
        settingsItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: bg,
            borderBottomWidth: 0.5,
            borderBottomColor: '#f2f2f2',
        },
        itemLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        itemTextContainer: {
            marginLeft: 12,
            flex: 1,
        },
        itemText: {
            fontSize: 16,
            color: '#262626',
            fontWeight: '400',
        },
        itemSubtext: {
            fontSize: 14,
            color: '#8e8e93',
            marginTop: 2,
        },
        itemRight: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        rightText: {
            fontSize: 16,
            color: '#8e8e93',
            marginRight: 8,
        },
        blueIndicator: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#1877f2',
            marginRight: 8,
        },
        actionItem: {
            paddingHorizontal: 16,
            paddingVertical: 16,
            backgroundColor: bg,
            borderBottomWidth: 0.5,
            borderBottomColor: '#f2f2f2',
        },
        actionText: {
            fontSize: 16,
            color: '#262626',
            fontWeight: '400',
        },
        destructiveText: {
            color: '#ff3b30',
        },
        blueText: {
            color: '#1877f2',
        },
        gridContainer: {
            flex: 1,
            flexDirection: 'row',
            flexWrap: 'wrap',
            padding: 10,
            marginBottom: 20,
        },
        gridButtonContainer: {
            flexBasis: '25%',
            marginTop: 20,
            justifyContent: 'center',
            alignItems: 'center',
        },
        gridButton: {
            width: 50,
            height: 50,
            borderRadius: 25,
            justifyContent: 'center',
            alignItems: 'center',
        },
        gridIcon: {
            fontSize: 30,
            color: 'white',
        },
        gridLabel: {
            fontSize: 14,
            paddingTop: 10,
            color: '#333',
        },
    });
    return styles;
};

export default createStyles;