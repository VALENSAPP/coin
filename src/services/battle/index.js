import axiosInstance from "..";

const normalizeBattlePayload = (data = {}) => {
    const payload = {
        format: data?.format ?? 'POLL',
        battleType: data?.battleType ?? 'OPINION',
        question: data?.question?.trim?.() ?? '',
        options: Array.isArray(data?.options)
            ? data.options.map(option => `${option ?? ''}`.trim()).filter(Boolean)
            : [],
        optionImages: Array.isArray(data?.optionImages)
            ? data.optionImages.filter(Boolean)
            : [],
        startTime: data?.startTime ?? '',
        endTime: data?.endTime ?? '',
        stake: Number(data?.stake ?? 0),
        isPublic: Boolean(data?.isPublic),
        resolutionMethod: data?.resolutionMethod?.trim?.() ?? '',
    };

    const invitedUserId = data?.invitedUserId?.trim?.() ?? '';
    if (invitedUserId) {
        payload.invitedUserId = invitedUserId;
    }

    const creatorChoice = data?.creatorChoice?.trim?.() ?? '';
    if (creatorChoice) {
        payload.creatorChoice = creatorChoice;
    }

    const creatorLockedOption = data?.creatorLockedOption?.trim?.() ?? '';
    if (creatorLockedOption) {
        payload.creatorLockedOption = creatorLockedOption;
    }

    const invitedUserChoice = data?.invitedUserChoice?.trim?.() ?? '';
    if (invitedUserChoice) {
        payload.invitedUserChoice = invitedUserChoice;
    }

    return payload;
};

export const createBattle = async (data = {}) => {
    return axiosInstance.post('battle/create', normalizeBattlePayload(data));
};

export const inviteBattle = async (data ) => {
    return axiosInstance.post('battle/invite', data);
};
export const acceptBattle = async (data ) => {
    return axiosInstance.post('battle/accept', data);
};
export const declinetBattle = async (data ) => {
    return axiosInstance.post('battle/decline', data);
};
export const joinBattle = async (data ) => {
    return axiosInstance.post('battle/join', data);
};
export const predictBattle = async (data ) => {
    return axiosInstance.post('battle/predict', data);
};
export const replyCommentBattle = async (data ) => {
    return axiosInstance.post('battle/comment', data);
};
export const commentUpload = async (data ) => {
    return axiosInstance.post('battle/comment/upload', data);
};
export const commentLike = async (data ) => {
    return axiosInstance.post('battle/comment/like', data);
};
export const voteBattle = async (data ) => {
    return axiosInstance.post('battle/vote', data);
};
export const exploretBattle = async (data ) => {
    return axiosInstance.get('battle/explore', { params: data });
};
export const battleByUserId = async (data ) => {
    return axiosInstance.get('battle/by-user',data);
};
export const getbattle = async (data ) => {
    return axiosInstance.get('battle/get',data);
};
export const battleClose = async (data ) => {
    return axiosInstance.post('battle/close',data);
};
export const battleResolve = async (data ) => {
    return axiosInstance.post('battle/resolve',data);
};
export const battlePoint = async (data ) => {
    return axiosInstance.get('battle/points',data);
};
export const battleWinner = async (battleId) => {
    return axiosInstance.get('battle/winner', {
        params: { battleId },
    });
};
export const voteHeadtoHead = async (data ) => {
    return axiosInstance.post('battle/challenger-position',data);
};
export const voteHeadtoHeadOpponent = async (data ) => {
    return axiosInstance.post('battle/opponent-position',data);
};
