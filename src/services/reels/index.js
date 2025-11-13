import axiosInstance from "..";

export const getAllReels = async () => {
    return axiosInstance.get('post/getAllReel');
}