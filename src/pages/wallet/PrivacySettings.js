import React from 'react';
import {
    View,
    Text,
    ScrollView,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Switch,
} from 'react-native';
import styles from './Style';

const PrivacySettingsScreen = () => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ScrollView style={styles.content}>
                <View style={[styles.section, {  marginTop: 20}]}>
                    <Text style={styles.sectionTitle}>Profile Visibility</Text>
                    <View style={styles.radioGroup}>
                        <TouchableOpacity
                            style={styles.radioItem}
                            // onPress={() => setPrivacySettings({ ...privacySettings, profileVisibility: 'public' })}
                        >
                            <View style={styles.radio}>
                                {/* {privacySettings.profileVisibility === 'public' && <View style={styles.radioSelected} />} */}
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>Public</Text>
                                <Text style={styles.radioSubtitle}>Anyone can view your profile</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.radioItem}
                            // onPress={() => setPrivacySettings({ ...privacySettings, profileVisibility: 'private' })}
                        >
                            <View style={styles.radio}>
                                {/* {privacySettings.profileVisibility === 'private' && <View style={styles.radioSelected} />} */}
                            </View>
                            <View>
                                <Text style={styles.radioTitle}>Private</Text>
                                <Text style={styles.radioSubtitle}>Only you can view your profile</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Information Visibility</Text>
                    <View style={styles.toggleItem}>
                        <View>
                            <Text style={styles.toggleTitle}>Show Email Address</Text>
                            <Text style={styles.toggleSubtitle}>Display email on profile</Text>
                        </View>
                        <Switch
                            // value={privacySettings.showEmail}
                            // onValueChange={(value) => setPrivacySettings({ ...privacySettings, showEmail: value })}
                            trackColor={{ false: '#E5E5EA', true: '#5B21B6' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                    <View style={styles.toggleItem}>
                        <View>
                            <Text style={styles.toggleTitle}>Show Investments</Text>
                            <Text style={styles.toggleSubtitle}>Display portfolio publicly</Text>
                        </View>
                        <Switch
                            // value={privacySettings.showInvestments}
                            // onValueChange={(value) => setPrivacySettings({ ...privacySettings, showInvestments: value })}
                            trackColor={{ false: '#E5E5EA', true: '#5B21B6' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View> */}

                <View style={styles.section}>
                    <TouchableOpacity style={styles.dangerButton}>
                        <Text style={styles.dangerButtonText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
};

export default PrivacySettingsScreen;