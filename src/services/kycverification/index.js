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

export const getKycToken = async () => {
    return axiosInstance.get(`sumsub-user_verification/token`);
}
export const startKyc = async (userId) => {
    return axiosInstance.post(`sumsub-user_verification/token${userId}`);
}