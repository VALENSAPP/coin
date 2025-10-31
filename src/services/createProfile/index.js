import axiosinstance from '../../services';

// export const getProfile = async (data) => {
//     return axiosinstance.get('user/profile', data);
// }

export const getProfile = async (userId) => {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('getProfile: you must pass a valid userId');
  }
  try {
    return  await axiosinstance.get('user/profile', {
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