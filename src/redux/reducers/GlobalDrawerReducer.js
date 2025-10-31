import { CLOSE_DRAWER, OPEN_DRAWER, TOGGLE_DRAWER } from "../actions/GlobalDrawerAction";

const initialState = {
    isOpen: false,
};

const drawerReducer = (state = initialState, action) => {
    switch (action.type) {
        case OPEN_DRAWER:
            return {
                ...state,
                isOpen: true,
            };
        case CLOSE_DRAWER:
            return {
                ...state,
                isOpen: false,
            };
        case TOGGLE_DRAWER:
            return {
                ...state,
                isOpen: !state.isOpen,
            };
        default:
            return state;
    }
};

export default drawerReducer;