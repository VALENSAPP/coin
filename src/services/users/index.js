import axiosInstance from '..';

export async function getAllUser(params = {}) {
    console.log(params, 'params in service');
    
    if (Object.keys(params).length === 0) {
        // No params, call API normally
        console.log('No params, fetching all users');
        
        return axiosInstance.get('user/all');
    } else {
        // Params exist, pass them as query
        return axiosInstance.get('user/all', { params });
    }
}
