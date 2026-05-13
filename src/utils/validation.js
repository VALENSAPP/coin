/**
 * Shared field-level validators.
 *
 * Each function accepts an optional `t` (translation) function as its last
 * argument — the same `t` returned by `useLanguage()`.  When provided the
 * translated string is returned; when omitted the English fallback is used
 * so the helpers remain safe to call outside React components (e.g. unit tests).
 *
 * Usage inside a component:
 *   const { t } = useLanguage();
 *   const emailError = validateEmail(email, t);
 *
 * Usage outside React (or in tests):
 *   const emailError = validateEmail(email);
 */

/**
 * @param {string} email
 * @param {Function} [t]  - i18n translation function from useLanguage()
 * @returns {string}  error message, or '' when valid
 */
export function validateEmail(email, t) {
  if (!email) {
    return t ? t('validation.emailRequired') : 'Email is required';
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return t ? t('validation.emailInvalid') : 'Enter a valid email address';
  }
  return '';
}

/**
 * @param {string} password
 * @param {Function} [t]  - i18n translation function from useLanguage()
 * @returns {string}  error message, or '' when valid
 */
export function validatePassword(password, t) {
  if (!password) {
    return t ? t('validation.passwordRequired') : 'Password is required';
  }
  if (password.length < 6) {
    return t
      ? t('validation.passwordMinLength')
      : 'Password must be at least 6 characters';
  }
  return '';
}