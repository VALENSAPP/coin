import axios from 'axios';
import { BASE_URL, API_PARAM } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseUrl = BASE_URL;

const axiosInstance = axios.create({
    baseURL: 'http://35.174.167.92:3002/',
    maxBodyLength: Infinity
});

export const authInterceptor = axiosInstance.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = 'Bearer ' + token
        }
        {
            if (config.url == "post/create" || config.url == "user/editProfile" || config.url == "story/upload") {
                config.headers['Content-Type'] = 'multipart/form-data';
            }
            else {
                config.headers['Content-Type'] = 'application/json';
            }
        }

        console.log(config, "config=================")
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
        if (error.response) {
            return error.response.data;
        } else if (error.request) {
            console.log("No response received. Request details:", error.request);
        } else {
            // Error in setting up the request
            console.log("Error Message:", error.message);
        }

        return error.response.data;;
    }
);

export default axiosInstance;