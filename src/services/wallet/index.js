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
export const authSesionHistory = async (data) => {
  return axiosInstance.get('/auth/sessions', { params: data });
}

export const logoutDeviec = async (data) => {
  return axiosInstance.post('/auth/logout-session', data);
}
export const logoutDeviecAll = async () => {
  return axiosInstance.post('/auth/logout-all');
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

export const verifyUsdtTransaction = async (data) => {
  return axiosInstance.post('billing/verify-usdt-transaction', data);
}

export const totalSupport = async (data) => {
  return axiosInstance.get('billing/pay-following/received', data);
}
export const totalMission = async (data) => {
  return axiosInstance.get('token-purchase/mission-donation/received', data);
}
export const totalamount = async (data) => {
  return axiosInstance.get('billing/received-totals', data);
}
export const referPoints = async (data) => {
  return axiosInstance.get('/user/refer-points', data);
}
export const metaMaskRecived = async (data) => {
  return axiosInstance.get('/billing/usdt-transfers/received', data);
}
export const totalPoints = async (data) => {
  return axiosInstance.get('user/totalplatfrompoints', data);
}
export const getTotalFollowers = async (params) => {
  return axiosInstance.get('user/followers-graph', { params });
}

export const getAllMissionPost = async (params) => {
  return axiosInstance.get('post/getMissionpost', { params });
}

export const subscriptionEarningGraph = async (params) => {
  return axiosInstance.get('billing/subscription-earning/graph', { params });
}
export const transationActivity = async (params) => {
  if (params && typeof params === 'object') {
    return axiosInstance.get('billing/received-transactions', { params });
  }
  return axiosInstance.get('billing/received-transactions');
}
