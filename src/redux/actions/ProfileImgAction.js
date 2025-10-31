export const SET_PROFILE_IMAGE= 'SET_PROFILE_IMAGE';

export const setProfileImg = (img) => {
    return {
        type: 'SET_PROFILE_IMAGE',
        payload: img,
    };
};