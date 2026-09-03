import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Modal, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../i18n';
import { useThemeContext } from '../../theme/ThemeContext';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { setPrivateSubscription } from '../../services/wallet';

const ReviewChangesScreen = () => {
    const { t } = useLanguage();
    const navigation = useNavigation();
    const route = useRoute();
    const { isBusinessProfile } = useThemeContext();
    const theme = useBusinessProfileTheme(isBusinessProfile);

    const { 
        currentPrice = 9.90, 
        newPrice = 14.90, 
        applyOption = 'KEEP_CURRENT', 
        subscriptionId,
        comment = ''
    } = route.params || {};

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [updateError, setUpdateError] = useState('');

    const parsedNewPrice = parseFloat(newPrice || currentPrice);

    const handleContinue = async () => {
        try {
            setUpdateError('');
            setIsLoading(true);

            const pricingPolicy = applyOption === 'KEEP_CURRENT' 
                ? 'GRANDFATHER_EXISTING'  
                : 'REQUIRE_NEW_CONSENT';   

            const payload = {
                subscriptionAmount: parsedNewPrice,
                status: 'ACTIVE',
                pricingPolicy: pricingPolicy,
                comment: comment
            };

            const response = await setPrivateSubscription(payload);
            console.log(response, 'update response e eheterheerer');
            if (response?.statusCode === 200 || response?.status === 200) {
                setShowSuccessModal(true);
            } else {
                setUpdateError(response?.message || 'Failed to update subscription price. Please try again.');
                Alert.alert('Error', response?.message || 'Failed to update subscription price. Please try again.');
            }
        } catch (error) {
            const errorMessage = error?.response?.data?.message || error?.message || 'An error occurred while updating the subscription price.';
            setUpdateError(errorMessage);
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDone = () => {
        setShowSuccessModal(false);
        navigation.navigate('ManageSubscribers'); // Navigate back to Manage Subscribers
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('manageSubscribers.priceUpdateReview.reviewChangesTitle')}</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.subtitle, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.reviewChangesSubtitle')}</Text>
                
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                    <Text style={[styles.cardLabel, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.currentSubscriptionPrice')}</Text>
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceValue, { color: theme.accent }]}>${currentPrice.toFixed(2)}</Text>
                        <Text style={[styles.priceSuffix, { color: theme.text }]}> / month</Text>
                    </View>
                    
                    <View style={styles.divider} />
                    
                    <Text style={[styles.cardLabel, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.newSubscriptionPrice')}</Text>
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceValue, { color: theme.accent }]}>${parsedNewPrice.toFixed(2)}</Text>
                        <Text style={[styles.priceSuffix, { color: theme.text }]}> / month</Text>
                    </View>
                </View>

                <View style={[styles.card, { backgroundColor: theme.card, marginTop: 12 }]}>
                    {applyOption !== 'KEEP_CURRENT' && (
                        <Text style={[styles.sectionTitle, { color: theme.accent, marginBottom: 12, fontWeight: '700' }]}>{t('manageSubscribers.priceUpdateReview.thisUpdateWillApplyTo')}</Text>
                    )}
                    
                    <View style={styles.listItem}>
                        <View style={[styles.iconWrapper, { backgroundColor: '#F3E8FF' }]}>
                            <Ionicons name="person-outline" size={20} color="#8B5CF6" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>
                                {applyOption === 'KEEP_CURRENT' ? t('manageSubscribers.priceUpdateReview.existingSubscribers') : t('manageSubscribers.priceUpdateReview.allExistingSubscribers')}
                            </Text>
                            <Text style={[styles.itemDesc, { color: applyOption === 'KEEP_CURRENT' ? '#4CAF50' : theme.mutedText, marginTop: 4 }]}>
                                {applyOption === 'KEEP_CURRENT' 
                                    ? t('manageSubscribers.priceUpdateReview.willContinuePaying', { price: currentPrice.toFixed(2) }) 
                                    : t('manageSubscribers.priceUpdateReview.willBeNotified')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
                    </View>

                    <View style={styles.listDivider} />
                    
                    <View style={styles.listItem}>
                        <View style={[styles.iconWrapper, { backgroundColor: '#F3E8FF' }]}>
                            <Ionicons name="sparkles-outline" size={20} color="#8B5CF6" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>{t('manageSubscribers.priceUpdateReview.newSubscribers')}</Text>
                            <Text style={[styles.itemDesc, { color: theme.mutedText, marginTop: 4 }]}>
                                {applyOption === 'KEEP_CURRENT' 
                                    ? t('manageSubscribers.priceUpdateReview.willPay', { price: parsedNewPrice.toFixed(2) }) 
                                    : t('manageSubscribers.priceUpdateReview.willPayImmediately', { price: parsedNewPrice.toFixed(2) })}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
                    </View>
                    
                    <View style={styles.listDivider} />

                    <View style={styles.listItem}>
                        <View style={[styles.iconWrapper, { backgroundColor: '#F3E8FF' }]}>
                            <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
                        </View>
                        <View style={styles.itemContent}>
                            <Text style={[styles.itemTitle, { color: theme.text }]}>{t('manageSubscribers.priceUpdateReview.effectiveDate')}</Text>
                            <Text style={[styles.itemDesc, { color: theme.mutedText, marginTop: 4 }]}>
                                {applyOption === 'KEEP_CURRENT' 
                                    ? t('manageSubscribers.priceUpdateReview.immediatelyForNew') 
                                    : t('manageSubscribers.priceUpdateReview.onNextRenewal')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.mutedText} />
                    </View>
                </View>

                <View style={[styles.banner, { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }]}>
                    <Ionicons name="information-circle-outline" size={20} color="#8B5CF6" style={{ marginTop: 2 }} />
                    <Text style={[styles.bannerText, { color: '#6B7280' }]}>
                        {applyOption === 'KEEP_CURRENT'
                            ? t('manageSubscribers.priceUpdateReview.infoKeepCurrent')
                            : t('manageSubscribers.priceUpdateReview.infoRequestChange')}
                    </Text>
                </View>
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: theme.bg }]}>
                <TouchableOpacity 
                    style={[styles.continueButton, { backgroundColor: isLoading ? theme.mutedText : theme.accent, opacity: isLoading ? 0.6 : 1 }]}
                    onPress={handleContinue}
                    disabled={isLoading}
                >
                    <Text style={styles.continueButtonText}>
                        {isLoading 
                            ? t('manageSubscribers.priceUpdateReview.updating') 
                            : (applyOption === 'KEEP_CURRENT' ? t('manageSubscribers.priceUpdateReview.confirmUpdate') : t('manageSubscribers.priceUpdateReview.continue'))}
                    </Text>
                </TouchableOpacity>
            </View>

            <Modal visible={showSuccessModal} animationType="slide" transparent={false}>
                <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
                    <ScrollView contentContainerStyle={styles.successScrollContent} style={{ flex: 1 }}>
                        <View style={styles.successHeader}>
                            <View style={styles.successIconContainer}>
                                <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                            </View>
                            <Text style={[styles.successTitle, { color: theme.accent }]}>{t('manageSubscribers.priceUpdateReview.successTitle')}</Text>
                            <Text style={[styles.successSubtitle, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.successSubtitle')}</Text>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, width: '100%' }]}>
                            <Text style={[styles.summaryTitle, { color: theme.accent }]}>{t('manageSubscribers.priceUpdateReview.summaryTitle')}</Text>
                            
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.previousPrice')}</Text>
                                <Text style={[styles.summaryValue, { color: theme.text }]}>${currentPrice.toFixed(2)} / month</Text>
                            </View>
                            
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.newSubscriptionPrice')}</Text>
                                <Text style={[styles.summaryValue, { color: theme.accent, fontWeight: 'bold' }]}>${parsedNewPrice.toFixed(2)} / month</Text>
                            </View>

                            <View style={styles.divider} />
                            
                            <View style={styles.summarySection}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.existingSubscribers')}</Text>
                                <Text style={[styles.summaryValueLeft, { color: applyOption === 'KEEP_CURRENT' ? '#4CAF50' : theme.text, marginTop: 4 }]}>
                                    {applyOption === 'KEEP_CURRENT' 
                                        ? t('manageSubscribers.priceUpdateReview.willContinuePaying', { price: currentPrice.toFixed(2) }) 
                                        : t('manageSubscribers.priceUpdateReview.willBeNotified')}
                                </Text>
                            </View>
                            
                            <View style={styles.summarySection}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.newSubscribers')}</Text>
                                <Text style={[styles.summaryValueLeft, { color: theme.text, marginTop: 4 }]}>
                                    {t('manageSubscribers.priceUpdateReview.willPay', { price: parsedNewPrice.toFixed(2) })}
                                </Text>
                            </View>
                            
                            <View style={styles.summarySection}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>{t('manageSubscribers.priceUpdateReview.effectiveDate')}</Text>
                                <Text style={[styles.summaryValueLeft, { color: theme.text, marginTop: 4 }]}>
                                    {applyOption === 'KEEP_CURRENT' 
                                        ? t('manageSubscribers.priceUpdateReview.immediatelyForNew') 
                                        : t('manageSubscribers.priceUpdateReview.onNextRenewal')}
                                </Text>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={[styles.footer, { backgroundColor: theme.bg }]}>
                        <TouchableOpacity 
                            style={[styles.continueButton, { backgroundColor: theme.accent }]}
                            onPress={handleDone}
                        >
                            <Text style={styles.continueButtonText}>{t('manageSubscribers.priceUpdateReview.done')}</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    backButton: { padding: 4 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
    headerRight: { width: 32 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    subtitle: { fontSize: 14, marginBottom: 16 },
    card: {
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardLabel: { fontSize: 13, marginBottom: 6 },
    priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
    priceValue: { fontSize: 28, fontWeight: '700' },
    priceSuffix: { fontSize: 16, marginBottom: 4, marginLeft: 2, fontWeight: '500' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.1)', marginVertical: 16 },
    listItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
    iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    itemContent: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: '600' },
    itemDesc: { fontSize: 13, lineHeight: 18 },
    listDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 8, marginLeft: 48 },
    banner: {
        flexDirection: 'row',
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    bannerText: { flex: 1, fontSize: 13, marginLeft: 10, lineHeight: 18 },
    footer: {
        padding: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    continueButton: {
        borderRadius: 24,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '10%',
    },
    continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    successScrollContent: { padding: 24, alignItems: 'center' },
    successHeader: { alignItems: 'center', marginBottom: 32, marginTop: 40 },
    successIconContainer: { marginBottom: 16 },
    successTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    successSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
    summaryLabel: { fontSize: 14 },
    summaryValue: { fontSize: 14, fontWeight: '500' },
    summarySection: { marginVertical: 8 },
    summaryValueLeft: { fontSize: 14, fontWeight: '500' },
});

export default ReviewChangesScreen;
