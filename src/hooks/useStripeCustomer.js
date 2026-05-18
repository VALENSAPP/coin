/**
 * Hook for Stripe customer (payer) check: stripeCustomerId from login/profile.
 * Use on payment screens to gate payment until user has completed Stripe customer setup.
 */
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStripeCustomerId } from '../redux/actions/UserAction';
import { getUserCredentials } from '../services/post';
import { openStripeOnboarding } from '../utils/stripeOnboarding';
import { useLanguage } from '../i18n';

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
 *   requireStripeCustomerForPayment: () => Promise<boolean>,
 * }}
 */
export function useStripeCustomer() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
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
    await openStripeOnboarding({ onComplete: refreshStripeCustomer, t });
    await refreshStripeCustomer();
  }, [refreshStripeCustomer, t]);

  /**
   * Call before starting any payment. Refreshes from server, then if no stripeCustomerId
   * returns false. Caller should show StripePaymentMethodModal with message and
   * "Connect to Stripe" button that calls openPaymentConnectionAndRefresh().
   */
  const requireStripeCustomerForPayment = useCallback(
    async () => {
      const id = await refreshStripeCustomer();
      if (id != null && id !== '') return true;
      return false;
    },
    [refreshStripeCustomer]
  );

  return {
    stripeCustomerId,
    needsCustomerSetup: stripeCustomerId == null || stripeCustomerId === '',
    refreshStripeCustomer,
    openPaymentConnectionAndRefresh,
    requireStripeCustomerForPayment,
  };
}
