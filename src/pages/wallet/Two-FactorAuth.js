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

const TwoFactorAuthScreen = () => {
    const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
    const [biometricEnabled, setBiometricEnabled] = React.useState(false);
    
    return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🔐</Text>
          <Text style={styles.infoTitle}>Secure Your Account</Text>
          <Text style={styles.infoDescription}>
            Two-factor authentication adds an extra layer of security to your account
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.toggleItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Enable 2FA</Text>
              <Text style={styles.toggleSubtitle}>Require code with password</Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={setTwoFactorEnabled}
              trackColor={{ false: '#E5E5EA', true: '#5B21B6' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {twoFactorEnabled && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Authentication Methods</Text>
              <TouchableOpacity style={styles.methodItem}>
                <View style={styles.methodLeft}>
                  <Text style={styles.methodIcon}>📱</Text>
                  <View>
                    <Text style={styles.methodTitle}>Authenticator App</Text>
                    <Text style={styles.methodSubtitle}>Use Google Authenticator or similar</Text>
                  </View>
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.methodItem}>
                <View style={styles.methodLeft}>
                  <Text style={styles.methodIcon}>💬</Text>
                  <View>
                    <Text style={styles.methodTitle}>SMS Verification</Text>
                    <Text style={styles.methodSubtitle}>Receive codes via text message</Text>
                  </View>
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Backup Options</Text>
              <View style={styles.toggleItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Biometric Authentication</Text>
                  <Text style={styles.toggleSubtitle}>Face ID or Fingerprint</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={setBiometricEnabled}
                  trackColor={{ false: '#E5E5EA', true: '#5B21B6' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <TouchableOpacity style={styles.methodItem}>
                <View style={styles.methodLeft}>
                  <Text style={styles.methodIcon}>🔑</Text>
                  <View>
                    <Text style={styles.methodTitle}>Backup Codes</Text>
                    <Text style={styles.methodSubtitle}>Generate recovery codes</Text>
                  </View>
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
};

  export default TwoFactorAuthScreen;