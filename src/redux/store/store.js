import { configureStore } from '@reduxjs/toolkit';
import loaderReducer from '../reducers/LoaderReducer';
import loginReducer from '../reducers/LoginReducer';
import profileImgReducer from '../reducers/ProfileImgReducer';
import drawerReducer from '../reducers/GlobalDrawerReducer';
import userProfileReducer from '../reducers/UserProfileReducer';
import userReducer from '../reducers/UserReducer';
import addAccountReducer from '../reducers/AddAccountReducer';
import signupFormReducer from '../reducers/SignupFormReducer';
import languageReducer from '../reducers/LanguageReducer';

const store = configureStore({
  reducer: {
    loader: loaderReducer,
    login: loginReducer,
    profileImage: profileImgReducer,
    drawer: drawerReducer,
    userProfile: userProfileReducer,
    user: userReducer,
    addAccount: addAccountReducer,
    signupForm: signupFormReducer,
    language: languageReducer,
  },
});

export default store; 