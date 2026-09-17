import axiosInstance from '..';

/**
 * Generate client-side UUID/Idempotency key for redemption requests
 */
export const generateIdempotencyKey = () => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `redeem_${timestamp}_${randomStr}`;
};

/**
 * GET /rewards/catalog
 * Get available reward redemption categories & partner programs
 */
export const getCatalog = async (params = {}) => {
  return axiosInstance.get('/rewards/catalog', { params });
};

/**
 * GET /rewards/linked-accounts
 * List authenticated user's linked loyalty accounts
 */
export const getLinkedAccounts = async (params = {}) => {
  return axiosInstance.get('/rewards/linked-accounts', { params });
};

const cleanProvider = (provider, category) => {
  if (!provider) return category === 'GIFT_CARD' ? 'MERIT' : 'POINTS_COM';
  const str = String(provider).toUpperCase().replace(/\./g, '_');
  if (str.includes('POINTS')) return 'POINTS_COM';
  return str;
};

/**
 * POST /rewards/linked-accounts
 * Link a partner loyalty account (Airlines, Hotels, etc.)
 */
export const linkAccount = async (data = {}) => {
  const payload = {
    provider: cleanProvider(data.provider, data.category),
    programCode: data.programCode || 'AEROPLAN',
    programName: data.programName || 'Partner Program',
    accountNumber: data.accountNumber || '',
    accountName: data.accountName || data.accountHolderName || '',
    category: data.category || 'AIRLINE_MILES',
  };
  return axiosInstance.post('/rewards/linked-accounts', payload);
};

/**
 * DELETE /rewards/linked-accounts/:id
 * Unlink a partner loyalty account
 */
export const unlinkAccount = async (id) => {
  return axiosInstance.delete(`/rewards/linked-accounts/${id}`);
};

/**
 * POST /rewards/quote
 * Calculate dynamic exchange quote for Valens points
 */
export const getQuote = async (data = {}) => {
  const payload = {
    category: data.category || 'AIRLINE_MILES',
    provider: cleanProvider(data.provider, data.category),
    programCode: data.programCode || '',
    valensPoints: Number(data.valensPoints) || 0,
  };
  return axiosInstance.post('/rewards/quote', payload);
};

/**
 * POST /rewards/redeem
 * Redeem Valens Points for external rewards (Airlines, Hotels, Gift Cards, Travel)
 */
export const redeemPoints = async (data = {}) => {
  const payload = {
    category: data.category || 'AIRLINE_MILES',
    provider: cleanProvider(data.provider, data.category),
    programCode: data.programCode || '',
    valensPoints: Number(data.valensPoints) || 0,
    expectedRewardAmount: Number(data.expectedRewardAmount) || 0,
    linkedAccountId: data.linkedAccountId || undefined,
    accountNumber: data.accountNumber || undefined,
    idempotencyKey: data.idempotencyKey || generateIdempotencyKey(),
    metadata: data.metadata || undefined,
  };
  return axiosInstance.post('/rewards/redeem', payload);
};

/**
 * GET /rewards/history
 * Get user's reward redemption history & status
 */
export const getRedemptionHistory = async (params = {}) => {
  return axiosInstance.get('/rewards/history', { params });
};
