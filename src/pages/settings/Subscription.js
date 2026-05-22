import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { cancelSubscription, checkSubscription } from '../../services/stirpe';
import { ScrollView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';

const Subscription = () => {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const navigation = useNavigation();
  const { bgStyle, textStyle, bg, text, card } = useAppTheme();
  const { t } = useLanguage();

  const themeColors = {
    bg,
    text,
    card,
    border: `${text}22`,
    subText: `${text}B0`,
    warning: '#FF6B35',
    warningBg: '#FFF4EA',
  };

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      const response = await checkSubscription();
      console.log(response, 'checkSubscription');
      if (response.success) {
        setSubscriptionData(response.data);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      Alert.alert(t('subscription.error'), t('subscription.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      t('subscription.cancelTitle'),
      t('subscription.cancelMessage'),
      [
        {
          text: t('subscription.keepSubscription'),
          style: 'cancel',
        },
        {
          text: t('subscription.yesCancel'),
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
        Alert.alert(t('subscription.success'), response.data.message);
        await loadSubscriptionData();
      } else {
        Alert.alert(t('subscription.error'), t('subscription.failedToCancel'));
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      Alert.alert(t('subscription.error'), t('subscription.failedToCancel'));
    } finally {
      setCancelling(false);
    }
  };

  const formatDateISO = isoString => {
    if (!isoString) return t('subscription.notAvailable');
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
    if (!endDate) return t('subscription.notAvailable');

    const now = new Date();
    const end = new Date(
      typeof endDate === 'string' ? endDate : endDate * 1000,
    );
    const diff = end - now;

    if (diff <= 0) return t('subscription.expired');

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return t('subscription.daysHoursRemaining', { days, hours });
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return t('subscription.hoursMinutesRemaining', { hours, minutes });
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
    if (subscription.subscription && subscription.subscription.status === 'CANCELED') {
      return t('subscription.cancelledActiveUntilPeriodEnd');
    }
    if (subscription.subscription) {
      return subscription.subscription.status;
    }
    return t('subscription.unknown');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, bgStyle]}>
        <ActivityIndicator size="large" color={themeColors.text} />
        <Text style={[styles.loadingText, textStyle]}>{t('subscription.loadingText')}</Text>
      </View>
    );
  }

  if (!subscriptionData) {
    return (
      <View style={[styles.errorContainer, bgStyle]}>
        <View style={[styles.errorCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Icon name="alert-circle-outline" size={64} color={themeColors.text} />
          <Text style={[styles.errorText, textStyle]}>{t('subscription.noDataFound')}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: themeColors.text }]}
            onPress={loadSubscriptionData}
          >
            <Text style={styles.retryButtonText}>{t('subscription.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isCancelledSubscription =
    subscriptionData.subscription && subscriptionData.subscription.status === 'CANCELED';
  const subscription = subscriptionData.subscription;

  const status = getStatusText(subscriptionData);
  const statusColor = getStatusColor(status, isCancelledSubscription);

  return (
    <View style={[styles.container, bgStyle]}>
      <View style={[styles.headerGradient, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, textStyle]}>{t('subscription.headerTitle')}</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </View>

      <ScrollView style={[styles.scrollContainer, bgStyle]} showsVerticalScrollIndicator={false}>

        {/* Status Card */}
        <View style={[styles.statusCard, { shadowColor: themeColors.text }]}>
          <View style={[styles.statusGradient, { backgroundColor: statusColor }]}>
            <View style={styles.statusContent}>
              <View style={styles.statusIconContainer}>
                <Icon
                  name={isCancelledSubscription ? 'warning' : 'checkmark-circle'}
                  size={32}
                  color="#fff"
                />
              </View>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          {isCancelledSubscription && (
            <View style={[styles.warningContainer, { backgroundColor: themeColors.warningBg, borderLeftColor: themeColors.warning }]}>
              <Icon name="warning" size={20} color={themeColors.warning} />
              <Text style={styles.warningText}>
                {t('subscription.cancelledWarningText')}
              </Text>
            </View>
          )}
        </View>

        {/* Plan Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: themeColors.card, shadowColor: themeColors.text }]}>
          <View style={styles.cardHeader}>
            <Icon name="card-outline" size={24} color={themeColors.text} />
            <Text style={[styles.cardTitle, textStyle]}>{t('subscription.planDetails')}</Text>
          </View>

          {isCancelledSubscription ? (
            <>
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="checkmark-circle" size={16} color={themeColors.warning} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.statusLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {subscription?.status || t('subscription.notAvailable')}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="calendar" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.startedLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.start)}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.currentPeriodEndsLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.currentPeriodEnd)}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="stopwatch" size={16} color={themeColors.warning} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.accessUntilLabel')}</Text>
                <Text style={[styles.detailValue, styles.highlightText, { color: themeColors.warning }]}>
                  {formatDateISO(subscription?.currentPeriodEnd)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.statusLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {subscription?.status || t('subscription.notAvailable')}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="calendar" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.startedLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.start)}
                </Text>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time" size={16} color={themeColors.text} />
                </View>
                <Text style={[styles.detailLabel, { color: themeColors.subText }]}>{t('subscription.subscriptionEndsLabel')}</Text>
                <Text style={[styles.detailValue, textStyle]}>
                  {formatDateISO(subscription?.currentPeriodEnd)}
                </Text>
              </View>
            </>
          )}

          <View style={[styles.timeRemainingContainer, { borderColor: themeColors.border }]}>
            <View style={[styles.timeRemainingGradient, { backgroundColor: themeColors.bg }]}>
              <Text style={[styles.timeRemainingLabel, { color: themeColors.subText }]}>{t('subscription.timeRemaining')}</Text>
              <Text style={[styles.timeRemainingValue, textStyle]}>
                {getTimeRemaining(subscription?.currentPeriodEnd)}
              </Text>
            </View>
          </View>
        </View>

        {/* Legal Links */}
        <View style={[styles.legalCard, { backgroundColor: themeColors.card, shadowColor: themeColors.text }]}>
          <View style={styles.cardHeader}>
            <Icon name="document-text" size={24} color={themeColors.text} />
            <Text style={[styles.cardTitle, textStyle]}>{t('subscription.importantInfo')}</Text>
          </View>

          <View style={styles.legalLinksRow}>
            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://valens.app/terms')}
            >
              <View style={[styles.legalLinkGradient, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}>
                <Icon name="document-text" size={16} color={themeColors.text} />
                <Text style={[styles.legalLinkText, textStyle]}>{t('subscription.termsConditions')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://valens.app/privacy-policy')}
            >
              <View style={[styles.legalLinkGradient, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}>
                <Icon name="shield-checkmark" size={16} color={themeColors.text} />
                <Text style={[styles.legalLinkText, textStyle]}>{t('subscription.privacyPolicy')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={[styles.legalLinksNote, { color: themeColors.subText }]}>
            {t('subscription.legalNote')}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!isCancelledSubscription && subscription?.status === 'ACTIVE' && (
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: themeColors.warning }]}
              onPress={handleCancelSubscription}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="close-circle" size={20} color="#fff" />
                  <Text style={styles.cancelButtonText}>{t('subscription.cancelButton')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: themeColors.text }]}
            onPress={loadSubscriptionData}
          >
            <Icon name="refresh" size={20} color="#fff" />
            <Text style={styles.refreshButtonText}>{t('subscription.refreshButton')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
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
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
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
    padding: 16,
    borderLeftWidth: 4,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
    color: '#8A4B16',
  },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 16,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontWeight: '500',
    paddingRight: 8,
    lineHeight: 22,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    textAlign: 'right',
    lineHeight: 22,
  },
  highlightText: {
    fontWeight: 'bold',
  },
  timeRemainingContainer: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  timeRemainingGradient: {
    padding: 20,
    alignItems: 'center',
  },
  timeRemainingLabel: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
  },
  timeRemainingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  legalCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
    gap: 10,
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
    borderWidth: 1,
  },
  legalLinkText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  legalLinksNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  cancelButton: {
    marginBottom: 12,
    borderRadius: 25,
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
