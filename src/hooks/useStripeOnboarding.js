/**
 * Shared hook for Stripe onboarding status and open-onboarding action.
 * Use in flows where the current user must be able to receive payments
 * (Creator Coin, Subscription activation, etc.).
 */
import { useState, useCallback, useEffect } from 'react';
import { getOnboardingStatus } from '../services/profile';
import { openStripeOnboarding } from '../utils/stripeOnboarding';
import { useLanguage } from '../i18n';

/**
 * @returns {{
 *   canReceivePayments: boolean | null,
 *   accountId: string | null,
 *   loading: boolean,
 *   error: string | null,
 *   refresh: () => Promise<void>,
 *   openOnboarding: (opts?: { onComplete?: () => void }) => Promise<void>,
 * }}
 */
export function useStripeOnboarding(options = {}) {
  const { fetchOnMount = true } = options;
  const { t } = useLanguage();
  const [canReceivePayments, setCanReceivePayments] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOnboardingStatus();
      if (res?.statusCode === 200 && res?.data) {
        const canReceive = !!res.data.canReceivePayments;
        const account = res.data.accountId || null;
        setCanReceivePayments(canReceive);
        setAccountId(account);
        setLoading(false);
        return { canReceivePayments: canReceive, accountId: account };
      } else {
        setCanReceivePayments(null);
        setAccountId(null);
        setLoading(false);
        return { canReceivePayments: null, accountId: null };
      }
    } catch (e) {
      setError(e?.message || 'Failed to load payment status');
      setCanReceivePayments(null);
      setAccountId(null);
      setLoading(false);
      return { canReceivePayments: null, accountId: null };
    }
  }, []);

  const openOnboarding = useCallback(async (opts = {}) => {
    await openStripeOnboarding({
      ...opts,
      t,
      onComplete: () => {
        opts.onComplete?.();
        refresh();
      },
    });
  }, [refresh, t]);

  useEffect(() => {
    if (fetchOnMount) refresh();
  }, [fetchOnMount]);

  return {
    canReceivePayments,
    accountId,
    loading,
    error,
    refresh,
    openOnboarding,
  };
}
