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
import { useLanguage } from '../../i18n';

const LoginHistoryScreen = () => {
    const [loginHistory, setLoginHistory] = useState([]);
    const dispatch = useDispatch();
    const toast = useToast();
    const { bgStyle, textStyle } = useAppTheme();
    const { t } = useLanguage();

    useEffect(() => {
        fetchLoginHistory();
    }, [fetchLoginHistory]);

    // Format date/time relative to now using translation strings
    const formatLoginTime = (loginDate) => {
        const date = new Date(loginDate);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) {
            const count = Math.floor(diffMs / (1000 * 60));
            return count === 1
                ? t('loginHistory.time.minuteAgo').replace('{{count}}', count)
                : t('loginHistory.time.minutesAgo').replace('{{count}}', count);
        } else if (diffHours < 24) {
            const count = diffHours;
            return count === 1
                ? t('loginHistory.time.hourAgo').replace('{{count}}', count)
                : t('loginHistory.time.hoursAgo').replace('{{count}}', count);
        } else if (diffDays === 1) {
            const timeStr = date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
            return t('loginHistory.time.yesterday').replace('{{time}}', timeStr);
        } else {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
        }
    };

    const normalizeSession = useCallback((session = {}, index = 0) => {
        const sessionId =
            session?.sessionId ?? session?.id ?? session?._id ?? session?.tokenId ?? null;
        const deviceName =
            session?.device_name ??
            session?.deviceName ??
            session?.device?.name ??
            session?.device?.deviceName ??
            t('loginHistory.defaultDevice');
        const deviceType =
            session?.device_type ??
            session?.deviceType ??
            session?.systemName ??
            session?.device?.type ??
            session?.device?.systemName ??
            '';
        const deviceLabel = deviceType ? `${deviceName} • ${deviceType}` : deviceName;

        const deviceId = session?.deviceId ?? session?.device_id ?? '';
        const ipAddress = session?.ipAddress ?? session?.ip ?? session?.ip_address ?? '';
        const userAgent = session?.userAgent ?? session?.user_agent ?? '';
        const locationName = session?.locationName ?? session?.location_name ?? '';
        const location = session?.location ?? '';
        const resolvedDeviceLabel =
            deviceLabel === t('loginHistory.defaultDevice') && userAgent
                ? userAgent
                : deviceLabel;

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
            session?.isActive,
        );

        return {
            id: sessionId || `session-${index}`,
            sessionId: sessionId || null,
            device: resolvedDeviceLabel,
            deviceId: String(deviceId || ''),
            ipAddress: String(ipAddress || ''),
            userAgent: String(userAgent || ''),
            locationName: String(locationName || ''),
            location: String(location || ''),
            time: formatLoginTime(rawDate || new Date().toISOString()),
            status: isCurrent ? 'current' : 'success',
            raw: session,
        };
    }, [t]);

    const fetchLoginHistory = useCallback(async () => {
        try {
            dispatch(showLoader());
            const id = await AsyncStorage.getItem('userId');
            const response = await authSesionHistory(id ? { userId: id } : {});
            console.log(response, 'data in this api fro deive logins infos ');

            if (response?.statusCode === 200) {
                const sessionsPayload =
                    response?.data?.sessions ??
                    response?.data?.data?.sessions ??
                    response?.data?.data ??
                    response?.data ??
                    [];

                const sessions = Array.isArray(sessionsPayload) ? sessionsPayload : [];
                let transformed = sessions.map((session, index) =>
                    normalizeSession(session, index),
                );

                if (
                    transformed.length > 0 &&
                    !transformed.some((s) => s.status === 'current')
                ) {
                    transformed = transformed.map((entry, idx) =>
                        idx === 0 ? { ...entry, status: 'current' } : entry,
                    );
                }

                setLoginHistory(transformed);
            } else {
                showToastMessage(
                    toast,
                    'danger',
                    response?.data?.message ||
                        response?.message ||
                        t('loginHistory.toast.fetchFailed'),
                );
            }
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.data?.message ??
                    error?.message ??
                    t('loginHistory.toast.genericError'),
            );
        } finally {
            dispatch(hideLoader());
        }
    }, [dispatch, normalizeSession, toast, t]);

    const handleLogoutDevice = useCallback(
        (session) => {
            const sessionId = session?.sessionId || session?.id;
            if (!sessionId) return;

            Alert.alert(
                t('loginHistory.alert.logoutDeviceTitle'),
                t('loginHistory.alert.logoutDeviceMessage'),
                [
                    { text: t('loginHistory.alert.cancel'), style: 'cancel' },
                    {
                        text: t('loginHistory.alert.logoutConfirm'),
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                dispatch(showLoader());
                                const response = await logoutDeviec({ sessionId, id: sessionId });
                                if (response?.statusCode === 200) {
                                    showToastMessage(
                                        toast,
                                        'success',
                                        response?.data?.message || t('loginHistory.toast.logoutSuccess'),
                                    );
                                    fetchLoginHistory();
                                } else {
                                    showToastMessage(
                                        toast,
                                        'danger',
                                        response?.data?.message ||
                                            response?.message ||
                                            t('loginHistory.toast.logoutFailed'),
                                    );
                                }
                            } catch (error) {
                                showToastMessage(
                                    toast,
                                    'danger',
                                    error?.response?.data?.message ??
                                        error?.message ??
                                        t('loginHistory.toast.genericError'),
                                );
                            } finally {
                                dispatch(hideLoader());
                            }
                        },
                    },
                ],
            );
        },
        [dispatch, fetchLoginHistory, toast, t],
    );

    const handleLogoutAllOtherDevices = useCallback(() => {
        Alert.alert(
            t('loginHistory.alert.logoutAllTitle'),
            t('loginHistory.alert.logoutAllMessage'),
            [
                { text: t('loginHistory.alert.cancel'), style: 'cancel' },
                {
                    text: t('loginHistory.alert.logoutConfirm'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            dispatch(showLoader());
                            const response = await logoutDeviecAll();
                            if (response?.statusCode === 200) {
                                showToastMessage(
                                    toast,
                                    'success',
                                    response?.data?.message || t('loginHistory.toast.logoutAllSuccess'),
                                );
                                fetchLoginHistory();
                            } else {
                                showToastMessage(
                                    toast,
                                    'danger',
                                    response?.data?.message ||
                                        response?.message ||
                                        t('loginHistory.toast.logoutAllFailed'),
                                );
                            }
                        } catch (error) {
                            showToastMessage(
                                toast,
                                'danger',
                                error?.response?.data?.message ??
                                    error?.message ??
                                    t('loginHistory.toast.genericError'),
                            );
                        } finally {
                            dispatch(hideLoader());
                        }
                    },
                },
            ],
        );
    }, [dispatch, fetchLoginHistory, toast, t]);

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <StatusBar barStyle="dark-content" />
            <ScrollView style={styles.content}>
                <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>{t('loginHistory.sectionTitle')}</Text>
                    {loginHistory.length > 0 ? (
                        loginHistory.map((login, index) => (
                            <View key={login.id || index} style={styles.loginItem}>
                                <View style={styles.loginLeft}>
                                    <View
                                        style={[
                                            styles.loginStatusDot,
                                            login.status === 'current' && styles.loginStatusCurrent,
                                            login.status === 'success' && styles.loginStatusSuccess,
                                            login.status === 'failed' && styles.loginStatusFailed,
                                        ]}
                                    />
                                    <View>
                                        <Text style={styles.loginDevice}>{login.device}</Text>
                                        {!!(login.locationName || login.location) && (
                                            <Text style={[styles.loginLocation, { paddingRight: 12 }]}>
                                                {login.locationName || login.location}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                {login.status === 'current' ? (
                                    <View style={styles.currentBadge}>
                                        <Text style={styles.currentText}>
                                            {t('loginHistory.currentBadge')}
                                        </Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.sessionLogoutButton}
                                        onPress={() => handleLogoutDevice(login)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.sessionLogoutText}>
                                            {t('loginHistory.logoutDevice')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>{t('loginHistory.emptyState')}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogoutAllOtherDevices}
                    >
                        <Text style={styles.logoutButtonText}>
                            {t('loginHistory.logoutAllButton')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default LoginHistoryScreen;