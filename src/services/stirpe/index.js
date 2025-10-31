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