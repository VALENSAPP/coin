import axiosInstance from '../../services';

export const sendMessage = async (body) => {
    return axiosInstance.post('post/sendMessage',body);
}

export const getAllConversations = async () => {
   return await axiosInstance.get(`post/conversations`);
}

export const getConversationById = async (otherUserId) => {
    return axiosInstance.get(`post/conversation/${otherUserId}`);
}