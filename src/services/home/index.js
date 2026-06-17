import axiosInstance from "../../services";
import { logApiPostsMedia } from "../../utils/postItemMediaDebug";

export const getposts = async () => {
    const response = await axiosInstance.get('post/all');
    logApiPostsMedia('API GET post/all → response.data', response?.data);
    return response;
}

export const getSuggestedUsers = async (limit) => {
    return axiosInstance.get(`user/suggested-users?limit=` + limit);
}