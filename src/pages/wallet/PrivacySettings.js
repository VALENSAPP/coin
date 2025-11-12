import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Switch,
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

const PrivacySettingsScreen = () => {
    const dispatch = useDispatch();
    const toast = useToast();

    const [privacySettings, setPrivacySettings] = useState({
        profileVisibility: 'public',
    });

    const updateProfileStatus = async (status) => {
        dispatch(showLoader());
        try {
            const dataToSend = { profileStatus: status };
            const resp = await userProfileStatusSet(dataToSend);
            if (resp?.statusCode === 200) {
                setPrivacySettings({ ...privacySettings, profileVisibility: status });
                showToastMessage(toast, 'success', 'Privacy settings updated successfully');
            } else {
                showToastMessage(toast, 'danger', resp?.message || 'Failed to update settings');
            }
        } catch (e) {
            showToastMessage(toast, 'danger', 'An error occurred while updating settings');
        } finally {
            dispatch(hideLoader());
        }
    };

    const handleProfileVisibilityChange = (visibility) => {
        updateProfileStatus(visibility);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // Implement delete account logic here
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
                dispatch(loggedOut());
            } else {
                showToastMessage(toast, 'danger', resp?.message || 'Failed to delete account');
            }
        } catch (e) {
            showToastMessage(toast, 'danger', 'An error occurred while deleting account');
        } finally {
            dispatch(hideLoader());
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ScrollView style={styles.content}>
                <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>Profile Visibility</Text>
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
                                <Text style={styles.radioTitle}>Public</Text>
                                <Text style={styles.radioSubtitle}>Anyone can view your profile</Text>
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
                                <Text style={styles.radioTitle}>Private</Text>
                                <Text style={styles.radioSubtitle}>Only you can view your profile</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={handleDeleteAccount}
                    >
                        <Text style={styles.dangerButtonText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default PrivacySettingsScreen;