import axiosInstance from "..";

export const getCreditsLeft = async () => {
  return axiosInstance.get('/user/getHitLeft');
}

export const userChangePassword = async (data) => {
  return axiosInstance.post('/user/change-password', data);
}

export const authLoginHistory = async (data) => {
  return axiosInstance.post('/auth/login-history', data);
}

export const userProfileStatusSet = async (data) => {
  return axiosInstance.post('/user/profileStatusSet', data);
}

export const userAccountDelete = async () => {
  return axiosInstance.post('/user/accountDelete');
}

export const setPrivateSubscription = async (data) => {
  return axiosInstance.post('/user/subscription', data);
}

export const getPrivateSubscription = async () => {
  return axiosInstance.get('/user/subscription');
}

export const setUserSubscription = async (data, id) => {
  return axiosInstance.patch('/user/subscription/' + id, data);
}

export const getUserSubscription = async (id) => {
  return axiosInstance.get('/user/subscription/' + id); //by subscription ID
}

export const deleteUserSubscription = async (id) => {
  return axiosInstance.delete('/user/subscription/' + id);
}

export const getSubscriptionByUserID = async (id) => {
  return axiosInstance.get('/user/getSubscriptionByUserID/' + id);
}

export const enableTwoFactorAuth = async () => {
  return axiosInstance.post('/user/enable-two-factor');
}

export const verifyTwoFactorAuth = async (data) => {
  return axiosInstance.post('/user/verify-two-factor', data);
}

export const disableTwoFactorAuth = async (data) => {
  return axiosInstance.get('/user/disable-two-factor', data);
}
export const updateWallet = async (data) => {
  return axiosInstance.patch('user/updateWalletAddress', data);
}