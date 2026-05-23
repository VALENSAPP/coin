import * as RNLocalize from 'react-native-localize';

export const getUserCountry = () => {
  return RNLocalize.getCountry(); // e.g. "US", "IN"
};

export const isStripeAllowedFrontend = () => {
  const blockedCountries = ['US', 'CA']; // example
  return !blockedCountries.includes(getUserCountry());
};
