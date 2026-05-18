import axiosInstance from "..";


export const getStoryByUser = async (userId, params = {}) => {
    const queryParams = new URLSearchParams({
        userId: String(userId),
        ...Object.entries(params).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                acc[key] = String(value);
            }
            return acc;
        }, {}),
    });

    return axiosInstance.get(`story/by-user?${queryParams.toString()}`);
}

export const PostStory = async (formData) => {
  const response = await axiosInstance.post('story/upload', formData);
  return response;
};

export const DeleteStory = async (storyId) => {
  return axiosInstance.delete(`story/delete?storyId=${storyId}`);
};

export const getFollowingUserStories = async () => {
  return axiosInstance.get('story/get');
}

export const postCommentStory = async (body) => {
  return axiosInstance.post('story/commentStory',body);
}

export const postLikeStory = async (body) => {
  return axiosInstance.post('story/likeStory',body);
}
export const viewStory = async (body) => {
  return axiosInstance.post('story/view',body);
}
