import { SET_PROFILE_IMAGE } from "../actions/ProfileImgAction";

const initialState = {
    profileImg: '',
};

const profileImgReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_PROFILE_IMAGE:
            return {
                ...state,
                profileImg: action.payload,
            };
        default:
            return state;
    }
};

export default profileImgReducer;
