import axiosInstance from "..";

export const createHighlight = async (data) => { 
    return axiosInstance.post('story/highlight/create', data); 
}

export const updateHighlight = async (data) => { 
    return axiosInstance.post('story/highlight/update', data); 
}

export const addHighlight = async (data) => { 
    return axiosInstance.post('story/highlight/add-story', data); 
}
export const removeHighlight = async (data) => { 
    return axiosInstance.post('story/highlight/remove-story', data); 
}
export const getHighlightList = async (data) => { 
    return axiosInstance.get('story/highlight/list', data); 
}
export const getHighlightUserId = async (data) => { 
    return axiosInstance.get('story/highlight/by-user', data); 
}
export const getHighlight = async (data) => { 
    const highlightId = data?.highlightId || data?.params?.highlightId;

    if (highlightId) {
        return axiosInstance.get(`story/highlight/get?highlightId=${encodeURIComponent(String(highlightId))}`);
    }

    return axiosInstance.get('story/highlight/get', data); 
}
