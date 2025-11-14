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
  return axiosInstance.get('/user/subscription/' + id);
}

export const deleteUserSubscription = async (id) => {
  return axiosInstance.delete('/user/subscription/' + id);
}