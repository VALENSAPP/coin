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