import {
  SET_SIGNUP_FORM_DATA,
  CLEAR_SIGNUP_FORM_DATA,
} from '../actions/SignupFormAction';

const initialState = {
  email: '',
  userName: '',
  password: '',
  referralCode: '',
};

const signupFormReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_SIGNUP_FORM_DATA:
      return {
        ...state,
        ...action.payload,
      };
    case CLEAR_SIGNUP_FORM_DATA:
      return initialState;
    default:
      return state;
  }
};

export default signupFormReducer;
