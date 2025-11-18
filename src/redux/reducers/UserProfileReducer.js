import { SET_USER_PROFILE } from "../actions/UserProfileAction";

const initialState = {
    userProfile: '',
};

const userProfileReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_USER_PROFILE:
            return {
                ...state,
                userProfile: action.payload,
            };
        default:
            return state;
    }
};

export default userProfileReducer;