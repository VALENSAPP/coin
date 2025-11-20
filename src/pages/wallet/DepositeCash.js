import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import React, { useLayoutEffect } from 'react'
import Clipboard from "@react-native-clipboard/clipboard";
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAppTheme } from '../../theme/useApptheme';

const DepositeCash = () => {
  const userId = '0xf8652b01';
  const { bgStyle, textStyle, text } = useAppTheme();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Deposit Cash',
      headerStyle: [{
        elevation: 0,
        shadowOpacity: 0,
      }, bgStyle],
      headerTitleStyle: {
        fontWeight: 'bold',
        color: '#111',
      },
    });
  }, [navigation]);

  const copyToClipboard = () => {
    Clipboard.setString(userId);
    Alert.alert("Copied!", `User ID ${userId} copied to clipboard.`);
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <Text style={[styles.header, textStyle]}>Smart Wallet</Text>
      <Text style={styles.subText}>
        Use your wallet address to deposit or manage funds securely.
      </Text>

      <View style={[styles.clipboardBox, {shadowColor: text}]}>
        <Text style={styles.walletAddress}>{userId}</Text>
        <TouchableOpacity onPress={copyToClipboard} style={styles.copyBtn}>
          <Ionicons
            name="copy-outline"
            size={20}
            color="black"
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.header, textStyle, { marginTop: 30 }]}>Deposit ETH</Text>
      <Text style={styles.subText}>
        Connect your wallet to start depositing ETH quickly and securely.
      </Text>

      <TouchableOpacity style={[styles.primaryBtn, {backgroundColor: text, shadowColor: text}]}>
        <Text style={styles.primaryBtnText}>Connect Wallet</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default DepositeCash;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 30,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
    lineHeight: 20,
  },
  clipboardBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  copyBtn: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  },
});