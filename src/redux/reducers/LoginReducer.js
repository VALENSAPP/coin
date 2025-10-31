import { IS_LOGGED_IN, IS_LOGOUT } from '../actions/LoginAction';

const initialState = {
  IS_LOGGED_IN: false,
  IS_LOGOUT: true,
};

const loginReducer = (state = initialState, action) => {
  switch (action.type) {
    case IS_LOGGED_IN:
      return {
        ...state,
        IS_LOGGED_IN: true,
        IS_LOGOUT: false,
      };
    case IS_LOGOUT:
      return {
        ...state,
        IS_LOGGED_IN: false,
        IS_LOGOUT: true,
      };
    default:
      return state;
  }
};

export default loginReducer;