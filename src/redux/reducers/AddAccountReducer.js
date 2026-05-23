import { SET_IS_ADD_ACCOUNT } from "../actions/AddAccountAction";

const initialState = {
    isAddAccount: false,
};

const addAccountReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_IS_ADD_ACCOUNT:
            return {
                ...state,
                isAddAccount: action.payload,
            };
        default:
            return state;
    }
};

export default addAccountReducer;