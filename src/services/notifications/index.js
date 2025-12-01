import axiosInstance from "../../services";

export const updateFcmToken = async (data) => {
    return axiosInstance.post('user/update-fcm-token', data);
}