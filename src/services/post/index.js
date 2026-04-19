import { Platform } from 'react-native';
import axiosInstance from '..';
import { appendStoryAudioFiles } from '../../utils/storyAudioUpload';

export const createPost = async data => {
  const formData = new FormData();

  if (data.music != null && String(data.music).trim() !== '') {
    formData.append('music', String(data.music).trim());
  }

  if (data.youtubeMusicMeta != null && String(data.youtubeMusicMeta).trim() !== '') {
    const ytm =
      typeof data.youtubeMusicMeta === 'string'
        ? data.youtubeMusicMeta
        : JSON.stringify(data.youtubeMusicMeta);
    formData.append('youtubeMusicMeta', ytm);
  }

  if (data.caption) {
    formData.append("caption", data.caption);
  }

  if (data.taggedPeople) {
    formData.append("taggedPeople", data.taggedPeople);
  }

  if (data.type) {
    formData.append("type", data.type);
  }

  if (data.raiseAmount) {
    formData.append("raiseAmount", data.raiseAmount);
  }

  if (data.currency) {
    formData.append("currency", data.currency);
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

  if (data.postMeta != null) {
    const meta =
      typeof data.postMeta === 'string' ? data.postMeta : JSON.stringify(data.postMeta);
    formData.append('postMeta', meta);
  }

  // Same shape as story upload (`story/upload`): lets backend reuse `storyMeta` + `audio_0`… handling.
  if (data.storyMeta != null) {
    const sm =
      typeof data.storyMeta === 'string' ? data.storyMeta : JSON.stringify(data.storyMeta);
    formData.append('storyMeta', sm);
  }

  if (Array.isArray(data.storyAudioClips) && data.storyAudioClips.length > 0) {
    await appendStoryAudioFiles(formData, data.storyAudioClips);
  }

  return axiosInstance.post('post/create', formData);
}

export const getPostByUser = async (userId, type = '') => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('getPostByUser: you must pass a valid userId');
  }

  return axiosInstance.get('post/by-user', {
    params: {
      userId,
      type,
    },
  });
};

export const getPostById = async (postId) => {
  if (!postId || typeof postId !== 'string') {
    throw new Error('getPostById: you must pass a valid postId');
  }
  return await axiosInstance.get(`post/by-id/${postId}`);

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

export async function postComment(postId, comment, parentCommentId = null) {
  const payload = { postId, comment };
  if (parentCommentId) {
    payload.parentCommentId = parentCommentId;
  }
  return axiosInstance.post('/post/comment', payload);
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

export async function editPost(postId, data = {}) {
  if (!postId) {
    throw new Error('editPost: postId is required');
  }

  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(item => {
        formData.append(key, item);
      });
      return;
    }

    formData.append(key, value);
  });

  return axiosInstance.post(`post/edit/${postId}`, formData);
}

export async function follow(followingId) {
  return axiosInstance.post('user/follow', { followingId })
}

export async function unfollow(followingId) {
  return axiosInstance.post('user/unfollow', { followingId })
}

export async function HidePost(postId) {
  console.log(HidePost, 'hide post')

  return axiosInstance.post('post/hide', { postId })
}

export async function unHidePost(postId) {
  console.log(unHidePost, 'unhide post')
  return axiosInstance.post('post/unhide', { postId })
}

export async function getHidePost() {
  return axiosInstance.get('post/getHidePost')
}

export async function sharePost(body) {
  return axiosInstance.post('post/sharepost', body)
}

export async function GetAllReels() {
  return axiosInstance.get('/post/getAllReel')
}

export async function getHideChatConversation(chatId) {
  return axiosInstance.post('/post/hideChat', { chatId });
}

export async function chatStatusUpdate(chatId) {
  return axiosInstance.post('/post/chatStatusUpdate', { chatId });
}
export async function reportPost(data) {
  return axiosInstance.post('/post/report', data);
}

export async function postCommentReaction(data) {
  return axiosInstance.post('/post/comment/reaction', data);
}