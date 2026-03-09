import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const BusinessPlanModal = ({ visible, onActivate, onContinue, onClose }) => {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Your Business Mission Starts Here</Text>

          <Text style={styles.message}>
            Valens was built for businesses that want more than followers.
            {'\n\n'}
            Activate your Business Plan to unlock mission posts, subscriber channels, brand analytics, and tools designed to turn attention into real engagement.
          </Text>

          <Text style={styles.price}>Business Plan: $9.90/month</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={onActivate}>
            <Text style={styles.primaryText}>Activate Business Tools</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onContinue}>
            <Text style={styles.secondaryText}>Continue with Basic Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const BusinessReminderModal = ({ visible, onUpgrade, onContinue, onClose }) => {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Business Plan - $9.90/month</Text>

          <Text style={styles.message}>
            You can continue with a basic business profile, but some features will remain locked until you activate the Business Plan.
            {'\n\n'}
            Without the Business Plan you will not have access to:
            {'\n'}* Verification badge (Dragonfly)
            {'\n'}* Mission Posts to engage your audience
            {'\n'}* Private subscription content for followers
            {'\n'}* Marketplace visibility
            {'\n'}* Battle participation
            {'\n'}* Advanced business analytics
            {'\n\n'}
            Activate the Business Plan to unlock the full Valens experience.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={onUpgrade}>
            <Text style={styles.primaryText}>Unlock Business Features</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onContinue}>
            <Text style={styles.secondaryText}>Continue with Limited Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const BusinessSuccessModal = ({ visible }) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Congratulations - Your Business Plan is Active</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
    color: '#111827',
  },
  message: {
    fontSize: 14,
    color: '#444',
    marginBottom: 15,
    lineHeight: 20,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#111827',
  },
  primaryBtn: {
    backgroundColor: '#4d2a88',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  secondaryBtn: {
    padding: 10,
  },
  secondaryText: {
    textAlign: 'center',
    color: '#666',
    fontWeight: '500',
  },
});
