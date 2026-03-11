import axiosInstance from '..';

export async function followers(userId) {
    return axiosInstance.get(`user/followers/${userId}`)
}

export async function following(userId) {
    return axiosInstance.get(`user/following/${userId}`)
}

export async function requestWithdrawal(data) {
    return axiosInstance.post(`billing/request-withdrawal`, data)
}

export async function getWithdrawalHistory() {
    return axiosInstance.get(`billing/withdrawal-history`)
}

/**
 * Create Stripe Connect onboarding link (required to receive payments).
 * Response: { statusCode: 200|201, success: true, data: { onboardingUrl: "https://connect.stripe.com/..." } }
 */
export async function createOnboardingLink() {
    return axiosInstance.post(`billing/create-onboarding-link`);
}

/**
 * Get Stripe Connect onboarding status for current user.
 * Response: { statusCode: 200, success: true, data: { canReceivePayments: boolean, accountId: string } }
 */
export async function getOnboardingStatus() {
    return axiosInstance.get(`billing/onboarding-status`);
}

/**
 * Create Stripe customer setup link when user has no stripeCustomerId.
 * User completes flow to add payment method and get stripeCustomerId.
 * Response: { statusCode: 200|201, success: true, data: { url: "https://..." } }
 */
export async function createCustomerSetupLink() {
    return axiosInstance.post(`billing/customer-setup-link`);
}