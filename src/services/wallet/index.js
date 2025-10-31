import axiosInstance from "..";

export const getCreditsLeft = async () => {
  return axiosInstance.get('/user/getHitLeft');
}

export const userChangePassword = async (data) => {
  return axiosInstance.post('/user/change-password', data);
}