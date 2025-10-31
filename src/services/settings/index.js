import axiosInstance from "..";

export const getAllSavedPosts = async () => {
    return axiosInstance.get('post/getSavedPost');
}