export const SET_IS_ADD_ACCOUNT = 'SET_IS_ADD_ACCOUNT';

export const setIsAddAccount = (isAddAccount) => {
    return {
        type: SET_IS_ADD_ACCOUNT,
        payload: isAddAccount,
    };
};