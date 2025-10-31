import { configureStore } from '@reduxjs/toolkit';
import loaderReducer from '../reducers/LoaderReducer';
import loginReducer from '../reducers/LoginReducer';
import profileImgReducer from '../reducers/ProfileImgReducer';
import drawerReducer from '../reducers/GlobalDrawerReducer';

const store = configureStore({
  reducer: {
    loader: loaderReducer,
    login: loginReducer,
    profileImage: profileImgReducer,
    drawer: drawerReducer
  },
});

export default store; 