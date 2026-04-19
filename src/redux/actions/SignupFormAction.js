export const SET_SIGNUP_FORM_DATA = 'SET_SIGNUP_FORM_DATA';
export const CLEAR_SIGNUP_FORM_DATA = 'CLEAR_SIGNUP_FORM_DATA';

export const setSignupFormData = (formData) => {
  return {
    type: SET_SIGNUP_FORM_DATA,
    payload: formData,
  };
};

export const clearSignupFormData = () => {
  return {
    type: CLEAR_SIGNUP_FORM_DATA,
  };
};
