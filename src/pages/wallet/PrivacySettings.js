import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Alert,
    Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from './Style';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { userAccountDelete, userProfileStatusSet } from '../../services/wallet';
import { showToastMessage } from '../../components/displaytoastmessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loggedOut } from '../../redux/actions/LoginAction';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { useNavigation } from '@react-navigation/native';
import { getUserCredentials } from '../../services/post';

const LOSS_ITEMS = [
    { icon: 'shield-check-outline', titleKey: 'lossReputationTitle', descKey: 'lossReputationDesc' },
    { icon: 'sword-cross', titleKey: 'lossBattlesTitle', descKey: 'lossBattlesDesc' },
    { icon: 'account-group-outline', titleKey: 'lossFollowersTitle', descKey: 'lossFollowersDesc' },
    { icon: 'circle-multiple-outline', titleKey: 'lossCoinsTitle', descKey: 'lossCoinsDesc' },
    { icon: 'lock-outline', titleKey: 'lossCirclesTitle', descKey: 'lossCirclesDesc' },
    { icon: 'file-document-outline', titleKey: 'lossContentTitle', descKey: 'lossContentDesc' },
];

const PrivacySettingsScreen = () => {
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const toast = useToast();
    const { bgStyle, textStyle, cardStyle, text } = useAppTheme();
    const { t } = useLanguage();

    const [privacySettings, setPrivacySettings] = useState({
        profileVisibility: 'public',
    });

    const getProfileStatus = useCallback(async () => {
        dispatch(showLoader());
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (!userId) return;

            const resp = await getUserCredentials(String(userId));
            const profileStatus = String(
                resp?.data?.user?.profileStatus ||
                resp?.data?.profileStatus ||
                resp?.user?.profileStatus ||
                resp?.profileStatus ||
                '',
            ).trim().toLowerCase();

            if (profileStatus === 'public' || profileStatus === 'private') {
                setPrivacySettings(prev => ({
                    ...prev,
                    profileVisibility: profileStatus,
                }));
            }
        } catch (e) {
            showToastMessage(toast, 'danger', t('privacySettings.updateError'));
        } finally {
            dispatch(hideLoader());
        }
    }, [dispatch, t, toast]);

    useEffect(() => {
        getProfileStatus();
    }, [getProfileStatus]);

    const updateProfileStatus = async (status) => {
        if (privacySettings.profileVisibility === status) return;
        dispatch(showLoader());
        try {
            const dataToSend = { profileStatus: status };
            const resp = await userProfileStatusSet(dataToSend);
            if (resp?.statusCode === 200) {
                setPrivacySettings(prev => ({ ...prev, profileVisibility: status }));
                showToastMessage(toast, 'success', t('privacySettings.updateSuccess'));
            } else {
                showToastMessage(toast, 'danger', resp?.message || t('privacySettings.updateError'));
            }
        } catch (e) {
            showToastMessage(toast, 'danger', t('privacySettings.updateError'));
        } finally {
            dispatch(hideLoader());
        }
    };
    
    const handleProfileVisibilityChange = (visibility) => {
        updateProfileStatus(visibility);
    };

    const handleContactSupport = () => {
        const email = 'Support@valens.app';
        const subject = t('settings.helpEmailSubject');
        const body = t('settings.helpEmailBody');
        const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        Linking.openURL(url).catch(() => {
            Alert.alert(t('settings.error'), t('settings.noMailApp'));
        });
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t('privacySettings.deleteAccountTitle'),
            t('privacySettings.deleteAccountMessage'),
            [
                {
                    text: t('privacySettings.cancel'),
                    style: 'cancel',
                },
                {
                    text: t('privacySettings.delete'),
                    style: 'destructive',
                    onPress: () => {
                        handleOnDelete();
                    },
                },
            ]
        );
    };

    const handleOnDelete = async () => {
        dispatch(showLoader());
        try {
            const resp = await userAccountDelete();
            if (resp?.statusCode === 200) {
                AsyncStorage.setItem('isLoggedIn', 'false');
                AsyncStorage.removeItem('token');
                AsyncStorage.removeItem('firebaseToken');
                AsyncStorage.removeItem('userId');
                AsyncStorage.removeItem('username');
                AsyncStorage.removeItem('email');
                AsyncStorage.removeItem('walletAddress');
                AsyncStorage.removeItem('walletPrivateKey');
                AsyncStorage.removeItem('walletMnemonic');
                AsyncStorage.removeItem('profile');
                AsyncStorage.removeItem('stripeCustomerId');
                dispatch(loggedOut());
            } else {
                showToastMessage(toast, 'danger', resp?.message || t('privacySettings.deleteError'));
            }
        } catch (e) {
            showToastMessage(toast, 'danger', t('privacySettings.deleteError'));
        } finally {
            dispatch(hideLoader());
        }
    };

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.deleteScrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.deleteHeroSection}>
                    <MaterialCommunityIcons
                        name="alert-outline"
                        size={36}
                        color="#DC2626"
                        style={styles.deleteWarningIcon}
                    />
                    <Text style={[styles.deleteHeroTitle, textStyle]}>
                        {t('privacySettings.beforeYouGo')}
                    </Text>
                    <Text style={styles.deleteHeroSubtitle}>
                        {t('privacySettings.deletePermanentWarning')}
                    </Text>
                </View>

                <Text style={[styles.deleteLossSectionTitle, textStyle]}>
                    {t('privacySettings.youWillLose')}
                </Text>

                <View style={[styles.deleteLossCard, cardStyle]}>
                    {LOSS_ITEMS.map((item, index) => (
                        <View
                            key={item.titleKey}
                            style={[
                                styles.deleteLossItem,
                                index < LOSS_ITEMS.length - 1 && styles.deleteLossItemBorder,
                            ]}
                        >
                            <View style={styles.deleteLossIconWrap}>
                                <MaterialCommunityIcons
                                    name={item.icon}
                                    size={22}
                                    color={text}
                                />
                            </View>
                            <View style={styles.deleteLossItemContent}>
                                <Text style={[styles.deleteLossItemTitle, textStyle]}>
                                    {t(`privacySettings.${item.titleKey}`)}
                                </Text>
                                <Text style={styles.deleteLossItemDesc}>
                                    {t(`privacySettings.${item.descKey}`)}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={[styles.deleteSupportCard, cardStyle]}>
                    <View style={styles.deleteSupportRow}>
                        <MaterialCommunityIcons
                            name="headset"
                            size={28}
                            color={text}
                            style={styles.deleteSupportIcon}
                        />
                        <View style={styles.deleteSupportTextWrap}>
                            <Text style={[styles.deleteSupportTitle, textStyle]}>
                                {t('privacySettings.supportTitle')}
                            </Text>
                            <Text style={styles.deleteSupportDesc}>
                                {t('privacySettings.supportDesc')}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.deleteSupportButton, { borderColor: text }]}
                        onPress={handleContactSupport}
                    >
                        <Text style={[styles.deleteSupportButtonText, { color: text }]}>
                            {t('privacySettings.contactSupport')}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.keepAccountButton, { borderColor: text }]}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={[styles.keepAccountButtonText, { color: text }]}>
                        {t('privacySettings.keepMyAccount')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.deletePermanentButton}
                    onPress={handleDeleteAccount}
                >
                    <MaterialCommunityIcons
                        name="delete-outline"
                        size={20}
                        color="#FFFFFF"
                        style={styles.deletePermanentIcon}
                    />
                    <Text style={styles.deletePermanentButtonText}>
                        {t('privacySettings.deleteAccountPermanently')}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default PrivacySettingsScreen;
