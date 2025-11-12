import { Platform } from 'react-native';
import axiosInstance from '..';

export const createPost = async data => {
  const formData = new FormData();

  if (data.caption) {
    formData.append("caption", data.caption);
  }

  if (data.type) {
    formData.append("type", data.type);
  }

  if (data.raiseAmount) {
    formData.append("raiseAmount", data.raiseAmount);
  }

  if (data.start_time) {
    formData.append("start_time", data.start_time);
  }

  if (data.end_time) {
    formData.append("end_time", data.end_time);
  }

  if (data.link) {
    formData.append("link", data.link);
  }

  if (Array.isArray(data.media)) {
    data.media.forEach(file => {
      if (!file.type || !file.uri) {
        console.warn("Skipping invalid file:", file);
        return;
      }

      formData.append("images", {
        uri: Platform.OS === "android" ? file.uri : file.uri.replace("file://", ""),
        name: file.name || file.uri.split("/").pop(),
        type: file.type,
      });
    });
  }
  return axiosInstance.post('post/create', formData);
}

export const getPostByUser = async userId => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('getPostsByUser: you must pass a valid userId');
  }
  return axiosInstance.get('post/by-user', {
    params: { userId }
  });
};

export const getPostById = async (postId) => {
  if (!postId || typeof postId !== 'string') {
    throw new Error('getPostById: you must pass a valid postId');
  }
  return await axiosInstance.get(`post/${postId}`);

};

export async function getUserCredentials(userId) {
  return axiosInstance.get(`user/profile?userId=${userId}`);
}

export async function getUserDashboard(userId) {
  return axiosInstance.get(`user/dashboard?userId=${userId}`);
}

// services/post.js
export async function savePost(postId) {
  return axiosInstance.post('/post/save', { postId });
}

export async function unSavePost(postId) {
  return axiosInstance.post('/post/unsave', { postId });
}

export async function getPostlikes(postId) {
  return axiosInstance.get(`post/like/list?postId=${postId}`);
}

export async function likePost(postId) {
  return axiosInstance.post('/post/like', { postId });
}

export async function getComments(postId) {
  return axiosInstance.get(`post/comment/list?postId=${postId}`);
}

export async function postComment(postId, comment) {
  return axiosInstance.post('/post/comment', { postId, comment });
}

export async function deleteComment(commentId, postId) {
  return axiosInstance.delete(`/post/deleteComment?commentId=${commentId}&postId=${postId}`);
}

export async function editComment(commentId, comment) {
  return axiosInstance.post('post/editComment', { commentId, comment });
}

export async function deletePost(postId, userId) {
  return axiosInstance.delete('post/delete', {
    params: { postId, userId },
  });
}

export async function follow(followingId) {
  return axiosInstance.post('user/follow', { followingId })
}

export async function unfollow(followingId) {
  return axiosInstance.post('user/unfollow', { followingId })
}

export async function HidePost(postId) {
  return axiosInstance.post('post/hide', { postId })
}

export async function unHidePost(postId) {
  return axiosInstance.post('post/unhide', { postId })
}

export async function getHidePost() {
  return axiosInstance.get('post/getHidePost')
}

export async function sharePost(body) {
  return axiosInstance.post('post/sharepost', body)
}

export async function GetAllReels(){
  return axiosInstance.get('/post/getAllReel')
}