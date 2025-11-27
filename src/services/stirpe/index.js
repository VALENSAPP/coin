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

export const FanPageSubscription = async () => {
    return axiosInstance.post('billing/fans-page-subscription');
}

export const getAllFanSubscriptionList = async (id) => {
    return axiosInstance.get('billing/user-buy-fan-subscription-list?userId=' + id);
}

export const getMyFanSubscriptionList = async (id) => {
    return axiosInstance.get('billing/fan-subscription-user-list?userId=' + id);
}