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

export const startVerification = async (data) => {
    console.log(startVerification,'UploadDocument>>>>>>>>>>>.');
    
    return axiosInstance.post('sumsub-verification/start', data);
}
export const CheckVerificationStatus = async (data) => {
    console.log(CheckVerificationStatus,'UploadDocument>>>>>>>>>>>.');
    
    return axiosInstance.get('sumsub-verification/status', data);
}