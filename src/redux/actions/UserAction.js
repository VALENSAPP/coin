export const SET_STRIPE_CUSTOMER_ID = 'SET_STRIPE_CUSTOMER_ID';

export const setStripeCustomerId = (stripeCustomerId) => ({
  type: SET_STRIPE_CUSTOMER_ID,
  payload: stripeCustomerId,
});
