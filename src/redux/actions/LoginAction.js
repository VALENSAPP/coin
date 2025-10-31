export const IS_LOGGED_IN = 'IS_LOGGED_IN';
export const IS_LOGOUT = 'IS_LOGOUT';

// Synchronous actions
export const loggedIn = () => ({
  type: IS_LOGGED_IN,
});

export const loggedOut = () => ({
  type: IS_LOGOUT,
});
