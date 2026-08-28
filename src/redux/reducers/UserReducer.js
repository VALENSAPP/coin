import { SET_STRIPE_CUSTOMER_ID } from '../actions/UserAction';
import { IS_LOGOUT } from '../actions/LoginAction';

const initialState = {
  stripeCustomerId: null,
};

const userReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_STRIPE_CUSTOMER_ID:
      return {
        ...state,
        stripeCustomerId: action.payload,
      };
    case IS_LOGOUT:
      return initialState;
    default:
      return state;
  }
};

export default userReducer;
