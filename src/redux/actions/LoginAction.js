export const IS_LOGGED_IN = 'IS_LOGGED_IN';
export const IS_LOGOUT = 'IS_LOGOUT';
export const SET_REGULAR_SUBSCRIPTION_PROMPT = 'SET_REGULAR_SUBSCRIPTION_PROMPT';

// Synchronous actions
export const loggedIn = (payload) => ({
  type: IS_LOGGED_IN,
  payload,
});

export const loggedOut = () => ({
  type: IS_LOGOUT,
});

export const setRegularSubscriptionPrompt = (show) => ({
  type: SET_REGULAR_SUBSCRIPTION_PROMPT,
  payload: show,
});

