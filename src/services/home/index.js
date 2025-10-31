import axiosInstance from "../../services";

export const getposts = async () => {
    return axiosInstance.get('post/all');
}

export const getSuggestedUsers = async (limit) => {
    return axiosInstance.get(`user/suggested-users?limit=` + limit);
}