import React from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
} from 'react-native';
import styles from './Style';

const LoginHistoryScreen = () => {
    const loginHistory = [
        { device: 'iPhone 14 Pro', location: 'Mohali, Punjab', time: '2 hours ago', status: 'current' },
        { device: 'MacBook Pro', location: 'Chandigarh, Punjab', time: 'Yesterday at 3:45 PM', status: 'success' },
        { device: 'iPad Air', location: 'Mohali, Punjab', time: 'Nov 8, 2025 at 10:30 AM', status: 'success' },
        { device: 'Unknown Device', location: 'New Delhi, India', time: 'Nov 5, 2025 at 2:15 PM', status: 'failed' },
        { device: 'iPhone 16 Pro', location: 'Mohali, Punjab', time: '2 hours ago', status: 'current' },
        { device: 'MacBook M2', location: 'Chandigarh, Punjab', time: 'Yesterday at 3:45 PM', status: 'success' },
        { device: 'Samsung S13', location: 'Mohali, Punjab', time: 'Nov 8, 2025 at 10:30 AM', status: 'success' },
        { device: 'Unknown Device', location: 'New Delhi, India', time: 'Nov 5, 2025 at 2:15 PM', status: 'failed' },
    ];
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ScrollView style={styles.content}>
                <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    {loginHistory.map((login, index) => (
                        <View key={index} style={styles.loginItem}>
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
                    ))}
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