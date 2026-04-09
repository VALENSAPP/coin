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
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';
import { authSesionHistory, logoutDeviec, logoutDeviecAll } from '../../services/wallet';
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
    }, [fetchLoginHistory]);

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

    const normalizeSession = useCallback((session = {}, index = 0) => {
        const sessionId = session?.sessionId ?? session?.id ?? session?._id ?? session?.tokenId ?? null;
        const deviceName = session?.device_name ?? session?.deviceName ?? session?.device?.name ?? session?.device?.deviceName ?? 'Device';
        const deviceType = session?.device_type ?? session?.deviceType ?? session?.systemName ?? session?.device?.type ?? session?.device?.systemName ?? '';
        const deviceLabel = deviceType ? `${deviceName} • ${deviceType}` : deviceName;

        const deviceId = session?.deviceId ?? session?.device_id ?? '';
        const ipAddress = session?.ipAddress ?? session?.ip ?? session?.ip_address ?? '';
        const userAgent = session?.userAgent ?? session?.user_agent ?? '';
        const resolvedDeviceLabel = (deviceLabel === 'Device' && userAgent) ? userAgent : deviceLabel;

        const rawDate =
            session?.lastActiveAt ??
            session?.lastLoginAt ??
            session?.updatedAt ??
            session?.createdAt ??
            session?.loginDate ??
            null;

        const isCurrent = Boolean(
            session?.isCurrent ??
            session?.current ??
            session?.active ??
            session?.isActive
        );

        return {
            id: sessionId || `session-${index}`,
            sessionId: sessionId || null,
            device: resolvedDeviceLabel,
            deviceId: String(deviceId || ''),
            ipAddress: String(ipAddress || ''),
            userAgent: String(userAgent || ''),
            time: formatLoginTime(rawDate || new Date().toISOString()),
            status: isCurrent ? 'current' : 'success',
            raw: session,
        };
    }, []);

    const fetchLoginHistory = useCallback(async () => {
        try {
            dispatch(showLoader());
            const id = await AsyncStorage.getItem('userId');
            const response = await authSesionHistory(id ? { userId: id } : {});
            if (response?.statusCode === 200) {
                const sessionsPayload =
                    response?.data?.sessions ??
                    response?.data?.data?.sessions ??
                    response?.data?.data ??
                    response?.data ??
                    [];

                const sessions = Array.isArray(sessionsPayload) ? sessionsPayload : [];
                let transformed = sessions.map((session, index) => normalizeSession(session, index));

                if (transformed.length > 0 && !transformed.some((s) => s.status === 'current')) {
                    transformed = transformed.map((entry, idx) => (idx === 0 ? { ...entry, status: 'current' } : entry));
                }

                setLoginHistory(transformed);
            } else {
                showToastMessage(toast, 'danger', response?.data?.message || response?.message || 'Failed to load sessions');
            }
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.data?.message ?? error?.message ?? 'Something went wrong',
            );
        } finally {
            dispatch(hideLoader());
        }
    }, [dispatch, normalizeSession, toast]);

    const handleLogoutDevice = useCallback((session) => {
        const sessionId = session?.sessionId || session?.id;
        if (!sessionId) return;

        Alert.alert(
            'Log out device',
            'Are you sure you want to log out this device?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            dispatch(showLoader());
                            const response = await logoutDeviec({ sessionId, id: sessionId });
                            if (response?.statusCode === 200) {
                                showToastMessage(toast, 'success', response?.data?.message || 'Device logged out');
                                fetchLoginHistory();
                            } else {
                                showToastMessage(toast, 'danger', response?.data?.message || response?.message || 'Failed to log out device');
                            }
                        } catch (error) {
                            showToastMessage(toast, 'danger', error?.response?.data?.message ?? error?.message ?? 'Something went wrong');
                        } finally {
                            dispatch(hideLoader());
                        }
                    }
                }
            ]
        );
    }, [dispatch, fetchLoginHistory, toast]);

    const handleLogoutAllOtherDevices = useCallback(() => {
        Alert.alert(
            'Log out other devices',
            'This will log you out from all other devices. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            dispatch(showLoader());
                            const response = await logoutDeviecAll();
                            if (response?.statusCode === 200) {
                                showToastMessage(toast, 'success', response?.data?.message || 'Logged out other devices');
                                fetchLoginHistory();
                            } else {
                                showToastMessage(toast, 'danger', response?.data?.message || response?.message || 'Failed to log out devices');
                            }
                        } catch (error) {
                            showToastMessage(toast, 'danger', error?.response?.data?.message ?? error?.message ?? 'Something went wrong');
                        } finally {
                            dispatch(hideLoader());
                        }
                    }
                }
            ]
        );
    }, [dispatch, fetchLoginHistory, toast]);

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
                                        {!!login.deviceId && <Text style={styles.loginLocation}>DeviceId:{login.deviceId}</Text>}
                                        {!!login.ipAddress && <Text style={styles.loginLocation}>IpAdress:{login.ipAddress}</Text>}
                                        {/* {!!login.userAgent && <Text style={styles.loginLocation}>{login.userAgent}</Text>} */}
                                        {/* <Text style={styles.loginTime}>{login.time}</Text> */}
                                    </View>
                                </View>
                                {login.status === 'current' ? (
                                    <View style={styles.currentBadge}>
                                        <Text style={styles.currentText}>Current</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.sessionLogoutButton}
                                        onPress={() => handleLogoutDevice(login)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.sessionLogoutText}>Log out</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No login history available</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutAllOtherDevices}>
                        <Text style={styles.logoutButtonText}>Log Out All Other Devices</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

export default LoginHistoryScreen;
