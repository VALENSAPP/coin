import axiosInstance from "..";

export const kycStart = async (userId, data) => {
    return axiosInstance.post(`kyc/start/${userId}`, data);
}

export const kycWebhook = async (data) => {
    return axiosInstance.post(`kyc/webhook`, data);
}

export const kycStatus = async (userId) => {
    return axiosInstance.get(`kyc/status/${userId}`);
}