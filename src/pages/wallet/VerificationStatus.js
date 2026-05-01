import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
} from 'react-native';
import styles from './Style';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserCredentials } from '../../services/post';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useAppTheme } from '../../theme/useApptheme';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { startVerification } from '../../services/companyProfile';
import SNSMobileSDK from '@sumsub/react-native-mobilesdk-module';

const VerificationStatusScreen = () => {
    const [data, setData] = useState(null);
    const navigation = useNavigation();
    const [verificationData, setVerificationData] = useState({
        emailVerified: false,
        kycVerified: false,
    });
    const [isLaunchingSumsub, setIsLaunchingSumsub] = useState(false);
    const sumsubLaunchLockRef = useRef(false);
    const dispatch = useDispatch();
    const toast = useToast();
    const allVerified = Object.values(verificationData).every(v => v === true);
    const { bgStyle, textStyle } = useAppTheme();

    const launchSumsub = async () => {
        if (sumsubLaunchLockRef.current || isLaunchingSumsub) return;
        sumsubLaunchLockRef.current = true;
        setIsLaunchingSumsub(true);

        try {
            const response = await startVerification();
            const accessToken = response?.data?.token;

            if (!accessToken) {
                showToastMessage(toast, 'danger', 'Unable to start verification. Please try again.');
                return;
            }

            const sdk = SNSMobileSDK.init(accessToken, () => accessToken)
                .withHandlers({
                    onStatusChanged: (event) => {
                        console.log('Sumsub status:', event);
                    },
                })
                .withDebug(true)
                .build();

            await sdk.launch();
        } catch (error) {
            const errorMessage = String(error?.message || error || '').toLowerCase();
            if (errorMessage.includes('another instance is in use')) {
                showToastMessage(toast, 'warning', 'Verification is already open. Please complete it first.');
            } else {
                showToastMessage(toast, 'danger', 'Failed to open Sumsub verification.');
            }
            console.log(error, 'Sumsub launch error');
        } finally {
            sumsubLaunchLockRef.current = false;
            setIsLaunchingSumsub(false);
        }
    };
    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [])
    );
    console.log(data, 'dtaa in verifcation apiaipaaa')
    const loadProfileData = async () => {
        dispatch(showLoader());
        try {
            const viewerId = await AsyncStorage.getItem('userId');
            if (!viewerId) return;
            const resp = await getUserCredentials(viewerId);
            if (resp?.statusCode === 200) {
                setData(resp.data);
                setVerificationData({
                    emailVerified: resp.data?.verifyEmail == 1,
                    kycVerified: resp.data?.kyc,
                });
            }
            else {
                showToastMessage(toast, resp?.message || 'Failed to load profile data', 'danger');
            }
        } catch (e) {
            // dispatch(hideLoader());
        }
        finally {
            dispatch(hideLoader());
        }
    };

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <StatusBar barStyle="dark-content" />
            <ScrollView style={styles.content}>
                <View style={styles.verificationCard}>
                    <View style={[
                        styles.verificationBadge,
                        !allVerified && styles.verificationBadgePartial
                    ]}>
                        <Text style={styles.verificationIcon}>
                            {allVerified ? '✓' : '⚠'}
                        </Text>
                    </View>
                    <Text style={styles.verificationTitle}>
                        {allVerified ? 'Account Verified' : 'Verification Incomplete'}
                    </Text>
                    <Text style={styles.verificationSubtitle}>
                        {allVerified
                            ? 'Your account is fully verified'
                            : 'Please complete your verification to keep your account secure'}
                    </Text>
                </View>

                <View style={styles.section}>
                    <View style={styles.verificationItem}>
                        <View style={styles.verificationItemLeft}>
                            <Text style={styles.verificationItemIcon}>📧</Text>
                            <View>
                                <Text style={styles.verificationItemTitle}>Email Verification</Text>
                                <Text style={styles.verificationItemSubtitle}>{data?.email}</Text>
                            </View>
                        </View>
                        {verificationData.emailVerified ? (
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        ) : (
                            <View style={styles.unVerifiedBadge}>
                                <Text style={styles.unVerifiedText}>Not Verified</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.verificationItem}>
                        <TouchableOpacity onPress={() => {
                            if (data?.profile === "company") {
                                launchSumsub();
                            } else if (!verificationData?.kycVerified) {
                                navigation.navigate('kycverify');
                            }
                        }}
                            style={styles.verificationItemLeft}>
                            <Text style={styles.verificationItemIcon}>🆔</Text>
                            <View>
                                <Text style={styles.verificationItemTitle}>
                                    {data?.profile === 'company' ? 'KYB Verification' : 'KYC Verification'}
                                </Text>
                                <Text style={styles.verificationItemSubtitle}>Government ID verified</Text>
                            </View>
                        </TouchableOpacity>
                        {verificationData.kycVerified ? (
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => {
                                if (data?.profile === "company") {
                                    launchSumsub();
                                } else if (!verificationData?.kycVerified) {
                                    navigation.navigate('kycverify');
                                }
                            }}>

                                <View style={styles.unVerifiedBadge}>
                                    <Text style={styles.unVerifiedText}>Not Verified</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    )
};

export default VerificationStatusScreen;
