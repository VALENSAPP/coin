import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from '@react-navigation/native';
import React, { useLayoutEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/useApptheme';

const CashOut = () => {
    const [address, setAddress] = useState('');
    const { bgStyle, textStyle, text } = useAppTheme();
    const navigation = useNavigation();

    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Cash Out',
            headerStyle: [{
                elevation: 0,
                shadowOpacity: 0,
            }, bgStyle],
            headerTitleStyle: {
                fontWeight: 'bold',
                color: '#111',
            },
            headerRight: () => (
                <TouchableOpacity
                    onPress={() => {
                        if (address.trim() === '') {
                            Alert.alert('Error', 'Please enter a wallet address.');
                        } else {
                            Alert.alert('Success', `Address saved:\n${address}`);
                        }
                    }}
                    style={styles.headerButton}
                >
                    <Text style={styles.headerButtonText}>Done</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, address]);
 
    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <MaterialCommunityIcons
                name="wallet"
                size={72}
                color={text}
                style={styles.icon}
            />

            <Text style={[styles.header, textStyle]}>Cash Out Sparks Instantly</Text>
            <Text style={styles.subText}>
                Link your wallet to convert the Sparks you've earned to Ethereum.
            </Text>

            <View style={[styles.inputBox, {shadowColor: text}]}>
                <Text style={styles.label}>Wallet Address</Text>
                <TextInput
                    placeholder="Enter your wallet address"
                    style={styles.input}
                    placeholderTextColor="#888"
                    value={address}
                    onChangeText={setAddress}
                />
            </View>

            <TouchableOpacity style={[styles.button, {backgroundColor: text, shadowColor: text}]}>
                <Text style={styles.buttonText}>Cash Out</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default CashOut;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        padding: 20,
        paddingTop: 40,
    },
    headerButton: {
        marginRight: 15,
        paddingVertical: 5,
        paddingHorizontal: 10,
    },
    headerButtonText: {
        color: '#101111ff',
        fontWeight: '700',
        fontSize: 16,
    },
    icon: {
        marginBottom: 20,
    },
    header: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 10,
    },
    subText: {
        fontSize: 14,
        color: '#555',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    inputBox: {
        width: '100%',
        marginBottom: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    label: {
        fontSize: 14,
        color: '#333',
        marginBottom: 6,
        textAlign: 'center',
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: '#e6def4',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        textAlign: 'center',
        backgroundColor: '#fff',
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 50,
        borderRadius: 16,
        marginTop: 16,
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
});