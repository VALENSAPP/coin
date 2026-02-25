import { log } from "util";
import axiosInstance from "..";

export const CreateCompanyProfile = async (data) => { 
    return axiosInstance.post('company-profile', data); 
}

export const GetCompanyProfile = async () => { 
    console.log(GetCompanyProfile,'GetCompanyProfile>>>>>>');
    return axiosInstance.get('company-profile/me'); 
}

export const UpdateCompanyProfile = async (data) => {
    return axiosInstance.patch('company-profile', data);
}
