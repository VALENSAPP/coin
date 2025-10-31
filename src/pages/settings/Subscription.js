import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { cancelSubscription, checkSubscription } from '../../services/stirpe';
import { ScrollView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');

const Subscription = () => {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const navigation = useNavigation();
  useEffect(() => {
    loadSubscriptionData();
  }, []);
  
  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      const response = await checkSubscription();
      console.log(response,'checkSubscription');
      if (response.success) {
        setSubscriptionData(response.data);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.',
      [
        {
          text: 'No, Keep Subscription',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: confirmCancellation,
        },
      ],
    );
  };

  const confirmCancellation = async () => {
    try {
      setCancelling(true);
      const response = await cancelSubscription();
      if (response.success) {
        Alert.alert('Success', response.data.message);
        await loadSubscriptionData();
      } else {
        Alert.alert('Error', 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      Alert.alert('Error', 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = timestamp => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateISO = isoString => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = endDate => {
    if (!endDate) return 'N/A';

    const now = new Date();
    const end = new Date(
      typeof endDate === 'string' ? endDate : endDate * 1000,
    );
    const diff = end - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} days, ${hours} hours remaining`;
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours} hours, ${minutes} minutes remaining`;
    }
  };

  const getStatusColor = (status, isCancelled) => {
    if (isCancelled) return '#FF6B35';
    switch (status?.toLowerCase()) {
      case 'active':
        return '#4CAF50';
      case 'canceled':
      case 'cancelled':
        return '#f44336';
      case 'past_due':
        return '#ff9800';
      default:
        return '#757575';
    }
  };

  const getStatusText = subscription => {
    if (subscription.subscription && subscription.subscription.status === "CANCELED") {
      return 'CANCELLED - Active Until Period End';
    }
    if (subscription.subscription) {
      return subscription.subscription.status;
    }
    return 'Unknown';
  };

  const getCancelledMessage = subscription => {
    if (subscription.subscription && subscription.subscription.status === "CANCELED") {
      return `You can use your subscription until ${formatDate(subscription.subscription.currentPeriodEnd)}`;
    }
    return '';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading subscription details...</Text>
        </LinearGradient>
      </View>
    );
  }

  if (!subscriptionData) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.errorGradient}
        >
          <Icon name="alert-circle-outline" size={64} color="#fff" />
        <Text style={styles.errorText}>No subscription data found</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadSubscriptionData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  const isCancelledSubscription = 
    subscriptionData.subscription && subscriptionData.subscription.status === "CANCELED";
  const subscription = subscriptionData.subscription;

  const status = getStatusText(subscriptionData);
  const statusColor = getStatusColor(status, isCancelledSubscription);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.headerGradient}
      >
      <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
          <Text style={styles.headerTitle}>Subscription Details</Text>
          <View style={styles.headerPlaceholder} />
      </View>
      </LinearGradient>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      {/* Status Card */}
        <View style={styles.statusCard}>
          <LinearGradient
            colors={[statusColor, statusColor + '80']}
            style={styles.statusGradient}
          >
            <View style={styles.statusContent}>
              <View style={styles.statusIconContainer}>
                <Icon 
                  name={isCancelledSubscription ? "warning" : "checkmark-circle"} 
                  size={32} 
                  color="#fff" 
                />
              </View>
              <Text style={styles.statusText}>{status}</Text>
        </View>
          </LinearGradient>

        {isCancelledSubscription && (
          <View style={styles.warningContainer}>
              <Icon name="warning" size={20} color="#FF6B35" />
            <Text style={styles.warningText}>
                Your subscription has been cancelled but you can use subscription until the end of your billing period.
            </Text>
          </View>
        )}
      </View>

      {/* Plan Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.cardHeader}>
            <Icon name="card-outline" size={24} color="#667eea" />
        <Text style={styles.cardTitle}>Plan Details</Text>
          </View>

        {isCancelledSubscription ? (
          <>
            <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="checkmark-circle" size={16} color="#FF6B35" />
                </View>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>
                {subscription?.status || 'N/A'}
              </Text>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="calendar" size={16} color="#667eea" />
                </View>
              <Text style={styles.detailLabel}>Started:</Text>
              <Text style={styles.detailValue}>
                {formatDateISO(subscription?.start)}
              </Text>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time" size={16} color="#667eea" />
                </View>
              <Text style={styles.detailLabel}>Current Period Ends:</Text>
              <Text style={styles.detailValue}>
                {formatDateISO(subscription?.currentPeriodEnd)}
              </Text>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="stopwatch" size={16} color="#FF6B35" />
                </View>
              <Text style={styles.detailLabel}>Access Until:</Text>
              <Text style={[styles.detailValue, styles.highlightText]}>
                {formatDateISO(subscription?.currentPeriodEnd)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                </View>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>
                {subscription?.status || 'N/A'}
              </Text>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="calendar" size={16} color="#667eea" />
                </View>
              <Text style={styles.detailLabel}>Started:</Text>
              <Text style={styles.detailValue}>
                {formatDateISO(subscription?.start)}
              </Text>
            </View>

            <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time" size={16} color="#667eea" />
                </View>
              <Text style={styles.detailLabel}>Subscription Ends:</Text>
              <Text style={styles.detailValue}>
                {formatDateISO(subscription?.currentPeriodEnd)}
              </Text>
            </View>
            </>
          )}

            <View style={styles.timeRemainingContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.timeRemainingGradient}
            >
              <Icon name="clock" size={24} color="#fff" />
              <Text style={styles.timeRemainingLabel}>Time Remaining</Text>
              <Text style={styles.timeRemainingValue}>
                {getTimeRemaining(
                  isCancelledSubscription 
                    ? subscription?.currentPeriodEnd
                    : subscription?.currentPeriodEnd
                )}
              </Text>
            </LinearGradient>
            </View>
      </View>

      {/* Legal Links */}
        <View style={styles.legalCard}>
          <View style={styles.cardHeader}>
            <Icon name="document-text" size={24} color="#667eea" />
            <Text style={styles.cardTitle}>Important Information</Text>
          </View>
          
        <View style={styles.legalLinksRow}>
          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://www.valens.app/terms-conditions')}
          >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.legalLinkGradient}
              >
                <Icon name="document-text" size={16} color="#fff" />
            <Text style={styles.legalLinkText}>Terms & Conditions</Text>
              </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://www.valens.app/privacy-policy')}
          >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.legalLinkGradient}
              >
                <Icon name="shield-checkmark" size={16} color="#fff" />
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </LinearGradient>
          </TouchableOpacity>
        </View>
          
        <Text style={styles.legalLinksNote}>
          Please review our terms and privacy policy before making changes to your subscription.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>

        {!isCancelledSubscription && subscription?.status === 'ACTIVE' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
            disabled={cancelling}
            >
              <LinearGradient
                colors={['#ff6b35', '#f7931e']}
                style={styles.cancelButtonGradient}
          >
            {cancelling ? (
              <ActivityIndicator color="#fff" />
            ) : (
                  <>
                    <Icon name="close-circle" size={20} color="#fff" />
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                  </>
            )}
              </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadSubscriptionData}
        >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.refreshButtonGradient}
            >
              <Icon name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
            </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#f8f2fd'
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
  },
  errorGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  statusGradient: {
    padding: 20,
  },
  statusContent: {
    alignItems: 'center',
  },
  statusIconContainer: {
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  highlightText: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  timeRemainingContainer: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timeRemainingGradient: {
    padding: 20,
    alignItems: 'center',
  },
  timeRemainingLabel: {
    fontSize: 14,
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
  },
  timeRemainingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  legalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  legalLinksRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap:10 
  },
  legalLink: {
    flex: 1,
    marginHorizontal: 4,
  },
  legalLinkGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
  },
  legalLinkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  legalLinksNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  upgradeButton: {
    marginBottom: 12,
    borderRadius: 25,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButton: {
    marginBottom: 12,
    borderRadius: 25,
    overflow: 'hidden',
  },
  cancelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  refreshButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  refreshButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
 
});

export default Subscription;
