import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
} from 'react-native';
import styles from './Style';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import { authLoginHistory } from '../../services/wallet';
import { showToastMessage } from '../../components/displaytoastmessage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../theme/useApptheme';

const LoginHistoryScreen = () => {
    const [loginHistory, setLoginHistory] = useState([]);
    const dispatch = useDispatch();
    const toast = useToast();
    const { bgStyle, textStyle } = useAppTheme();

    useEffect(() => {
        fetchLoginHistory();
    }, []);

    // Helper function to format the date/time
    const formatLoginTime = (loginDate) => {
        const date = new Date(loginDate);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        } else if (diffDays === 1) {
            return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        } else {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
    };

    const fetchLoginHistory = async () => {
        try {
            dispatch(showLoader());
            const id = await AsyncStorage.getItem('userId');
            const dataToSend = { userId: id };

            const response = await authLoginHistory(dataToSend);
            if (response?.statusCode === 200) {
                // Transform API data to match UI requirements
                const transformedHistory = response.data.loginHistory?.map((login, index) => ({
                    id: login.id,
                    userId: login.userId,
                    device: 'Device', // Since device info not available from API
                    location: 'Location not available', // Since location not available from API
                    time: formatLoginTime(login.loginDate),
                    status: index === 0 ? 'current' : 'success', // Mark first as current
                    rawDate: login.loginDate
                })) || [];
                
                setLoginHistory(transformedHistory);
            } else {
                showToastMessage(toast, 'danger', response.data.message);
            }
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.message ?? 'Something went wrong',
            );
        } finally {
            dispatch(hideLoader());
        }
    };

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <StatusBar barStyle="dark-content" />
            <ScrollView style={styles.content}>
                <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    {loginHistory.length > 0 ? (
                        loginHistory.map((login, index) => (
                            <View key={login.id || index} style={styles.loginItem}>
                                <View style={styles.loginLeft}>
                                    <View style={[
                                        styles.loginStatusDot,
                                        login.status === 'current' && styles.loginStatusCurrent,
                                        login.status === 'success' && styles.loginStatusSuccess,
                                        login.status === 'failed' && styles.loginStatusFailed,
                                    ]} />
                                    <View>
                                        <Text style={styles.loginDevice}>{login.device}</Text>
                                        <Text style={styles.loginLocation}>{login.location}</Text>
                                        <Text style={styles.loginTime}>{login.time}</Text>
                                    </View>
                                </View>
                                {login.status === 'current' ? (
                                    <View style={styles.currentBadge}>
                                        <Text style={styles.currentText}>Current</Text>
                                    </View>
                                ) : login.status === 'failed' ? (
                                    <View style={styles.failedBadge}>
                                        <Text style={styles.failedText}>Failed</Text>
                                    </View>
                                ) : null}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No login history available</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <TouchableOpacity style={styles.logoutButton}>
                        <Text style={styles.logoutButtonText}>Log Out All Other Devices</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

export default LoginHistoryScreen;