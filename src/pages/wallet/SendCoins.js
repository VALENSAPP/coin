import React, { useState, useLayoutEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/useApptheme";

const SendCoins = () => {
    const navigation = useNavigation();
    const [search, setSearch] = useState("");
    const [amount, setAmount] = useState("");
    const [selectedRatio, setSelectedRatio] = useState(null);
    const { bgStyle, textStyle, text } = useAppTheme();

    const handleContinue = () => {
        if (!amount) {
            Alert.alert("Error", "Please enter an amount");
            return;
        }
        Alert.alert(
            "Continue",
            `Recipient: ${search || 'Not specified'}\nAmount: ${amount}\nRatio: ${selectedRatio || "Custom"}%`
        );
    };

    useLayoutEffect(() => {
        navigation.setOptions({
            title: "Send",
            headerStyle: [{
                elevation: 0,
                shadowOpacity: 0,
            }, bgStyle],
            headerTitleStyle: {
                fontWeight: 'bold',
                color: '#111',
            },
            headerLeft: () => (
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.headerBtn}
                >
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color="#0a0a0aff"
                    />
                </TouchableOpacity>
            ),
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleContinue}
                    style={styles.headerBtn}
                >
                    <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, search, amount, selectedRatio]);

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <View style={[styles.searchBar, { shadowColor: text }]}>
                <MaterialCommunityIcons name="magnify" size={22} color="#555" />
                <TextInput
                    placeholder="Search recipient"
                    value={search}
                    onChangeText={setSearch}
                    style={styles.searchInput}
                    placeholderTextColor="#888"
                />
            </View>

            <View style={[styles.amountRow, { shadowColor: text }]}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                    placeholder="0.00"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    style={styles.amountInput}
                    placeholderTextColor="#888"
                />
                <TouchableOpacity style={styles.dropdown}>
                    <MaterialCommunityIcons name="chevron-down" size={22} color="#050505ff" />
                </TouchableOpacity>
            </View>

            {amount && selectedRatio !== null && (
                <Text style={styles.calculatedText}>
                    ${(parseFloat(amount) * selectedRatio / 100).toFixed(2)}
                </Text>
            )}

            <View style={styles.ratioRow}>
                {[10, 25, 50, 100].map((ratio) => (
                    <TouchableOpacity
                        key={ratio}
                        style={[
                            styles.ratioButton,
                            selectedRatio === ratio && { backgroundColor: text },
                        ]}
                        onPress={() => setSelectedRatio(ratio)}
                    >
                        <Text
                            style={[
                                styles.ratioText,
                                selectedRatio === ratio && styles.ratioTextSelected,
                            ]}
                        >
                            {ratio}%
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={[styles.continueBtn, {backgroundColor: text, shadowColor: text}]} onPress={handleContinue}>
                <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default SendCoins;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15,
        paddingTop: 20,
    },
    headerBtn: {
        padding: 8,
        marginHorizontal: 10,
    },
    doneText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0a0a0aff',
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 15,
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        marginLeft: 8,
        color: "#333",
        backgroundColor: '#fff',
    },
    amountRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 100,
        marginVertical: 20,
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    currencySymbol: {
        fontSize: 20,
        fontWeight: "700",
        color: "#111",
        marginRight: 10,
    },
    amountInput: {
        flex: 1,
        fontSize: 18,
        color: "#111",
    },
    dropdown: {
        paddingHorizontal: 10,
        justifyContent: "center",
    },
    ratioRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 30,
        marginTop: 30,
    },
    ratioButton: {
        flex: 1,
        marginHorizontal: 5,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: "#eee",
        alignItems: "center",
    },
    ratioText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#333",
    },
    ratioTextSelected: {
        color: "#fff",
    },
    continueBtn: {
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: "center",
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    continueText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    calculatedText: {
        textAlign: "center",
        fontSize: 14,
        fontWeight: 'bold',
        color: "gray",
        marginTop: 8,
        marginBottom: 15,
    },
});
