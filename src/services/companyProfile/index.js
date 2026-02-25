import axiosInstance from "..";

export const CreateCompanyProfile = async (data) => { 
    return axiosInstance.post('company-profile', data); 
}

export const GetCompanyProfile = async () => { 
    return axiosInstance.get('company-profile/me'); 
}

export const UpdateCompanyProfile = async (data) => {
    return axiosInstance.patch('company-profile', data);
}

export const UploadDocument = async (data) => {
    console.log(UploadDocument,'UploadDocument>>>>>>>>>>>.');
    
    return axiosInstance.post('company-profile/upload-documents', data);
}
