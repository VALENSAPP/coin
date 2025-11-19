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

const TermCondition = ({ showModal, setShowModal,onAccept }) => {
    const [isChecked, setIsChecked] = useState(false);

    return (
        <View style={{ flex: 1 }}>
            <Modal visible={showModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        {/* CLOSE BUTTON */}
                        <TouchableOpacity
                            onPress={() => setShowModal(false)}
                            style={styles.closeButton}
                        >
                            <Ionicons name="close" size={26} color="#000" />
                        </TouchableOpacity>

                        <Text style={styles.heading}>VALENS MASTER SUBSCRIPTOR POLICY</Text>
                        {/* SCROLL CONTENT */}
                        <ScrollView
                            style={styles.scrollBox}
                            contentContainerStyle={styles.content}
                            showsVerticalScrollIndicator={false}
                        >

                            <Text style={styles.sectionTitle}>1. Overview</Text>
                            <Text style={styles.text}>
                                This Master Subscription Policy applies to all users participating in the Valens
                                subscription ecosystem, including Plan Owners and Subscribers. By activating or
                                subscribing, users agree to this policy, including Valens Terms of Use, Privacy
                                Policy, and Payout Policy.
                            </Text>

                            {/* PART A */}
                            <Text style={styles.partTitle}>PART A — TERMS FOR PLAN OWNERS</Text>

                            <Text style={styles.sectionTitle}>2. Subscription Plan Creation</Text>
                            <Text style={styles.text}>
                                When you activate a subscription plan, you become a Plan Owner. You may create private
                                channels, define perks, and set monthly subscription prices between $9.99 USD and
                                $100.00 USD.
                            </Text>

                            <Text style={styles.sectionTitle}>3. Platform Fees</Text>

                            <Text style={styles.subSection}>3.1 Monthly Maintenance Fee</Text>
                            <Text style={styles.text}>
                                Valens charges $19.99 USD/month for hosting and operating your subscription channel.
                            </Text>

                            <Text style={styles.subSection}>3.2 Withdrawal Fee</Text>
                            <Text style={styles.text}>A 5% withdrawal fee applies to every payout request.</Text>

                            <Text style={styles.subSection}>3.3 Billing Authorization</Text>
                            <Text style={styles.text}>
                                By enabling your plan, you authorize Valens to charge maintenance fees and deduct
                                payout withdrawal fees automatically.
                            </Text>

                            <Text style={styles.sectionTitle}>4. Earnings & Payouts</Text>
                            <Text style={styles.text}>
                                Earnings are visible in the Creator Dashboard. Payouts follow the Payout Policy. KYC
                                verification is required. You must report earnings to tax authorities.
                            </Text>

                            <Text style={styles.sectionTitle}>5. Content Responsibilities</Text>
                            <Text style={styles.text}>
                                All private content must follow Valens guidelines. Illegal, harmful, abusive, or
                                fraudulent content is prohibited.
                            </Text>

                            <Text style={styles.sectionTitle}>6. Account & Compliance Enforcement</Text>
                            <Text style={styles.text}>
                                Valens may restrict monetization, freeze payouts, remove content, or disable plans
                                upon violations.
                            </Text>

                            {/* PART B */}
                            <Text style={styles.partTitle}>PART B — TERMS FOR SUBSCRIBERS</Text>

                            <Text style={styles.sectionTitle}>7. Subscription Access</Text>
                            <Text style={styles.text}>
                                Subscribers gain access to exclusive private content and perks. Access is
                                non-transferable.
                            </Text>

                            <Text style={styles.sectionTitle}>8. Monthly Billing & Auto-Renewal</Text>
                            <Text style={styles.text}>
                                By subscribing, you authorize Valens to bill you monthly until cancellation.
                            </Text>

                            <Text style={styles.sectionTitle}>9. Cancellation</Text>
                            <Text style={styles.text}>
                                You may cancel anytime. Access remains until the end of the billing period. No
                                partial refunds.
                            </Text>

                            <Text style={styles.sectionTitle}>10. No Refunds</Text>
                            <Text style={styles.text}>
                                All subscription payments are final and non-refundable, including unused periods.
                            </Text>

                            <Text style={styles.sectionTitle}>11. Content Protection</Text>
                            <Text style={styles.text}>
                                Subscribers may NOT screenshot, record, download, print, or share subscription
                                content. Violations may result in a security block.
                            </Text>

                            {/* PART C */}
                            <Text style={styles.partTitle}>PART C — GENERAL TERMS</Text>

                            <Text style={styles.sectionTitle}>12. Safety & Compliance</Text>
                            <Text style={styles.text}>
                                All interactions must comply with Valens Community Guidelines and legal requirements.
                            </Text>

                            <Text style={styles.sectionTitle}>13. Platform Rights</Text>
                            <Text style={styles.text}>
                                Valens may update fees, freeze suspicious activity, restrict payouts, or suspend
                                programs.
                            </Text>

                            <Text style={styles.sectionTitle}>14. Agreement to Terms</Text>
                            <Text style={styles.text}>
                                By using subscription features, you agree to this policy and authorize Valens to
                                manage charges and fees.
                            </Text>

                            <View style={{ marginTop: 20 }} />

                            {/* CHECKBOX */}
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setIsChecked(!isChecked)}
                            >
                                <Ionicons
                                    name={isChecked ? 'checkbox-outline' : 'square-outline'}
                                    size={26}
                                    color="#5a2d82"
                                />
                                <Text style={styles.checkboxLabel}>I agree to the Terms & Conditions</Text>
                            </TouchableOpacity>
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[
                                        styles.continueButton,
                                        { opacity: isChecked ? 1 : 0.5 },
                                    ]}
                                    disabled={!isChecked}
                                    onPress={ async() => {
                                        await onAccept();
                                        setShowModal(false);
                                    }}
                                >
                                    <Text style={styles.continueText}>Continue</Text>
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
        color: '#5a2d82',
        textAlign: 'center',
        borderRadius:9,
        paddingTop:40,
        textDecorationLine:'underline'
        
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
        backgroundColor: '#5a2d82',
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
