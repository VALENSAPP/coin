/**
 * Hook for Stripe customer (payer) check: stripeCustomerId from login/profile.
 * Use on payment screens to gate payment until user has completed Stripe customer setup.
 */
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStripeCustomerId } from '../redux/actions/UserAction';
import { getUserCredentials } from '../services/post';
import { openStripeOnboarding, STRIPE_ERROR_MESSAGES } from '../utils/stripeOnboarding';

const STRIPE_CUSTOMER_ID_KEY = 'stripeCustomerId';

/**
 * Persist stripeCustomerId and update Redux.
 */
export async function persistStripeCustomerId(stripeCustomerId, dispatch) {
  if (stripeCustomerId != null && stripeCustomerId !== '') {
    await AsyncStorage.setItem(STRIPE_CUSTOMER_ID_KEY, String(stripeCustomerId));
  } else {
    await AsyncStorage.removeItem(STRIPE_CUSTOMER_ID_KEY);
  }
  dispatch(setStripeCustomerId(stripeCustomerId || null));
}

/**
 * @returns {{
 *   stripeCustomerId: string | null,
 *   needsCustomerSetup: boolean,
 *   refreshStripeCustomer: () => Promise<void>,
 *   openPaymentConnectionAndRefresh: () => Promise<void>,
 *   requireStripeCustomerForPayment: (toast) => Promise<boolean>,
 * }}
 */
export function useStripeCustomer() {
  const dispatch = useDispatch();
  const stripeCustomerId = useSelector((state) => state.user?.stripeCustomerId ?? null);

  const refreshStripeCustomer = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return stripeCustomerId;
      const res = await getUserCredentials(userId);
      const user = res?.data?.user ?? res?.data ?? res;
      const id = user?.stripeCustomerId ?? null;
      await persistStripeCustomerId(id, dispatch);
      return id;
    } catch (e) {
      return stripeCustomerId;
    }
  }, [dispatch, stripeCustomerId]);

  const openPaymentConnectionAndRefresh = useCallback(async () => {
    await openStripeOnboarding({ onComplete: refreshStripeCustomer });
    await refreshStripeCustomer();
  }, [refreshStripeCustomer]);

  /**
   * Call before starting any payment. Refreshes from server, then if no stripeCustomerId
   * shows both error toasts (same copy as design), calls create-onboarding-link, opens
   * Stripe URL on current screen. No redirect to Wallet. Returns false so caller does not proceed.
   */
  const requireStripeCustomerForPayment = useCallback(
    async (toast) => {
      const id = await refreshStripeCustomer();
      if (id != null && id !== '') return true;
      if (toast?.show) {
        toast.show(STRIPE_ERROR_MESSAGES.CUSTOMER_SETUP_FAILED, { type: 'danger' });
        toast.show(STRIPE_ERROR_MESSAGES.CUSTOMER_SETUP_REQUIRED, { type: 'danger' });
      }
      try {
        await openPaymentConnectionAndRefresh();
      } catch (e) {
        if (toast?.show) {
          toast.show(e?.message || STRIPE_ERROR_MESSAGES.ONBOARDING_FAILED, { type: 'danger' });
        }
      }
      return false;
    },
    [refreshStripeCustomer, openPaymentConnectionAndRefresh]
  );

  return {
    stripeCustomerId,
    needsCustomerSetup: stripeCustomerId == null || stripeCustomerId === '',
    refreshStripeCustomer,
    openPaymentConnectionAndRefresh,
    requireStripeCustomerForPayment,
  };
}
