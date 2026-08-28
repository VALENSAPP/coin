import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../i18n';
import { useThemeContext } from '../../theme/ThemeContext';
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useNavigation, useRoute } from '@react-navigation/native';

const UpdateSubscriptionPriceScreen = () => {
    const { t } = useLanguage();
    const navigation = useNavigation();
    const route = useRoute();
    const { isBusinessProfile } = useThemeContext();
    const theme = useBusinessProfileTheme(isBusinessProfile);

    // Initial parameters could be passed from the previous screen
    const currentPrice = route.params?.currentPrice || 9.90;
    const [newPrice, setNewPrice] = useState('');
    
    // Options: 'KEEP_CURRENT' or 'REQUEST_CHANGE'
    const [applyOption, setApplyOption] = useState('KEEP_CURRENT');
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleContinue = () => {
        // Implement save logic later
        setShowSuccessModal(true);
    };

    const handleDone = () => {
        setShowSuccessModal(false);
        navigation.goBack();
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
            <KeyboardAvoidingView 
                style={styles.container} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Update Subscription Price</Text>
                    <View style={styles.headerRight} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={[styles.subtitle, { color: theme.mutedText }]}>Set a new monthly price for your subscribers.</Text>
                    
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        <Text style={[styles.cardLabel, { color: theme.mutedText }]}>Current price</Text>
                        <View style={styles.priceRow}>
                            <Text style={[styles.currentPrice, { color: theme.accent }]}>${currentPrice.toFixed(2)}</Text>
                            <Text style={[styles.priceSuffix, { color: theme.mutedText }]}> / month</Text>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <Text style={[styles.cardLabel, { color: theme.mutedText }]}>New price</Text>
                        <View style={[styles.inputContainer, { borderColor: theme.border }]}>
                            <Text style={[styles.currencyPrefix, { color: theme.text }]}>$</Text>
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                value={newPrice}
                                onChangeText={setNewPrice}
                                keyboardType="numeric"
                                placeholder="14.90"
                                placeholderTextColor={theme.mutedText}
                            />
                            <Text style={[styles.inputSuffix, { color: theme.mutedText }]}>/ month</Text>
                        </View>
                        <Text style={[styles.helpText, { color: theme.mutedText }]}>You can set a price from $0.99 to $1,000.00</Text>
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.accent }]}>Existing subscribers</Text>
                        <Text style={[styles.sectionSubtitle, { color: theme.text }]}>Choose how the new price will apply to your current subscribers.</Text>
                    </View>

                    <TouchableOpacity 
                        style={[
                            styles.radioCard, 
                            { 
                                backgroundColor: theme.card,
                                borderColor: applyOption === 'KEEP_CURRENT' ? theme.accent : theme.border,
                                borderWidth: applyOption === 'KEEP_CURRENT' ? 2 : 1
                            }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setApplyOption('KEEP_CURRENT')}
                    >
                        <View style={styles.radioHeader}>
                            <Ionicons 
                                name={applyOption === 'KEEP_CURRENT' ? "radio-button-on" : "radio-button-off"} 
                                size={24} 
                                color={theme.accent} 
                            />
                            <View style={styles.radioTitleRow}>
                                <Text style={[styles.radioTitle, { color: theme.text }]}>Keep current subscribers at ${currentPrice.toFixed(2)}</Text>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>Recommended</Text>
                                </View>
                            </View>
                        </View>
                        <Text style={[styles.radioDescription, { color: theme.mutedText }]}>
                            New price will only <Text style={{ color: theme.text, fontWeight: '500' }}>apply to new subscribers.</Text> Existing subscribers will continue paying ${currentPrice.toFixed(2)}/month.
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[
                            styles.radioCard, 
                            { 
                                backgroundColor: theme.card,
                                borderColor: applyOption === 'REQUEST_CHANGE' ? theme.accent : theme.border,
                                borderWidth: applyOption === 'REQUEST_CHANGE' ? 2 : 1
                            }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setApplyOption('REQUEST_CHANGE')}
                    >
                        <View style={styles.radioHeader}>
                            <Ionicons 
                                name={applyOption === 'REQUEST_CHANGE' ? "radio-button-on" : "radio-button-off"} 
                                size={24} 
                                color={theme.accent} 
                            />
                            <View style={styles.radioTitleRow}>
                                <Text style={[styles.radioTitle, { color: theme.text }]}>Request price change for existing subscribers</Text>
                            </View>
                        </View>
                        <Text style={[styles.radioDescription, { color: theme.mutedText }]}>
                            Existing subscribers will be notified and must accept the new price before it takes effect.
                        </Text>
                    </TouchableOpacity>

                    <View style={[styles.card, { backgroundColor: theme.card, marginTop: 12 }]}>
                        <Text style={[styles.summaryTitle, { color: theme.accent }]}>Summary</Text>
                        
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Previous price</Text>
                            <Text style={[styles.summaryValue, { color: theme.text }]}>${currentPrice.toFixed(2)} / month</Text>
                        </View>
                        
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>New price</Text>
                            <Text style={[styles.summaryValue, { color: theme.accent, fontWeight: 'bold' }]}>${parseFloat(newPrice || currentPrice).toFixed(2)} / month</Text>
                        </View>
                        
                        <View style={styles.summarySection}>
                            <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Existing subscribers (428)</Text>
                            <Text style={[styles.summaryValueLeft, { color: applyOption === 'KEEP_CURRENT' ? '#4CAF50' : theme.text, marginTop: 4 }]}>
                                {applyOption === 'KEEP_CURRENT' ? `Will continue paying ${currentPrice.toFixed(2)}/month` : `Will be requested to pay ${parseFloat(newPrice || currentPrice).toFixed(2)}/month`}
                            </Text>
                        </View>
                        
                        <View style={styles.summarySection}>
                            <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>New subscribers</Text>
                            <Text style={[styles.summaryValueLeft, { color: theme.text, marginTop: 4 }]}>
                                Will pay ${parseFloat(newPrice || currentPrice).toFixed(2)}/month
                            </Text>
                        </View>
                        
                        <View style={styles.summarySection}>
                            <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Effective date</Text>
                            <Text style={[styles.summaryValueLeft, { color: theme.text, marginTop: 4 }]}>
                                {applyOption === 'KEEP_CURRENT' ? 'Immediately for new subscribers' : 'Upon subscriber acceptance'}
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                <View style={[styles.footer, { backgroundColor: theme.bg }]}>
                    <TouchableOpacity 
                        style={[styles.continueButton, { backgroundColor: theme.accent }]}
                        onPress={handleContinue}
                    >
                        <Text style={styles.continueButtonText}>Continue</Text>
                    </TouchableOpacity>
                </View>

            <Modal visible={showSuccessModal} animationType="slide" transparent={false}>
                <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
                    <ScrollView contentContainerStyle={styles.successScrollContent} style={{ flex: 1 }}>
                        <View style={styles.successHeader}>
                            <View style={styles.successIconContainer}>
                                <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                            </View>
                            <Text style={[styles.successTitle, { color: theme.accent }]}>Subscription Price Updated!</Text>
                            <Text style={[styles.successSubtitle, { color: theme.mutedText }]}>Your subscription price has been updated successfully.</Text>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.card, width: '100%' }]}>
                            <Text style={[styles.summaryTitle, { color: theme.accent }]}>Summary</Text>
                            
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Previous price</Text>
                                <Text style={[styles.summaryValue, { color: theme.text }]}>${currentPrice.toFixed(2)} / month</Text>
                            </View>
                            
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>New price</Text>
                                <Text style={[styles.summaryValue, { color: theme.accent, fontWeight: 'bold' }]}>${parseFloat(newPrice || currentPrice).toFixed(2)} / month</Text>
                            </View>
                            
                            <View style={styles.summarySection}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Existing subscribers (428)</Text>
                                <Text style={[styles.summaryValueLeft, { color: applyOption === 'KEEP_CURRENT' ? '#4CAF50' : theme.text, marginTop: 4 }]}>
                                    {applyOption === 'KEEP_CURRENT' ? `Will continue paying ${currentPrice.toFixed(2)}/month` : `Will be requested to pay ${parseFloat(newPrice || currentPrice).toFixed(2)}/month`}
                                </Text>
                            </View>
                            
                            <View style={styles.summarySection}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>New subscribers</Text>
                                <Text style={[styles.summaryValueLeft, { color: theme.text, marginTop: 4 }]}>
                                    Will pay ${parseFloat(newPrice || currentPrice).toFixed(2)}/month
                                </Text>
                            </View>
                            
                            <View style={styles.summarySection}>
                                <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Effective date</Text>
                                <Text style={[styles.summaryValueLeft, { color: theme.text, marginTop: 4 }]}>
                                    {applyOption === 'KEEP_CURRENT' ? 'Immediately for new subscribers' : 'Upon subscriber acceptance'}
                                </Text>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={[styles.footer, { backgroundColor: theme.bg }]}>
                        <TouchableOpacity 
                            style={[styles.continueButton, { backgroundColor: theme.accent }]}
                            onPress={handleDone}
                        >
                            <Text style={styles.continueButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    headerRight: {
        width: 32,
    },

    successScrollContent: {
        padding: 20,
        alignItems: 'center',
    },
    successHeader: {
        alignItems: 'center',
        marginVertical: 32,
    },
    successIconContainer: {
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 22,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    summarySection: {
        marginBottom: 16,
    },
    summaryLabel: {
        fontSize: 14,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    summaryValueLeft: {
        fontSize: 14,
        fontWeight: '500',
    },
    scrollContent: {
        padding: 20,
    },
    subtitle: {
        fontSize: 15,
        marginBottom: 20,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    currentPrice: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    priceSuffix: {
        fontSize: 14,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 8,
    },
    currencyPrefix: {
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontWeight: 'bold',
    },
    inputSuffix: {
        fontSize: 14,
    },
    helpText: {
        fontSize: 12,
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
    },
    radioCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    radioHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    radioTitleRow: {
        flex: 1,
        marginLeft: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    radioTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    badge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        marginTop: 2,
    },
    badgeText: {
        color: '#4CAF50',
        fontSize: 10,
        fontWeight: 'bold',
    },
    radioDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginLeft: 36,
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 20 : 20,
        marginBottom:'12%'
    },
    continueButton: {
        borderRadius: 12,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default UpdateSubscriptionPriceScreen;
