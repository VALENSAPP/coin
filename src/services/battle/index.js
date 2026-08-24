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

    // Prediction battle fields — were previously dropped, causing
    // "Prediction category required" even when the caller sent them.
    if (data?.battleType === 'PREDICTION') {
        const predictionProvider = data?.predictionProvider?.trim?.() ?? '';
        if (predictionProvider) {
            payload.predictionProvider = predictionProvider;
        }

        const externalMarketId = data?.externalMarketId?.trim?.() ?? '';
        if (externalMarketId) {
            payload.externalMarketId = externalMarketId;
        }

        const externalEventId = data?.externalEventId?.trim?.() ?? '';
        if (externalEventId) {
            payload.externalEventId = externalEventId;
        }

        const predictionCategory = data?.predictionCategory?.trim?.() ?? '';
        if (predictionCategory) {
            payload.predictionCategory = predictionCategory;
        }
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
export const editBattle = async (data ) => {
    return axiosInstance.post('battle/edit-question',data);
};
export const pinComment = async (data ) => {
    return axiosInstance.post('battle/comment/pin',data);
};
export const unpinComment = async (data ) => {
    return axiosInstance.post('battle/comment/unpin',data);
};
export const commentHighlight = async (data) => {
    return axiosInstance.post('battle/comment/highlight', data);
};
export const removeCommentHighlight = async (data) => {
    return axiosInstance.post('battle/comment/highlight/remove', data);
};
export const filtterBattle = async (params) => {
    return axiosInstance.get('battle/myBattleTracking', { params });
};

export async function getPredictionCategories() {
  return axiosInstance.get('battle/prediction/categories');
}
 
/**
 * Get third-party prediction questions by category.
 * GET /battle/prediction/questions?category=&provider=&page=&limit=
 * Response: { statusCode, success, data: { data: [...], pagination? } }
 */
export async function getPredictionQuestions(params = {}) {
  const { category, subCategory, league, provider, page = 1, limit = 20 } = params;
 
  if (!category) {
    return Promise.reject(new Error('category is required'));
  }
 
  const query = { category, page, limit };
  if (provider) {
    query.provider = provider;
  }
  if (subCategory) {
    query.subCategory = subCategory;
  }
  if (league) {
    query.league = league;
  }
 
  return axiosInstance.get('battle/prediction/questions', { params: query });
}
 