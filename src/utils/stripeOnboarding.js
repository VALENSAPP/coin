/**
 * Shared Stripe onboarding and payment flow utilities.
 * Use across: Donation, Buy Credits, Subscription purchase, Subscription activation.
 */
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { Linking } from 'react-native';
import { createOnboardingLink, getOnboardingStatus, createCustomerSetupLink } from '../services/profile';

/** Re-export for single import source */
export { getOnboardingStatus, createOnboardingLink, createCustomerSetupLink };

/** Shared InAppBrowser options for payment/onboarding URLs (consistent across all flows) */
export const STRIPE_BROWSER_OPTIONS = {
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
  forceCloseOnRedirection: false,
};

/**
 * Extract payment session URL from API response (handles data vs data.data).
 * @param {object} response - API response
 * @returns {string|null} sessionUrl or null
 */
export function getPaymentSessionUrl(response) {
  if (!response || (response.statusCode !== 200 && response.statusCode !== 201)) return null;
  const data = response.data || {};
  return data.sessionUrl ?? data.url ?? data.data?.sessionUrl ?? data.data?.url ?? null;
}

/**
 * Extract Stripe onboarding URL from create-onboarding-link response.
 */
export function getOnboardingUrl(response) {
  if (!response || (response.statusCode !== 200 && response.statusCode !== 201)) return null;
  const data = response.data || {};
  return data.onboardingUrl ?? data.data?.onboardingUrl ?? null;
}

/**
 * Open Stripe Connect onboarding in browser. Same behavior/errors across all flows.
 * @param {object} options - { onComplete?: () => void }
 * @returns {Promise<void>}
 */
export async function openStripeOnboarding(options = {}) {
  const { onComplete, t } = options;
  const stripeErrorMessages = getStripeErrorMessages(t);
  try {
    const response = await createOnboardingLink();
    const url = getOnboardingUrl(response);
    if (!url) {
      throw new Error(stripeErrorMessages.ONBOARDING_FAILED);
    }
    if (await InAppBrowser.isAvailable()) {
      await InAppBrowser.open(url, STRIPE_BROWSER_OPTIONS);
    } else {
      await Linking.openURL(url);
    }
    onComplete?.();
  } catch (error) {
    const message = error?.response?.data?.message ?? error?.message ?? stripeErrorMessages.ONBOARDING_FAILED;
    throw new Error(message);
  }
}

/** Consistent error messages for payment/onboarding flows */
export const STRIPE_ERROR_MESSAGES = {
  PAYMENT_CANCELLED: 'Payment cancelled',
  SESSION_FAILED: 'Could not create payment session. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  ONBOARDING_FAILED: 'Failed to open Stripe setup',
  RECIPIENT_NOT_READY: 'Payment recipient has not completed setup yet.',
  CUSTOMER_SETUP_REQUIRED: 'Please complete Stripe setup to add a payment method.',
  CUSTOMER_SETUP_FAILED: 'Could not open payment setup. Please try again.',
};

const STRIPE_ERROR_TRANSLATION_KEYS = {
  PAYMENT_CANCELLED: 'stripe.paymentCancelled',
  SESSION_FAILED: 'stripe.sessionFailed',
  NETWORK_ERROR: 'stripe.networkError',
  ONBOARDING_FAILED: 'stripe.onboardingFailed',
  RECIPIENT_NOT_READY: 'stripe.recipientNotReady',
  CUSTOMER_SETUP_REQUIRED: 'stripe.customerSetupRequired',
  CUSTOMER_SETUP_FAILED: 'stripe.customerSetupFailed',
};

export function getStripeErrorMessages(t) {
  const translate = typeof t === 'function'
    ? t
    : (_key, fallback) => fallback;

  return Object.entries(STRIPE_ERROR_MESSAGES).reduce((messages, [code, fallback]) => {
    messages[code] = translate(STRIPE_ERROR_TRANSLATION_KEYS[code], fallback);
    return messages;
  }, {});
}

/**
 * Open Stripe customer setup (add payment method / get stripeCustomerId).
 * Use when user.stripeCustomerId is null before any payment.
 * @param {object} options - { onComplete?: () => void }
 */
export async function openCustomerSetup(options = {}) {
  const { onComplete, t } = options;
  const stripeErrorMessages = getStripeErrorMessages(t);
  try {
    const response = await createCustomerSetupLink();
    const url = getPaymentSessionUrl(response);
    if (!url) throw new Error(stripeErrorMessages.CUSTOMER_SETUP_FAILED);
    if (await InAppBrowser.isAvailable()) {
      await InAppBrowser.open(url, STRIPE_BROWSER_OPTIONS);
    } else {
      await Linking.openURL(url);
    }
    onComplete?.();
  } catch (error) {
    const message = error?.response?.data?.message ?? error?.message ?? stripeErrorMessages.CUSTOMER_SETUP_FAILED;
    throw new Error(message);
  }
}
