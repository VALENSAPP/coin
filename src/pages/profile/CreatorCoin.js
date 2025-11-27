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
import { isFirstDayOfMonth } from 'date-fns';
import { useAppTheme } from '../../theme/useApptheme';
import WithdrawalModal from '../../components/modals/WithdrawModal';
import RBSheet from 'react-native-raw-bottom-sheet';
import { createOnboardingLink, getWithdrawalHistory } from '../../services/profile';
import InAppBrowser from 'react-native-inappbrowser-reborn';

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
  const [pendingWithdrawal, setPendingWithdrawal] = useState(null);

  const navigation = useNavigation();
  const toast = useToast();
  const userId = '';
  const dispatch = useDispatch();
  const withdrawSheetRef = useRef(null);
  const { bgStyle, textStyle, text } = useAppTheme();

  const copyToClipboard = () => {
    Clipboard.setString(data?.walletAddress);
    showToastMessage(toast, 'success', 'Copied to clipboard ✅');
  };

  const handleWithdrawModalClose = () => {
    withdrawSheetRef.current?.close?.();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Load more transactions when page changes
  useEffect(() => {
    if (withdrawHistory.length > 0) {
      loadMoreTransactions();
    }
  }, [currentPage]);

  // Check for onboarding required withdrawal on initial load
  useEffect(() => {
    if (withdrawHistory.length > 0) {
      // Filter all withdrawals that require onboarding
      const onboardingRequired = withdrawHistory.filter(
        item => item.status === 'requires_onboarding'
      );

      // If there are any withdrawals requiring onboarding, show modal
      if (onboardingRequired.length > 0) {
        // Calculate total amount from all pending withdrawals
        const totalAmount = onboardingRequired.reduce(
          (sum, item) => sum + item.withdrawAmount, 
          0
        );
        
        // Store all pending withdrawals and total
        setPendingWithdrawal({
          items: onboardingRequired,
          totalAmount: totalAmount,
          count: onboardingRequired.length
        });
        setShowOnboardingModal(true);
      }
    }
  }, [withdrawHistory]);

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

      // Run all API calls in parallel
      const [profileResponse, dashboardRes, withdrawRes] = await Promise.all([
        getUserCredentials(id),
        getUserDashboard(id),
        getWithdrawalHistory(), // Add your withdraw history API endpoint
      ]);

      // Handle profile response
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

      // Dashboard
      if (dashboardRes.statusCode === 200) {
        setUserDashboard(dashboardRes.data.dashboardData);
      } else {
        showToastMessage(toast, 'danger', 'Failed to fetch dashboard');
      }

      // Withdraw History
      if (withdrawRes?.statusCode === 200) {
        console.log('withdrawal history----------------', withdrawRes)
        const history = withdrawRes.data.withdrawals || withdrawRes.data || [];
        setWithdrawHistory(history);
        // Load first page
        const firstPageData = history.slice(0, ITEMS_PER_PAGE);
        setDisplayedTransactions(firstPageData);
      } else {
        setWithdrawHistory([]);
        setDisplayedTransactions([]);
      }

    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
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

    // Check if user has scrolled to bottom
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isCloseToBottom && !isLoadingMore) {
      // Check if there are more transactions to load
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
      const response = await createOnboardingLink();
      console.log('createOnboardingLink---------------', response)
      if (response.statusCode === 200) {
        const url = response.data.onboardingUrl;

        if (await InAppBrowser.isAvailable()) {
          await InAppBrowser.open(url, {
            dismissButtonStyle: 'close',
            preferredBarTintColor: '#ffffff',
            preferredControlTintColor: '#000000',
            readerMode: false,
            animated: true,
            modalPresentationStyle: 'fullScreen',
            modalTransitionStyle: 'coverVertical',
            enableBarCollapsing: false,
            showTitle: true,
            toolbarColor: '#ffffff',
            secondaryToolbarColor: '#f0f0f0',
          });

          fetchAllData();
        } else {
          await Linking.openURL(url);
        }
      } else {
        showToastMessage(toast, 'danger', response.message);
      }

    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Failed to initiate onboarding'
      );
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
      case 'completed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'requires_onboarding':
        return '#ef4444';
      default:
        return '#ef4444';
    }
  };

  const getStatusText = (status) => {
    if (status === 'requires_onboarding') {
      return 'Setup Required';
    }
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending';
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
                timeStyle: 'short'
              })}
            </Text>
          </View>
        </View>
        <View style={styles.withdrawRight}>
          <View style={styles.statusContainer}>
            <Text style={[
              styles.withdrawStatus,
              { color: getStatusColor(item.status) }
            ]}>
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
        <Text style={styles.headerTitle}>Creator coin</Text>
        <TouchableOpacity onPress={() => { navigation.navigate('ShareProfile', { userData: data }); }}>
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
        }>

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
            <Text style={styles.balanceTitle}>Your balance</Text>
            <Text style={styles.balanceValue}>${data?.tokenBalance}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View>
            <TouchableOpacity>
              <Text style={styles.statLabel}>Holders</Text>
              <Text style={styles.statValue}>{userDashboard?.totalFollowers ? userDashboard?.totalFollowers : 0}</Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity>
              <Text style={styles.statLabel}>Total volume</Text>
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
              <Text style={styles.smallBtnText}>Copy address</Text>
              <Ionicons name="copy-outline" size={15} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, bgStyle]}>
              <Ionicons name="remove-circle-outline" size={15} color="#000" />
              <Text style={styles.smallBtnText}>Basescan</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={[styles.detailsBox, bgStyle]}>
          <View style={[styles.detailRow, bgStyle]}>
            <Text style={styles.detailLabel}>Contract address</Text>
            <TouchableOpacity onPress={copyToClipboard} style={styles.adressCopy}>
              <Text style={styles.detailValue}>{data?.walletAddress.trim().slice(0, 12) + '....'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>
              {new Date(data?.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </View>
        </View>

        {/* Withdraw History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Withdraw History</Text>

          {displayedTransactions.length > 0 ? (
            <>
              {displayedTransactions.map((item, index) => renderWithdrawItem(item, index))}

              {isLoadingMore && (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#783eb9" />
                  <Text style={styles.loadingText}>Loading more...</Text>
                </View>
              )}

              {displayedTransactions.length >= withdrawHistory.length && withdrawHistory.length > 0 && (
                <Text style={styles.endText}>No more transactions</Text>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No withdrawal history yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Trade Button */}
      <TouchableOpacity
        style={[styles.tradeButton, { backgroundColor: text }]}
        onPress={() => { withdrawSheetRef.current?.open?.() }}
      >
        <Text style={styles.tradeText}>Withdraw</Text>
      </TouchableOpacity>

      {/* Token Purchase Modal */}
      <RBSheet
        ref={withdrawSheetRef}
        height={500}
        openDuration={250}
        draggable={true}
        closeOnPressMask={true}
        customModalProps={{ statusBarTranslucent: true }}
        onClose={() => {
          Keyboard.dismiss();
        }}
        customStyles={{
          container: [{
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            bottom: -30,
          }, bgStyle],
          draggableIcon: {
            backgroundColor: '#ccc',
            width: 60,
          },
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
              <Text style={styles.modalTitle}>Complete Onboarding</Text>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                You have{' '}
                <Text style={styles.modalAmount}>
                  {pendingWithdrawal?.count} pending withdrawal{pendingWithdrawal?.count > 1 ? 's' : ''}
                </Text>
                {' '}totaling{' '}
                <Text style={styles.modalAmount}>
                  ${pendingWithdrawal?.totalAmount}
                </Text>
              </Text>
              <Text style={styles.modalSubtext}>
                To complete {pendingWithdrawal?.count > 1 ? 'these withdrawals' : 'this withdrawal'}, you need to finish the onboarding process. Would you like to proceed?
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelOnboarding}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmOnboarding}
              >
                <Text style={styles.confirmButtonText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  // Withdraw History Styles
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
  // Modal Styles
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