// Toggle between Development and Production URLs here
export const IS_PRODUCTION = false; // Set to true for production

export const DEV_API_URL = 'https://api.valens.app/';
export const PROD_API_URL = 'https://prod-api.valens.app/';

export const API_URL = IS_PRODUCTION ? PROD_API_URL : DEV_API_URL;

// Base URL without trailing slash (used for image prefixes and link sharing)
export const BASE_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
