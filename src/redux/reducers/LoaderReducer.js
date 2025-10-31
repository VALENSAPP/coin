import { SHOW_LOADER, HIDE_LOADER } from '../actions/LoaderAction';

const initialState = {
    isLoading: false,
};

const loaderReducer = (state = initialState, action) => {
    switch (action.type) {
        case SHOW_LOADER:
            return { ...state, isLoading: true };
        case HIDE_LOADER:
            return { ...state, isLoading: false };
        default:
            return state;
    }
};

export default loaderReducer;