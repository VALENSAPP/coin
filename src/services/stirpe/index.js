import axiosInstance from "..";

export const createCheckoutSession = async () => {
    return axiosInstance.post('billing/subscribe');
}

export const cancelSubscription = async () => {
    return axiosInstance.post('billing/cancel');
}

export const checkSubscription = async () => {
    return axiosInstance.get('billing/me');
}

export const buyCreditHits = async (data) => {
    return axiosInstance.post('billing/buy-hit', data);
}

/** Buy mission hits / credits using Valens platform points (no Stripe). */
export const buyHitWithPoints = async (data) => {
    return axiosInstance.post('billing/buy-hit-with-points', data);
}

// export const FanPageSubscription = async () => {
//     return axiosInstance.post('billing/fans-page-subscription');
// }
export const FanPageSubscription = async (data = {}) => {
    return axiosInstance.post('billing/pay-following', data);
}

export const getAllFanSubscriptionList = async (id) => {
    return axiosInstance.get('billing/user-buy-fan-subscription-list?userId=' + id);
}

export const getMyFanSubscriptionList = async (id) => {
    return axiosInstance.get('billing/fan-subscription-user-list?userId=' + id);
}

export const getFansubscriptionStatus = async (id) => {
  return axiosInstance.get(`billing/getfanSubscriptionStatus/${id}`);
};

export const sendTip = async (data) => {
    console.log('sendTip data:', data);
  return axiosInstance.post('billing/send-tip', data);
};

export const payEbook = async (data) => {
  return axiosInstance.post('billing/ebook-payment', data);
};

export const payMarketplaceEbook = async (data) => {
  return axiosInstance.post('billing/shop-ebook-payment', data);
};