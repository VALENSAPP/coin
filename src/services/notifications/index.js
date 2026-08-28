import axiosInstance from "../../services";

export const updateFcmToken = async (data) => {
    return axiosInstance.post('user/update-fcm-token', data);
}

export const getAllNotifactions=async()=>{
    return axiosInstance.get('notifications');
}
export const readNotification=async(data) =>{
    console.log(data)
    return axiosInstance.put('notifications/mark-as-read',data)
}

export const unReadNotification=async()=>{
    return axiosInstance.get('notifications/unread-count')
}

export const battleNotification=async()=>{
    return axiosInstance.get('notifications/battle')
}