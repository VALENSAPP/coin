import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, TouchableOpacity, KeyboardAvoidingView } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

export default function MissionSupportScreen({ visible, onClose }) {
    const { bgStyle, textStyle, bg } = useAppTheme();


    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const amounts = [5, 10, 25, 50];

    const handleConfirm = () => {
        const finalAmount = selectedAmount || customAmount;
        console.log("Final Amount:", finalAmount);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={styles.overlay}>
                    <View style={styles.modalBox}>
                        <ScrollView contentContainerStyle={[styles.container, bgStyle]}>

                            <Text style={[styles.title, textStyle]}>💜 VALENS MISSION POST</Text>

                            <Text style={styles.heading}>Fund this Mission. Fuel their vision.</Text>

                            <Text style={styles.description}>
                                Your contribution helps this creator complete a specific goal or project.
                            </Text>

                            <Text style={styles.label}>Leave a note (optional):</Text>
                            <TextInput
                                style={styles.noteInput}
                                placeholder="Type a short message of support..."
                                placeholderTextColor="#999"
                                multiline
                            />

                            <Text style={styles.label}>Choose your support amount:</Text>

                            <View style={styles.amountContainer}>
                                {amounts.map((amt) => (
                                    <TouchableOpacity
                                        key={amt}
                                        style={[styles.amountBox, selectedAmount === amt && styles.amountSelected]}
                                        onPress={() => {
                                            setSelectedAmount(amt);
                                            setCustomAmount('');
                                        }}
                                    >
                                        <Text style={styles.amountText}>${amt}</Text>
                                    </TouchableOpacity>
                                ))}

                                <View style={[styles.customBox, customAmount && styles.amountSelected]}>
                                    {/* <Text style={styles.customLabel}>Custom:</Text> */}
                                    <TextInput
                                        keyboardType="numeric"
                                        style={styles.customInput}
                                        value={customAmount}
                                        onChangeText={(t) => {
                                            setCustomAmount(t);
                                            setSelectedAmount(null);
                                        }}
                                        placeholder='Enter any amount'
                                        placeholderTextColor="#000"

                                    />
                                </View>
                            </View>

                            <Text style={styles.secureText}>
                                Your payment is processed securely. Standard Valens platform fees apply.
                            </Text>

                            <View style={styles.bottomButtons}>
                                <TouchableOpacity style={[styles.confirmBtn, bg]} onPress={handleConfirm}>
                                    <Text style={styles.confirmText}>🚀 Confirm & Support</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        padding: 20,
    },
    modalBox: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 10,
    },
    container: {
        padding: 20,
    },

    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },

    heading: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 10,
    },

    description: {
        fontSize: 15,
        color: '#333',
        marginVertical: 10,
    },

    label: {
        marginTop: 20,
        fontWeight: '600',
        fontSize: 15,
    },

    noteInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        height: 80,
        marginTop: 10,
    },

    amountContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
    },

    amountBox: {
        borderWidth: 1,
        borderColor: '#666',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginRight: 10,
        marginBottom: 10,
    },

    amountSelected: {
        borderColor: '#7F3DFF',
        backgroundColor: '#EDE4FF',
    },

    amountText: {
        fontSize: 16,
        fontWeight: '600',
    },

    customBox: {
        borderWidth: 1,
        borderColor: '#666',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 8,
        marginBottom: 10,
        width: '48%',
    },

    customInput: {
        flex: 1,
        fontSize: 16,
        textAlign: 'center',
    },

    secureText: {
        marginTop: 15,
        color: '#555',
        borderLeftWidth: 3,
        borderLeftColor: '#ccc',
        paddingLeft: 10,
    },

    bottomButtons: {
        flexDirection: 'row',
        marginTop: 30,
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    confirmBtn: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#5a2d82',
    },

    confirmText: {
        color: '#fff',
        fontWeight: '600',
    },

    cancelBtn: {
        padding: 12,
        borderWidth: 1,
        borderRadius: 5,
    },

    cancelText: {
        color: '#333',
        fontWeight: '600',
    },
});
