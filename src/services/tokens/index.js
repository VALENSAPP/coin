import axiosInstance from "..";

/** token Api's**/
export const createToken = async (body) => {
  return axiosInstance.post(`token/create`, body);
}

export const getTokenByUserId = async (userId) => {
  return axiosInstance.get(`token/user/${userId}`)
};

export const getTokenInfoByTokenAddress = async (tokenAddress) => {
  return axiosInstance.get(`token/info/${tokenAddress}`)
};

export const getUserTokenInfoByBlockChain = async (userId) => {
  return axiosInstance.get(`token/user/${userId}/info`)
};

export const getTokenPrice = async (body) => {
  return axiosInstance.post(`token-purchase/get-token-price`, body);
}

export const getTokenHistory = async (tokenAddress, period) => {
  return axiosInstance.get(`token-purchase/token-history?tokenAddress=` + tokenAddress + '&peroid=' + period);
}

export const getTopCreators = async () => {
  return axiosInstance.get(`token-purchase/top-creators`);
}

export const getRecentActivities = async (type) => {
  if (type) {
    return axiosInstance.get(`user/recent-activities?type=` + type);
  }
  return axiosInstance.get(`user/recent-activities`);
}

// Token Purchase Api's

export const purchaseTokenWithUSD = async (body) => {
  return axiosInstance.post(`token-purchase/purchase`, body);
}

export const tokenPurchaseBalance = async () => {
  return axiosInstance.get(`token-purchase/balance`);
}

export const tokenPurchaseHistory = async () => {
  return axiosInstance.get(`token-purchase/history`);
}

export const getTotalTokenPurchase = async () => {
  return axiosInstance.get(`token-purchase/getTotaltoken`);
}

export const tokenPurchaseAmtByVendor = async (userId) => {
  return axiosInstance.get('token-purchase/vendor-token-amount?vendorId=' + userId)
}

//Billing Api's

export const getLatestTransactions = async () => {
  return axiosInstance.get(`billing/get-latest-transactions`);
}

// Token Sell Api's

export const sellToken = async (body) => {
  return axiosInstance.post(`token-purchase/sell-token`, body);
}