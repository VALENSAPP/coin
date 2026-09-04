import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import HexAvatar from '../../components/home/story.js/HexAvatar';
import { useToast } from 'react-native-toast-notifications';
import { cancelFanSubscription } from '../../services/wallet';

const CancelSubscriptionFlowScreen = ({ navigation, route }) => {
  const { subscription } = route.params || {};
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { bgStyle, textStyle, mutedTextStyle, accent, border, cardStyle } = useAppTheme();
  const { t } = useLanguage();
  const toast = useToast();

  const handleConfirmCancel = async () => {
    try {
      setLoading(true);
      const response = await cancelFanSubscription({ followingId: subscription.id, creatorId: subscription.id, contentUserId: subscription.id });
      console.log('cancelFanSubscription response:', response);
      setStep(3);
      if (route.params?.onCancelSuccess) {
        route.params.onCancelSuccess();
      }
    } catch (e) {
      console.log('cancelFanSubscription error:', e?.response?.data || e);
      const msg = e?.response?.data?.message || '';
      if (msg.toLowerCase().includes('already') && msg.toLowerCase().includes('cancel')) {
        // Treat as already canceled success
        setStep(3);
        if (route.params?.onCancelSuccess) {
          route.params.onCancelSuccess();
        }
      } else {
        toast.show(msg || 'Failed to cancel subscription', { type: 'danger' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const dummyDate = subscription?.nextBilling || 'Oct 3, 2026';
  const priceText = subscription?.price ? `$${subscription.price.toFixed(2)} / month` : '$21.00 / month';

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={[styles.card, { backgroundColor: cardStyle.backgroundColor, borderColor: border }]}>
        <View style={styles.profileRow}>
          <HexAvatar uri={subscription?.avatar || 'https://via.placeholder.com/50'} size={50} borderWidth={0} />
          <View style={styles.profileInfo}>
            <Text style={[styles.name, textStyle]}>{subscription?.name || 'Steven Austin'}</Text>
            <Text style={[styles.handle, mutedTextStyle]}>{subscription?.handle || '@stevenaustin'}</Text>
          </View>
        </View>

        <Text style={[styles.paragraph, textStyle]}>
          {t('cancelSubscription.step1_p1', 'Hi there!')}
        </Text>
        <Text style={[styles.paragraph, textStyle]}>
          {t('cancelSubscription.step1_p2', 'You are about to cancel your subscription to this creator.')}
        </Text>
        
        <View style={[styles.infoBox, { backgroundColor: `${accent}10` }]}>
          <Text style={[styles.infoBoxText, textStyle]}>
            {t('cancelSubscription.nextRenewal', 'Next renewal date:')}
          </Text>
          <Text style={[styles.dateText, textStyle, { color: accent }]}>{dummyDate}</Text>
        </View>

        <View style={styles.bulletRow}>
          <Ionicons name="checkmark" size={22} color={accent} />
          <Text style={[styles.bulletText, textStyle]}>
            {t('cancelSubscription.bullet1', 'You still get full access to my content.')}
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <TouchableOpacity style={[styles.outlineBtn, { borderColor: border }]} onPress={() => setStep(2)}>
            <Text style={[styles.outlineBtnText, textStyle]}>{t('cancelSubscription.cancelSubscriptionBtn', 'Cancel Subscription')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.centerHeader}>
        <View style={[styles.iconCircle, { backgroundColor: `${accent}15` }]}>
          <Ionicons name="close" size={32} color={accent} />
        </View>
        <Text style={[styles.title, textStyle, { color: accent }]}>
          {t('cancelSubscription.step2Title', 'Cancel Subscription?')}
        </Text>
        <Text style={[styles.subtitle, mutedTextStyle]}>
          {t('cancelSubscription.step2Subtitle', 'If you cancel now, your subscription will be canceled at the end of your current billing period.')}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardStyle.backgroundColor, borderColor: border }]}>
        <Text style={[styles.boxTitle, textStyle, { color: accent }]}>
          {t('cancelSubscription.yourCurrentAccess', 'Your current access')}
        </Text>
        
        <View style={styles.bulletRow}>
          <Ionicons name="lock-closed-outline" size={20} color={accent} />
          <View style={styles.bulletCopy}>
            <Text style={[styles.bulletText, textStyle]}>
              {t('cancelSubscription.keepAccessUntil', 'You will keep access until')}
            </Text>
            <Text style={[styles.bulletBold, textStyle]}>{dummyDate}.</Text>
          </View>
        </View>

        <View style={styles.bulletRow}>
          <Ionicons name="calendar-outline" size={20} color={accent} />
          <View style={styles.bulletCopy}>
            <Text style={[styles.bulletText, textStyle]}>
              {t('cancelSubscription.afterThat', 'After that, your subscription will end and you will lose access to this content.')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={handleConfirmCancel} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('cancelSubscription.yesCancel', 'Yes, Cancel')}</Text>
          )}
        </TouchableOpacity>
        {!loading && (
          <TouchableOpacity style={[styles.outlineBtn, { borderColor: border }]} onPress={handleBack}>
            <Text style={[styles.outlineBtnText, textStyle]}>{t('cancelSubscription.goBack', 'Go Back')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.centerHeader}>
        <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
          <Ionicons name="checkmark" size={32} color="#16a34a" />
        </View>
        <Text style={[styles.title, textStyle, { color: accent }]}>
          {t('cancelSubscription.step3Title', 'Cancellation Submitted')}
        </Text>
        <Text style={[styles.subtitle, mutedTextStyle]}>
          {t('cancelSubscription.step3Subtitle', "You've chosen to cancel your subscription.")}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: cardStyle.backgroundColor, borderColor: border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, mutedTextStyle]}>{t('cancelSubscription.subscription', 'Subscription')}</Text>
          <Text style={[styles.summaryValue, textStyle, { color: accent, fontWeight: '700' }]}>{subscription?.name || 'Steven Austin'}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, mutedTextStyle]}>{t('cancelSubscription.currentPrice', 'Current price')}</Text>
          <Text style={[styles.summaryValue, textStyle, { fontWeight: '700' }]}>{priceText}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, mutedTextStyle]}>{t('cancelSubscription.accessUntil', 'Access until')}</Text>
          <Text style={[styles.summaryValue, textStyle, { color: accent, fontWeight: '700' }]}>{dummyDate}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, mutedTextStyle]}>{t('cancelSubscription.status', 'Status')}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{t('cancelSubscription.willCancel', 'Will Cancel')}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.banner, { backgroundColor: `${accent}10` }]}>
        <Ionicons name="information-circle-outline" size={20} color={accent} />
        <Text style={[styles.bannerText, textStyle]}>
          {t('cancelSubscription.keepFullAccess', 'You will keep full access until')} <Text style={{fontWeight: '700'}}>{dummyDate}.</Text>
        </Text>
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryBtnText}>{t('cancelSubscription.backToDashboard', 'Back to Dashboard')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  let headerTitle = '';
  if (step === 1) headerTitle = t('cancelSubscription.header1', 'Cancel Subscription');
  if (step === 2) headerTitle = t('cancelSubscription.header2', 'Cancel Subscription?');
  if (step === 3) headerTitle = t('cancelSubscription.header3', 'Cancellation Submitted');

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
          <Ionicons name="chevron-back" size={24} color={textStyle.color} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 40 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  handle: {
    fontSize: 16,
    marginTop: 2,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  infoBoxText: {
    fontSize: 16,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bulletCopy: {
    flex: 1,
    marginLeft: 12,
  },
  bulletText: {
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 12,
  },
  bulletBold: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  outlineBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  centerHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  boxTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  bottomButtons: {
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 16,
  },
  statusBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  bannerText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    lineHeight: 24,
  },
});

export default CancelSubscriptionFlowScreen;
