import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import styles from './Style';
import { useDispatch } from 'react-redux';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserCredentials } from '../../services/post';
import { useToast } from 'react-native-toast-notifications';
import { showToastMessage } from '../../components/displaytoastmessage';

const VerificationStatusScreen = () => {
    const [data, setData] = useState(null);
    const [verificationData, setVerificationData] = useState({
        emailVerified: false,
        kycVerified: false,
    });
    const dispatch = useDispatch();
    const toast = useToast();
    const allVerified = Object.values(verificationData).every(v => v === true);

    useEffect(() => {
        loadProfileData();
    }, []);

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
        <SafeAreaView style={styles.container}>
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
                        <View style={styles.verificationItemLeft}>
                            <Text style={styles.verificationItemIcon}>🆔</Text>
                            <View>
                                <Text style={styles.verificationItemTitle}>KYC Verification</Text>
                                <Text style={styles.verificationItemSubtitle}>Government ID verified</Text>
                            </View>
                        </View>
                        {verificationData.kycVerified ? (
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>Verified</Text>
                            </View>
                        ) : (
                            <View style={styles.unVerifiedBadge}>
                                <Text style={styles.unVerifiedText}>Not Verified</Text>
                            </View>
                        )}
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    )
};

export default VerificationStatusScreen;