import axiosInstance from '..';

export async function followers(userId) {
    return axiosInstance.get(`user/followers/${userId}`)
}

export async function following(userId) {
    return axiosInstance.get(`user/following/${userId}`)
}

export async function requestWithdrawal(data) {
    return axiosInstance.post(`billing/request-withdrawal`, data)
}

export async function getWithdrawalHistory() {
    return axiosInstance.get(`billing/withdrawal-history`)
}

export async function createOnboardingLink() {
    return axiosInstance.post(`billing/create-onboarding-link`)
}