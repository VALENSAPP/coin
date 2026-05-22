import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Modal,
    TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../i18n';

const TermCondition = ({ showModal, setShowModal, onAccept }) => {
    const [isChecked, setIsChecked] = useState(false);
    const { bgStyle, textStyle, text } = useAppTheme();
    const navigation = useNavigation();
    const { t } = useLanguage();

    return (
        <View style={{ flex: 1 }}>
            <Modal visible={showModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        {/* CLOSE BUTTON */}
                        <TouchableOpacity
                            onPress={() => {
                                setShowModal(false);
                                navigation.navigate('MainApp', {
                                    screen: 'wallet',
                                    params: { screen: 'Dashboard' },
                                });
                            }}
                            style={styles.closeButton}
                        >
                            <Ionicons name="close" size={26} color="#000" />
                        </TouchableOpacity>

                        <Text style={[styles.heading, textStyle]}>
                            {t('termConditionComponent.heading')}
                        </Text>

                        {/* SCROLL CONTENT */}
                        <ScrollView
                            style={styles.scrollBox}
                            contentContainerStyle={styles.content}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section1Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section1Body')}</Text>

                            {/* PART A */}
                            <Text style={styles.partTitle}>{t('termConditionComponent.partATitle')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section2Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section2Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section3Title')}</Text>

                            <Text style={styles.subSection}>{t('termConditionComponent.section3Sub1Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section3Sub1Body')}</Text>

                            <Text style={styles.subSection}>{t('termConditionComponent.section3Sub2Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section3Sub2Body')}</Text>

                            <Text style={styles.subSection}>{t('termConditionComponent.section3Sub3Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section3Sub3Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section4Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section4Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section5Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section5Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section6Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section6Body')}</Text>

                            {/* PART B */}
                            <Text style={styles.partTitle}>{t('termConditionComponent.partBTitle')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section7Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section7Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section8Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section8Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section9Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section9Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section10Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section10Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section11Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section11Body')}</Text>

                            {/* PART C */}
                            <Text style={styles.partTitle}>{t('termConditionComponent.partCTitle')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section12Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section12Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section13Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section13Body')}</Text>

                            <Text style={styles.sectionTitle}>{t('termConditionComponent.section14Title')}</Text>
                            <Text style={styles.text}>{t('termConditionComponent.section14Body')}</Text>

                            <View style={{ marginTop: 20 }} />

                            {/* CHECKBOX */}
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setIsChecked(!isChecked)}
                            >
                                <Ionicons
                                    name={isChecked ? 'checkbox-outline' : 'square-outline'}
                                    size={26}
                                    color={text}
                                />
                                <Text style={styles.checkboxLabel}>
                                    {t('termConditionComponent.checkboxLabel')}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.continueButton,
                                        { opacity: isChecked ? 1 : 0.5, backgroundColor: text },
                                    ]}
                                    disabled={!isChecked}
                                    onPress={async () => {
                                        await onAccept();
                                        setShowModal(false);
                                    }}
                                >
                                    <Text style={styles.continueText}>
                                        {t('termConditionComponent.continueButton')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default TermCondition;

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalBox: {
        width: '100%',
        height: '85%',
        backgroundColor: '#fff',
        borderRadius: 10,
        elevation: 10,
    },
    closeButton: {
        position: 'absolute',
        right: 10,
        top: 10,
        zIndex: 10,
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
        borderRadius: 9,
        paddingTop: 40,
        textDecorationLine: 'underline'

    },
    partTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 10,
        color: '#000',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 7,
        marginBottom: 5,
        color: '#000',
    },
    subSection: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 5,
        color: '#000',
        marginBottom: 1,
    },
    text: {
        fontSize: 14,
        color: '#000',
        lineHeight: 20,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxLabel: {
        marginLeft: 10,
        fontSize: 16,
        color: '#333',
    },
    buttonContainer: {
        marginTop: 20,
        width: '100%',
        alignItems: 'center',
    },

    continueButton: {
        paddingVertical: 12,
        width: '95%',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },

    continueText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
