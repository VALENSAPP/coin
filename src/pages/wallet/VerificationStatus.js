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
import { useBusinessProfileTheme } from '../../theme/useBusinessProfileTheme';
import { useThemeContext } from '../../theme/ThemeContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { startVerification } from '../../services/companyProfile';
import SNSMobileSDK from '@sumsub/react-native-mobilesdk-module';
import { useLanguage } from '../../i18n';

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
    const { bgStyle, textStyle, text, accent, mutedText, border, cardStyle } = useBusinessProfileTheme();
    const { isDarkMode } = useThemeContext();
    const { t } = useLanguage();

    const cardThemeStyle = [cardStyle, { borderWidth: 1, borderColor: border }];

    const launchSumsub = async () => {
        if (sumsubLaunchLockRef.current || isLaunchingSumsub) return;
        sumsubLaunchLockRef.current = true;
        setIsLaunchingSumsub(true);

        try {
            const response = await startVerification();
            const accessToken = response?.data?.token;

            if (!accessToken) {
                showToastMessage(toast, 'danger', t('verification.sumsubTokenError'));
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
                showToastMessage(toast, 'warning', t('verification.sumsubAlreadyOpen'));
            } else {
                showToastMessage(toast, 'danger', t('verification.sumsubLaunchFailed'));
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
            } else {
                showToastMessage(toast, resp?.message || t('verification.loadFailed'), 'danger');
            }
        } catch (e) {
            // handled silently
        } finally {
            dispatch(hideLoader());
        }
    };

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <ScrollView style={styles.content}>
                <View style={[styles.verificationCard, cardThemeStyle]}>
                    <View style={[styles.verificationBadge, !allVerified && styles.verificationBadgePartial]}>
                        <Text style={styles.verificationIcon}>
                            {allVerified ? '✓' : '⚠'}
                        </Text>
                    </View>
                    <Text style={[styles.verificationTitle, { color: text }]}>
                        {allVerified ? t('verification.accountVerified') : t('verification.verificationIncomplete')}
                    </Text>
                    <Text style={[styles.verificationSubtitle, { color: mutedText }]}>
                        {allVerified
                            ? t('verification.fullyVerifiedSubtitle')
                            : t('verification.incompleteSubtitle')}
                    </Text>
                </View>

                <View style={styles.section}>
                    {/* Email Verification Row */}
                    <View style={[styles.verificationItem, cardThemeStyle]}>
                        <View style={styles.verificationItemLeft}>
                            <Text style={styles.verificationItemIcon}>📧</Text>
                            <View>
                                <Text style={[styles.verificationItemTitle, { color: text }]}>{t('verification.emailVerificationTitle')}</Text>
                                <Text style={[styles.verificationItemSubtitle, { color: mutedText }]}>{data?.email}</Text>
                            </View>
                        </View>
                        {verificationData.emailVerified ? (
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>{t('verification.verified')}</Text>
                            </View>
                        ) : (
                            <View style={styles.unVerifiedBadge}>
                                <Text style={styles.unVerifiedText}>{t('verification.notVerified')}</Text>
                            </View>
                        )}
                    </View>

                    {/* KYC / KYB Verification Row */}
                    <View style={[styles.verificationItem, cardThemeStyle]}>
                        <TouchableOpacity
                            onPress={() => {
                                if (data?.profile === 'company') {
                                    launchSumsub();
                                } else if (!verificationData?.kycVerified) {
                                    navigation.navigate('kycverify');
                                }
                            }}
                            style={styles.verificationItemLeft}
                        >
                            <Text style={styles.verificationItemIcon}>🆔</Text>
                            <View>
                                <Text style={[styles.verificationItemTitle, { color: text }]}>
                                    {data?.profile === 'company'
                                        ? t('verification.kybTitle')
                                        : t('verification.kycTitle')}
                                </Text>
                                <Text style={[styles.verificationItemSubtitle, { color: mutedText }]}>
                                    {t('verification.governmentIdSubtitle')}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {verificationData.kycVerified ? (
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedText}>{t('verification.verified')}</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => {
                                    if (data?.profile === 'company') {
                                        launchSumsub();
                                    } else if (!verificationData?.kycVerified) {
                                        navigation.navigate('kycverify');
                                    }
                                }}
                            >
                                <View style={styles.unVerifiedBadge}>
                                    <Text style={styles.unVerifiedText}>{t('verification.notVerified')}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default VerificationStatusScreen;