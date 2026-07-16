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

/** @param {{ interval?: 'daily' | 'weekly' | 'monthly' }} params */
export const subscriptionEarningGraph = async (params) => {
  return axiosInstance.get('billing/subscription-earning/graph', { params });
}

/** 7-day pay-following (subscribed fans) graph + total + % of total earning */
export const payFollowingGraph = async () => {
  return axiosInstance.get('billing/pay-following-graph');
};

/** 7-day tip graph + total tip earning + % of total earning */
export const tipGraph = async () => {
  return axiosInstance.get('billing/tip-graph');
};

/** 7-day mission donations graph + total + % of total earning */
export const missionDonationsGraph = async () => {
  return axiosInstance.get('billing/mission-donations-graph');
};

/** 7-day shop earning graph (items + ebooks, excluding platform fee) */
export const shopEarningGraph = async () => {
  return axiosInstance.get('billing/shop-earning-graph');
};

/** 7-day USDT / wallet-to-wallet transfer graph + total + % of total earning */
export const usdtTransferGraph = async () => {
  return axiosInstance.get('billing/usdt-transfer-graph');
};
export const transationActivity = async (params) => {
  if (params && typeof params === 'object') {
    return axiosInstance.get('billing/received-transactions', { params });
  }
  return axiosInstance.get('billing/received-transactions');
}

export const totalTransactions = async (params) => {
  const candidates = [
    'billing/received-totals-transactions',
    'received-totals-transactions',
    'billing/received-totals',
  ];

  let lastError = null;
  for (const path of candidates) {
    try {
      const resp = await axiosInstance.get(path, { params });
      return resp;
    } catch (err) {
      lastError = err;
      if (err?.response?.status === 404) continue;
      throw err;
    }
  }

  // Fallback: try fetching transactions list if totals endpoint not available
  try {
    return await axiosInstance.get('billing/received-transactions', { params });
  } catch (err) {
    // if all fail, throw the last meaningful error
    throw lastError || err || new Error('totalTransactions: no endpoints available');
  }
}