import axiosInstance from '..';


export async function followers(userId) {
    return axiosInstance.get(`user/followers/${userId}`)
}

export async function following(userId) {
    return axiosInstance.get(`user/following/${userId}`)
}