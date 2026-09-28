import axiosInstance from '..';
import { getAuthDeviceId } from '../authentication';

export async function getAllUser(params = {}) {
    
    if (Object.keys(params).length === 0) {
        // No params, call API normally
        console.log('No params, fetching all users');
        
        return axiosInstance.get('user/all');
    } else {
        // Params exist, pass them as query
        return axiosInstance.get('user/all', { params });
    }
}

/**
 * Search users by display name, username, or email.
 * GET /user/search?query=
 */
export async function searchUsers(query) {
  const q = String(query || '').trim();
  if (!q) return { success: true, data: [] };
  return axiosInstance.get('user/search', { params: { query: q } });
}

export async function getSearchHistory() {
  return axiosInstance.get('user/search/history', { params: { limit: 20 } });
}

export async function postSearchHistory(data) {
  return axiosInstance.post('user/search/history', data);
}

export async function clearSearchHistory() {
  return axiosInstance.delete('/user/search/history/clear-all');
}

export async function deleteSearchHistoryItem(id) {
  return axiosInstance.delete(`/user/search/history/${id}`);
}

export async function updateUserLanguage(language, deviceId) {
  const resolvedDeviceId = (deviceId || (await getAuthDeviceId())) ?? '';
  console.log('Updating user language to:', language, 'deviceId:', resolvedDeviceId);
  return axiosInstance.post('/user/update-language', {
    language,
    deviceId: resolvedDeviceId,
  });
}

/**
 * Get preferred language for authenticated user (GET /user/language?deviceId=...)
 */
export async function getUserLanguage(deviceId) {
  const resolvedDeviceId = (deviceId || (await getAuthDeviceId())) ?? '';
  console.log('Fetching user language with deviceId:', resolvedDeviceId);
    return axiosInstance.get('/user/language/?deviceId=' + resolvedDeviceId);
}

