import axiosInstance from "..";


export const getStoryByUser = async (userId) => {
    return axiosInstance.get(`story/by-user?userId=${userId}`);
}

export const PostStory = async (formData) => {
  return axiosInstance.post('story/upload', formData);
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