import axios from 'axios';
import { BASE_URL, API_PARAM } from '../shims/env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseUrl = BASE_URL;

const axiosInstance = axios.create({
    // baseURL: 'https://valenscorp.com/',
    baseURL: 'https://api.valens.app/',

    maxBodyLength: Infinity
});

export const authInterceptor = axiosInstance.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = 'Bearer ' + token
        }
        const isFormData =
            typeof FormData !== 'undefined' && config?.data instanceof FormData;

        const method = (config.method || '').toLowerCase();
        const isMyClosetCreateOrUpdate =
            config.url === 'mycloset' && (method === 'post' || method === 'patch');

        if (
            isFormData ||
            config.url == "post/create" ||
            config.url == "user/editProfile" ||
            config.url == "story/upload" ||
            config.url == "company-profile/upload-documents" ||
            isMyClosetCreateOrUpdate  ||
            config.url == "mycloset/items"
        ) {
            config.headers['Content-Type'] = 'multipart/form-data';
        } else {
            config.headers['Content-Type'] = 'application/json';
        }

        return {
            ...config,
        };
    },
    (error) => Promise.reject(error),
);

export const authInterceptorResponse = axiosInstance.interceptors.response.use(
    (response) => {
        // console.log(response, "res333333333333333333333333")
        return response.data;
    },
    async (error) => {
        const fallback = {
            statusCode: 0,
            message: error?.response?.data?.message || error?.message || 'Network error',
            error: true,
        };

        if (error?.response?.data) {
            return error.response.data;
        }
        if (error?.request) {
            console.log("No response received. Request details:", error.request);
            return fallback;
        }

        // Error in setting up the request
        console.log("Error Message:", error?.message);
        return fallback;
    }
);

export default axiosInstance;
