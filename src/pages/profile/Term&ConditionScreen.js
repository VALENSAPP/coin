import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../i18n';
import { useAppTheme } from '../../theme/useApptheme';
import { useNavigation } from '@react-navigation/native';

const TermConditionScreen = () => {
    const { bgStyle, textStyle } = useAppTheme();
    const navigation = useNavigation();
    const { t } = useLanguage();

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.closeButton}
                activeOpacity={0.7}
            >
                <Text style={[styles.closeIcon, textStyle]}>✕</Text>
            </TouchableOpacity>

            <View style={styles.header}>
                <Text style={[styles.heading, textStyle]}>
                    {t('termCondition.screenTitle')}
                </Text>
                <View style={styles.placeholder} />
            </View>

            {/* SCROLL CONTENT */}
            <ScrollView
                style={styles.scrollBox}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>{t('termCondition.section1Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section1Text')}
                </Text>

                {/* PART A — SUBSCRIBERS */}
                <Text style={styles.partTitle}>{t('termCondition.partATitle')}</Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section2Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section2Text')}
                </Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section3Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section3Text')}
                </Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section4Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section4Text')}
                </Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section5Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section5Text')}
                </Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section6Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section6Text')}
                </Text>

                {/* PART B — GENERAL TERMS */}
                <Text style={styles.partTitle}>{t('termCondition.partBTitle')}</Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section7Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section7Text')}
                </Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section8Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section8Text')}
                </Text>

                <Text style={styles.sectionTitle}>{t('termCondition.section9Title')}</Text>
                <Text style={styles.text}>
                    {t('termCondition.section9Text')}
                </Text>

                <View style={{ marginTop: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

export default TermConditionScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        left: 17
        // paddingHorizontal: 18,
    },
    closeButton: {
        width: 40,
        height: 40,
        left: 28
        // justifyContent: 'center',
        // alignItems: 'center',
    },
    closeIcon: {
        fontSize: 28,
        fontWeight: '400',
    },
    placeholder: {
        width: 40,
    },
    scrollBox: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 10,
        paddingBottom: 40,
    },
    heading: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        flex: 1,
        textDecorationLine: 'underline',
        marginBottom: 10,
        // left: -15
    },
    partTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 10,
        color: '#000',
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 7,
        marginBottom: 5,
        color: '#000',
        lineHeight: 20,
    },
    subSection: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 5,
        color: '#000',
        marginBottom: 3,
    },
    text: {
        fontSize: 14,
        color: '#000',
        lineHeight: 20,
        marginBottom: 2,
        fontWeight: '400'
    },
});