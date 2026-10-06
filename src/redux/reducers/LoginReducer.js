import { IS_LOGGED_IN, IS_LOGOUT, SET_REGULAR_SUBSCRIPTION_PROMPT } from '../actions/LoginAction';

const initialState = {
  IS_LOGGED_IN: false,
  IS_LOGOUT: true,
  showRegularSubscriptionPrompt: false,
};

const loginReducer = (state = initialState, action) => {
  switch (action.type) {
    case IS_LOGGED_IN:
      return {
        ...state,
        IS_LOGGED_IN: true,
        IS_LOGOUT: false,
        showRegularSubscriptionPrompt: Boolean(action?.payload?.showRegularSubscriptionPrompt),
      };
    case SET_REGULAR_SUBSCRIPTION_PROMPT:
      return {
        ...state,
        showRegularSubscriptionPrompt: Boolean(action?.payload),
      };
    case IS_LOGOUT:
      return {
        ...state,
        IS_LOGGED_IN: false,
        IS_LOGOUT: true,
        showRegularSubscriptionPrompt: false,
      };
    default:
      return state;
  }
};

export default loginReducer;