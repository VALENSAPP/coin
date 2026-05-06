// CreatorCoinScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  Keyboard,
  ActivityIndicator,
  Linking,
  Modal,
  DeviceEventEmitter,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import UnverifiedProfileModal from '../../components/modals/Unverifiedmodal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { getUserCredentials, getUserDashboard } from '../../services/post';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../theme/useApptheme';
import WithdrawalModal from '../../components/modals/WithdrawModal';
import RBSheet from 'react-native-raw-bottom-sheet';
import { getOnboardingStatus, getWithdrawalHistory } from '../../services/profile';
import { openStripeOnboarding, STRIPE_ERROR_MESSAGES } from '../../utils/stripeOnboarding';
import ConnectStripeModal from '../../components/modals/ConnectStripeModal';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useLanguage } from '../../i18n';

const ITEMS_PER_PAGE = 10;

export default function CreatorCoin() {
  const [data, setData] = useState();
  const [userDashboard, setUserDashboard] = useState();
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [displayedTransactions, setDisplayedTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showConnectStripeModal, setShowConnectStripeModal] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState(null);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  const navigation = useNavigation();
  const toast = useToast();
  const userId = '';
  const dispatch = useDispatch();
  const withdrawSheetRef = useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();
  const { t } = useLanguage();

  const copyToClipboard = () => {
    Clipboard.setString(data?.walletAddress);
    showToastMessage(toast, 'success', t('creatorCoin.copiedClipboard'));
  };

  const handleWithdrawModalClose = () => {
    withdrawSheetRef.current?.close?.();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (withdrawHistory.length > 0) {
      loadMoreTransactions();
    }
  }, [currentPage]);

  useEffect(() => {
    if (withdrawHistory.length > 0) {
      const onboardingRequired = withdrawHistory.filter(
        item => item.status === 'requires_onboarding'
      );

      if (onboardingRequired.length > 0) {
        const totalAmount = onboardingRequired.reduce(
          (sum, item) => sum + item.withdrawAmount,
          0
        );

        setPendingWithdrawal({
          items: onboardingRequired,
          totalAmount: totalAmount,
          count: onboardingRequired.length
        });
        setShowOnboardingModal(true);
      }
    }
  }, [withdrawHistory]);

  useEffect(() => {
    console.log('🎧 CreatorCoin: Setting up PAYMENT_COMPLETED listener');

    const subscription = DeviceEventEmitter.addListener('PAYMENT_COMPLETED', (data) => {
      console.log('🔔 CreatorCoin: PAYMENT_COMPLETED event received!', data);
      fetchAllData();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    fetchAllData();
    setRefreshing(false);
  }, []);

  const fetchAllData = async () => {
    const id = await AsyncStorage.getItem('userId');
    try {
      dispatch(showLoader());

      const [profileResponse, dashboardRes, withdrawRes, onboardingRes] = await Promise.all([
        getUserCredentials(id),
        getUserDashboard(id),
        getWithdrawalHistory(),
        getOnboardingStatus().catch(() => null),
      ]);

      if (profileResponse?.statusCode === 200) {
        console.log('User profile:', profileResponse);
        let userDataToSet;
        if (profileResponse.data && profileResponse.data.user) {
          userDataToSet = profileResponse.data.user;
        } else if (profileResponse.data) {
          userDataToSet = profileResponse.data;
        } else {
          userDataToSet = profileResponse;
        }
        setData(userDataToSet);
      } else {
        showToastMessage(toast, 'danger', profileResponse.data.message);
      }

      if (dashboardRes.statusCode === 200) {
        setUserDashboard(dashboardRes.data.dashboardData);
      } else {
        showToastMessage(toast, 'danger', t('creatorCoin.fetchDashboardError'));
      }

      if (withdrawRes?.statusCode === 200) {
        const history = withdrawRes.data.withdrawals || withdrawRes.data || [];
        setWithdrawHistory(history);
        const firstPageData = history.slice(0, ITEMS_PER_PAGE);
        setDisplayedTransactions(firstPageData);
      } else {
        setWithdrawHistory([]);
        setDisplayedTransactions([]);
      }

      if (onboardingRes?.statusCode === 200 && onboardingRes?.data) {
        setOnboardingStatus({
          canReceivePayments: !!onboardingRes.data.canReceivePayments,
          accountId: onboardingRes.data.accountId || null,
        });
      } else {
        setOnboardingStatus(null);
      }

    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? t('creatorCoin.somethingWentWrong'),
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const loadMoreTransactions = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newTransactions = withdrawHistory.slice(0, endIndex);
    setDisplayedTransactions(newTransactions);
  };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;

    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isCloseToBottom && !isLoadingMore) {
      const hasMoreTransactions = displayedTransactions.length < withdrawHistory.length;

      if (hasMoreTransactions) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setCurrentPage(prev => prev + 1);
          setIsLoadingMore(false);
        }, 500);
      }
    }
  };

  const handleOnboardingClick = async () => {
    try {
      dispatch(showLoader());
      await openStripeOnboarding({ onComplete: fetchAllData });
    } catch (error) {
      showToastMessage(toast, 'danger', error?.message ?? STRIPE_ERROR_MESSAGES.ONBOARDING_FAILED);
    } finally {
      dispatch(hideLoader());
    }
  };

  const handleConfirmOnboarding = () => {
    setShowOnboardingModal(false);
    handleOnboardingClick();
  };

  const handleCancelOnboarding = () => {
    setShowOnboardingModal(false);
    setPendingWithdrawal(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':  return '#10b981';
      case 'pending':    return '#f59e0b';
      case 'requires_onboarding': return '#ef4444';
      default:           return '#ef4444';
    }
  };

  const getStatusText = (status) => {
    if (status === 'requires_onboarding') return t('creatorCoin.statusSetupRequired');
    return status
      ? status.charAt(0).toUpperCase() + status.slice(1)
      : t('creatorCoin.statusPending');
  };

  const renderWithdrawItem = (item, index) => {
    const isOnboardingRequired = item.status === 'requires_onboarding';

    return (
      <TouchableOpacity
        key={index}
        style={[styles.withdrawItem, bgStyle]}
        onPress={() => isOnboardingRequired && handleOnboardingClick()}
        activeOpacity={isOnboardingRequired ? 0.7 : 1}
        disabled={!isOnboardingRequired}
      >
        <View style={styles.withdrawLeft}>
          <Ionicons name="arrow-up-circle-outline" size={24} color="#ef4444" />
          <View style={styles.withdrawInfo}>
            <Text style={styles.withdrawAmount}>${item.withdrawAmount}</Text>
            <Text style={styles.withdrawDate}>
              {new Date(item.createdAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>
        </View>
        <View style={styles.withdrawRight}>
          <View style={styles.statusContainer}>
            <Text style={[styles.withdrawStatus, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const PLACEHOLDER_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  const avatarUri = typeof data?.image === 'string' && data?.image.length ? data?.image : PLACEHOLDER_AVATAR;

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('creatorCoin.headerTitle')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ShareProfile', { userData: data })}>
          <Ionicons name="share-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#783eb9a9']}
          />
        }
      >
        {/* Profile + Price */}
        <View style={styles.priceSection}>
          <View style={styles.username}>
            <View style={styles.userRow}>
              <Text style={styles.coinName}>${data?.userName}</Text>
            </View>
            <Text style={styles.coinPrice}>${data?.tokenBalance}</Text>
          </View>
          <TouchableOpacity>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={[styles.balanceBox, bgStyle]}>
          <Image source={{ uri: avatarUri }} style={styles.balanceAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceTitle}>{t('creatorCoin.yourBalance')}</Text>
            <Text style={styles.balanceValue}>${data?.tokenBalance}</Text>
          </View>
        </View>

        {/* Stripe payment status */}
        {onboardingStatus != null && (
          <View style={[styles.stripeStatusBox, bgStyle]}>
            <View style={styles.stripeStatusRow}>
              <Text style={styles.detailLabel}>{t('creatorCoin.stripePayments')}</Text>
              <Text style={[
                styles.stripeStatusBadge,
                { color: onboardingStatus.canReceivePayments ? '#10b981' : '#f59e0b' }
              ]}>
                {onboardingStatus.canReceivePayments
                  ? t('creatorCoin.stripeActive')
                  : t('creatorCoin.stripeSetupRequired')}
              </Text>
            </View>
            {onboardingStatus.accountId ? (
              <View style={styles.stripeStatusRow}>
                <Text style={styles.detailLabel}>{t('creatorCoin.stripeAccount')}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {onboardingStatus.accountId}
                </Text>
              </View>
            ) : null}
            {!onboardingStatus.canReceivePayments && (
              <TouchableOpacity
                style={[styles.stripeSetupButton, { backgroundColor: text }]}
                onPress={() => setShowConnectStripeModal(true)}
              >
                <Text style={styles.stripeSetupButtonText}>
                  {t('creatorCoin.stripeSetupCta')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View>
            <TouchableOpacity>
              <Text style={styles.statLabel}>{t('creatorCoin.holders')}</Text>
              <Text style={styles.statValue}>
                {userDashboard?.totalFollowers ?? 0}
              </Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity>
              <Text style={styles.statLabel}>{t('creatorCoin.totalVolume')}</Text>
              <Text style={styles.statValue}>${data?.tokenBalance}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.wrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.buttonRow}
          >
            <TouchableOpacity style={[styles.smallBtn, bgStyle]} onPress={copyToClipboard}>
              <Text style={styles.smallBtnText}>{t('creatorCoin.copyAddress')}</Text>
              <Ionicons name="copy-outline" size={15} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, bgStyle]}>
              <Ionicons name="remove-circle-outline" size={15} color="#000" />
              <Text style={styles.smallBtnText}>{t('creatorCoin.basescan')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={[styles.detailsBox, bgStyle]}>
          <View style={[styles.detailRow, bgStyle]}>
            <Text style={styles.detailLabel}>{t('creatorCoin.contractAddress')}</Text>
            <TouchableOpacity onPress={copyToClipboard} style={styles.adressCopy}>
              <Text style={styles.detailValue}>
                {data?.walletAddress.trim().slice(0, 12) + '....'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('creatorCoin.created')}</Text>
            <Text style={styles.detailValue}>
              {new Date(data?.createdAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>
        </View>

        {/* Withdraw History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>{t('creatorCoin.withdrawHistory')}</Text>

          {displayedTransactions.length > 0 ? (
            <>
              {displayedTransactions.map((item, index) => renderWithdrawItem(item, index))}

              {isLoadingMore && (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#783eb9" />
                  <Text style={styles.loadingText}>{t('creatorCoin.loadingMore')}</Text>
                </View>
              )}

              {displayedTransactions.length >= withdrawHistory.length && withdrawHistory.length > 0 && (
                <Text style={styles.endText}>{t('creatorCoin.noMoreTransactions')}</Text>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>{t('creatorCoin.noWithdrawHistory')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Trade Button */}
      <TouchableOpacity
        style={[styles.tradeButton, { backgroundColor: text }]}
        onPress={() => withdrawSheetRef.current?.open?.()}
      >
        <Text style={styles.tradeText}>{t('creatorCoin.withdrawButton')}</Text>
      </TouchableOpacity>

      {/* Withdrawal Bottom Sheet */}
      <RBSheet
        ref={withdrawSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onClose={() => Keyboard.dismiss()}
        customStyles={{
          container: [{ borderTopLeftRadius: 30, borderTopRightRadius: 30, bottom: -30 }, bgStyle],
          draggableIcon: { backgroundColor: '#ccc', width: 60 },
        }}
      >
        <WithdrawalModal
          onWithdrawal={() => {
            withdrawSheetRef.current?.close?.();
            fetchAllData();
          }}
        />
      </RBSheet>

      {/* Onboarding Confirmation Modal */}
      <Modal
        visible={showOnboardingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelOnboarding}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={50} color="#783eb9" />
              <Text style={styles.modalTitle}>{t('creatorCoin.onboardingModalTitle')}</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                {t('creatorCoin.onboardingModalYouHave')}{' '}
                <Text style={styles.modalAmount}>
                  {pendingWithdrawal?.count}{' '}
                  {t('creatorCoin.onboardingModalPendingWithdrawal')}
                  {pendingWithdrawal?.count > 1 ? t('creatorCoin.onboardingModalPluralSuffix') : ''}
                </Text>
                {' '}{t('creatorCoin.onboardingModalTotaling')}{' '}
                <Text style={styles.modalAmount}>
                  ${pendingWithdrawal?.totalAmount}
                </Text>
              </Text>
              <Text style={styles.modalSubtext}>
                {pendingWithdrawal?.count > 1
                  ? t('creatorCoin.onboardingModalSubtextPlural')
                  : t('creatorCoin.onboardingModalSubtextSingular')}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelOnboarding}
              >
                <Text style={styles.cancelButtonText}>{t('creatorCoin.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmOnboarding}
              >
                <Text style={styles.confirmButtonText}>{t('creatorCoin.proceed')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConnectStripeModal
        visible={showConnectStripeModal}
        onClose={() => setShowConnectStripeModal(false)}
        onConnectStripe={() => {
          setShowConnectStripeModal(false);
          handleOnboardingClick();
        }}
      />
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    position: 'static',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'black' },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    position: 'relative',
  },
  coinName: { fontSize: 18, fontWeight: '700', color: 'black' },
  coinPrice: { fontSize: 28, fontWeight: '700', marginVertical: 10 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    position: 'absolute',
    right: 20,
    top: 0,
    borderWidth: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  statLabel: { fontSize: 14, color: 'gray', textAlign: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  balanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: -15,
  },
  balanceAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  balanceTitle: { fontSize: 14, color: 'gray' },
  balanceValue: { fontSize: 16, fontWeight: '600', color: 'black' },
  stripeStatusBox: {
    marginHorizontal: 15,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  stripeStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  stripeStatusBadge: { fontSize: 14, fontWeight: '600' },
  stripeSetupButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  stripeSetupButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  smallBtnText: {
    fontSize: 14,
    color: 'black',
    paddingHorizontal: 4,
    fontWeight: '600',
  },
  detailsBox: {
    gap: 5,
    padding: 10,
    borderRadius: 20,
    marginBottom: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    borderRadius: 15,
    paddingHorizontal: 10,
  },
  detailLabel: { color: 'gray', fontSize: 16, fontWeight: '600' },
  detailValue: {
    color: 'black',
    fontSize: 14,
    fontWeight: '600',
    alignItems: 'flex-end',
  },
  tradeButton: {
    marginHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    position: 'static',
  },
  tradeText: { fontSize: 16, fontWeight: '600', color: 'white' },
  username: { flexDirection: 'column', marginLeft: 20 },
  adressCopy: { flexDirection: 'row', justifyContent: 'space-evenly', gap: 3 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 40,
  },
  wrapper: {
    marginVertical: 10,
    alignItems: 'center',
  },
  historySection: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'black',
    marginBottom: 15,
  },
  withdrawItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  withdrawLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  withdrawInfo: {
    flexDirection: 'column',
  },
  withdrawAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
  },
  withdrawDate: {
    fontSize: 12,
    color: 'gray',
    marginTop: 2,
  },
  withdrawRight: {
    alignItems: 'flex-end',
  },
  withdrawStatus: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: 'gray',
  },
  endText: {
    textAlign: 'center',
    color: 'gray',
    fontSize: 14,
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 12,
    textAlign: 'center',
  },
  modalBody: {
    marginBottom: 24,
  },
  modalDescription: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  modalAmount: {
    fontWeight: '700',
    color: '#783eb9',
    fontSize: 18,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  confirmButton: {
    backgroundColor: '#783eb9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});