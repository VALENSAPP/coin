import axiosinstance from '../../services';
import { fetchAndApplyUserLanguage } from '../../i18n';

// export const getProfile = async (data) => {
//     return axiosinstance.get('user/profile', data);
// }

export const getProfile = async (userId) => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('getProfile: you must pass a valid userId');
  }
  try {
    fetchAndApplyUserLanguage().catch((e) => {
      console.log('fetchAndApplyUserLanguage in getProfile error:', e?.message || e);
    });

    return await axiosinstance.get('user/profile', {
      params: { userId }
    });

  } catch (error) {
    throw new Error(
      error?.response?.data?.message /*|| 'Failed to fetch user profile'*/
    );
  }
};

export const EditProfile = async (data) => { 
    return axiosinstance.patch('user/editProfile', data); 
}

export const checkDisplayName = async (data) => {
    return axiosinstance.post('user/check-display-name', data);
}