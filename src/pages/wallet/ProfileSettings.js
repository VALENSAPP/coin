
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import styles from './Style';

const ProfileSettingsScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>TV</Text>
            </View>
            <TouchableOpacity style={styles.changePhotoButton}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
            //   value={profileData.displayName}
            //   onChangeText={(text) => setProfileData({ ...profileData, displayName: text })}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
            //   value={profileData.username}
            //   onChangeText={(text) => setProfileData({ ...profileData, username: text })}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
            //   value={profileData.email}
              keyboardType="email-address"
            //   onChangeText={(text) => setProfileData({ ...profileData, email: text })}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
            //   value={profileData.phone}
              keyboardType="phone-pad"
            //   onChangeText={(text) => setProfileData({ ...profileData, phone: text })}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  export default ProfileSettingsScreen;