import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Alert,
} from 'react-native';
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
import { useRoute } from '@react-navigation/native';
import { getUserCredentials } from '../../services/post';

const PrivacySettingsScreen = () => {
    const dispatch = useDispatch();
    const route = useRoute();
    const toast = useToast();
    const { bgStyle, textStyle } = useAppTheme();
    const { t } = useLanguage();
    const hideDeleteAccount = route?.params?.hideDeleteAccount === true;

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
            <ScrollView style={styles.content}>
                <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>{t('privacySettings.profileVisibility')}</Text>
                    <View style={styles.radioGroup}>
                        <TouchableOpacity
                            style={styles.radioItem}
                            onPress={() => handleProfileVisibilityChange('public')}
                        >
                            <View style={styles.radio}>
                                {privacySettings.profileVisibility === 'public' && (
                                    <View style={styles.radioSelected} />
                                )}
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>{t('privacySettings.public')}</Text>
                                <Text style={styles.radioSubtitle}>{t('privacySettings.publicSubtitle')}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.radioItem}
                            onPress={() => handleProfileVisibilityChange('private')}
                        >
                            <View style={styles.radio}>
                                {privacySettings.profileVisibility === 'private' && (
                                    <View style={styles.radioSelected} />
                                )}
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>{t('privacySettings.private')}</Text>
                                <Text style={styles.radioSubtitle}>{t('privacySettings.privateSubtitle')}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {!hideDeleteAccount && (
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={handleDeleteAccount}
                        >
                            <Text style={styles.dangerButtonText}>{t('privacySettings.deleteAccount')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default PrivacySettingsScreen;
