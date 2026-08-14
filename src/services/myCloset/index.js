import axiosInstance from '..';

const appendIfPresent = (formData, key, value) => {
  if (value == null) return;
  const stringValue = String(value).trim();
  if (!stringValue) return;
  formData.append(key, stringValue);
};

export const createMyCloset = async data => {
  const formData = data instanceof FormData ? data : new FormData();

  if (!(data instanceof FormData) && data && typeof data === 'object') {
    appendIfPresent(formData, 'shopName', data.shopName);
    appendIfPresent(formData, 'shopUsername', data.shopUsername);
    appendIfPresent(formData, 'description', data.description);
    appendIfPresent(formData, 'shopCategory', data.shopCategory);
    appendIfPresent(formData, 'location', data.location);
    appendIfPresent(formData, 'whoCanBuy', data.whoCanBuy);
    appendIfPresent(formData, 'paymentMethod', data.paymentMethod || 'stripe');
    appendIfPresent(formData, 'shippingOptions', data.shippingOptions);
    appendIfPresent(formData, 'returnPolicy', data.returnPolicy);
    appendIfPresent(formData, 'shopPreferences', data.shopPreferences);
    appendIfPresent(formData, 'notifications', data.notifications);

    if (data.shopLogo?.uri) {
      formData.append('shopLogo', {
        uri: data.shopLogo.uri,
        name: data.shopLogo.name || `shop-logo-${Date.now()}.jpg`,
        type: data.shopLogo.type || 'image/jpeg',
      });
    }
  }

  return axiosInstance.post('mycloset', formData);
};

export const getMyClosetMe = async () => {
  return axiosInstance.get('mycloset/me');
};

export const getMyClosetItems = async userId => {
  const suffix = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return axiosInstance.get(`mycloset/items${suffix}`);
};

const appendItemField = (formData, key, value) => {
  if (value == null) return;
  const stringValue = String(value).trim();
  if (!stringValue) return;
  formData.append(key, stringValue);
};

const appendItemImage = (formData, image) => {
  if (!image?.uri) return;
  formData.append('images', {
    uri: image.uri,
    name: image.name || `item-${Date.now()}.jpg`,
    type: image.type || 'image/jpeg',
  });
};

const normalizeItemCondition = value => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'new') return 'New';
  if (normalized === 'used') return 'Used';
  if (normalized === 'good_condition' || normalized === 'good condition') return 'Good_condition';
  if (normalized === 'need_attention' || normalized === 'need attention') return 'Need_attention';
  return value;
};

const normalizeItemShippingOption = value => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'pickup' || normalized === 'local_pick') return 'local_pick';
  return 'ship_items';
};

const formatPickupHours = hours => String(hours || '').trim();
const parseFee = fee => Number(fee) || 0;

/**
 * Single source of truth for building the /mycloset/items multipart payload.
 * Accepts a "draft"-shaped object:
 * { photos/images, itemName/name, category, brand, condition, description,
 *   price, quantity, shippingEnabled, pickupEnabled, shippingFee, shippingTime,
 *   pickupAddress, pickupHours, buyerChatEnabled, returnPolicy }
 */
const buildItemPayload = draft => {
  // Defensive: if a fully-built FormData is passed in (e.g. from a caller
  // that already assembled its own payload), use it as-is rather than
  // re-reading (now-undefined) fields off of it.
  if (draft instanceof FormData) return draft;

  const payload = new FormData();

  const images = draft.photos || draft.images || (draft.image ? [draft.image] : []);
  images.forEach(image => appendItemImage(payload, image));

  const shippingEnabled = !!draft.shippingEnabled;
  const pickupEnabled = !!draft.pickupEnabled;
  const shippingOption =
    shippingEnabled && pickupEnabled ? 'both'
      : pickupEnabled ? 'local_pick'
        : normalizeItemShippingOption(draft.shippingOption || 'ship_items');

  payload.append('name', String(draft.itemName ?? draft.name ?? '').trim());
  payload.append('category', String(draft.category || '').trim());
  if (draft.brand) payload.append('brand', String(draft.brand).trim());
  payload.append('condition', normalizeItemCondition(draft.condition));
  payload.append('description', String(draft.description || '').trim());
  payload.append('price', String(draft.price ?? ''));
  payload.append('quantity', String(draft.quantity ?? 1));
  payload.append('shippingOption', shippingOption);

  if (shippingOption === 'ship_items' || shippingOption === 'both') {
    payload.append('shippingFee', String(parseFee(draft.shippingFee)));
    if (draft.shippingTime || draft.estimateShippingTime) {
      payload.append('estimateShippingTime', draft.shippingTime || draft.estimateShippingTime);
    }
  }

  if (shippingOption === 'local_pick' || shippingOption === 'both') {
    if (draft.pickUpCity) payload.append('pickUpCity', String(draft.pickUpCity).trim());
    if (draft.pickupLocation) payload.append('pickupLocation', String(draft.pickupLocation).trim());
    payload.append('pickupAddress', String(draft.pickupAddress || '').trim());
    payload.append('pickupAvailableHours', formatPickupHours(draft.pickupHours ?? draft.pickupAvailableHours));
    payload.append('buyerChatEnabled', String(draft.buyerChatEnabled ?? true));
  }

  payload.append('returnPolicy', String(draft.returnPolicy || '').trim());

  return payload;
};

export const createMyClosetItem = async draft => {
  return axiosInstance.post('mycloset/items', buildItemPayload(draft));
};

export const updateMyClosetItem = async (itemId, data) => {
  // The item management screen already creates a FormData payload. Rebuilding
  // it treats FormData like a plain object, which strips required fields and
  // causes the API to reject the update with a 400 response.
  const payload = data instanceof FormData ? data : buildItemPayload(data);
  return axiosInstance.patch(`mycloset/items/${itemId}`, payload);
};

export const deleteMyClosetItem = async itemId => {
  return axiosInstance.delete(`mycloset/items/${itemId}`);
};

const appendShopField = (formData, key, value) => {
  if (value == null) return;
  const stringValue = String(value).trim();
  if (!stringValue) return;
  formData.append(key, stringValue);
};

const appendFileField = (formData, key, file) => {
  if (!file?.uri) return;
  formData.append(key, {
    uri: file.uri,
    name: file.name || `${key}-${Date.now()}.jpg`,
    type: file.type || 'image/jpeg',
  });
};

export const updateMyCloset = async data => {
  const payload = data instanceof FormData ? data : new FormData();

  if (!(data instanceof FormData) && data && typeof data === 'object') {
    appendShopField(payload, 'shopName', data.shopName);
    appendShopField(payload, 'shopUsername', data.shopUsername);
    appendShopField(payload, 'description', data.description);
    appendShopField(payload, 'shopCategory', data.shopCategory);
    appendShopField(payload, 'location', data.location);
    appendShopField(payload, 'whoCanBuy', data.whoCanBuy);
    appendShopField(payload, 'paymentMethod', data.paymentMethod);
    appendShopField(payload, 'shippingOptions', data.shippingOptions);
    appendShopField(payload, 'returnPolicy', data.returnPolicy);
    appendShopField(payload, 'shopPreferences', data.shopPreferences);
    appendShopField(payload, 'notifications', data.notifications);
    appendFileField(payload, 'shopLogo', data.shopLogo);
  }

  return axiosInstance.patch('mycloset', payload);
};

export const updateMyClosetMe = async data => updateMyCloset(data);

export const deleteMyCloset = async () => {
  return axiosInstance.delete('mycloset');
};

export const getMyClosetById = async (data) => {
  return axiosInstance.post(`/mycloset/by-user`, data);
};

export const getClosetItemsByClosetId = async (closetId) => {
  return axiosInstance.get(`/mycloset/${closetId}/items`);
};

export const trackClosetView = async (closetId) => {
  return axiosInstance.post(`/mycloset/${closetId}/view`);
}

export const checkoutCart = async (cartId) => {
  return axiosInstance.post('/cart/checkout?cartId=' + cartId);
};

export const postAddress = async (address) => {
  return axiosInstance.post('address/addAddress', address);
}

export const getAddress = async () => {
  return axiosInstance.get('/address/getAddress');
}

export const updateAddress = async (id, data) => {
  return axiosInstance.patch(`/address/updateAddress/${id}`, data);
}

export const deleteAddress = async (id) => {
  return axiosInstance.delete(`/address/deleteAddress/${id}`);
}

export const makeAddressDefault = async (id) => {
  return axiosInstance.patch(`/address/makeAddressDefault/${id}`);
}

export const addCartItem = async (data) => {
  return axiosInstance.post('cart/items', data);
}

export const getCart = async (data) => {
  return axiosInstance.get('/cart?sellerId=' + data.sellerId);
}

export const updateCartItem = async (id, data) => {
  return axiosInstance.patch(`/cart/items/${id}`, data);
}

export const deleteCartItem = async (id) => {
  return axiosInstance.delete(`/cart/items/${id}`);
}

export const setCartItemShippingChoice = async (cartItemId, shippingChoice) => {
  return axiosInstance.patch(`/cart/items/${cartItemId}/shipping-choice`, { shippingChoice });
}

export const clearCart = async () => {
  return axiosInstance.delete('/cart');
}

export const getWishlist = async (sellerId) => {
  return axiosInstance.get('/wishlist', {
    params: sellerId ? { sellerId } : undefined,
  });
};

export const addWishlistItem = async (productId) => {
  return axiosInstance.post('/wishlist/items', { productId });
};

export const deleteWishlistItem = async (wishlistItemId) => {
  return axiosInstance.delete(`/wishlist/items/${wishlistItemId}`);
};

export const getSellerOrders = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.status) query.append('status', params.status);
  if (params.shippingType) query.append('shippingType', params.shippingType);
  const queryString = query.toString();
  return axiosInstance.get(`seller/orders${queryString ? `?${queryString}` : ''}`);
};

export const getSellerOrderDetails = async orderId => {
  return axiosInstance.get(`seller/orders/${orderId}`);
};

export const markOrderProcessing = async orderId => {
  return axiosInstance.patch(`seller/orders/${orderId}/processing`);
};

export const markOrderShipped = async (orderId, { carrier, trackingNumber } = {}) => {
  return axiosInstance.patch(`seller/orders/${orderId}/ship`, { carrier, trackingNumber });
};

export const sendDeliveryOtp = async (orderId, expiresInMinutes = 10) => {
  return axiosInstance.post(`seller/orders/${orderId}/deliver/send-otp`, { expiresInMinutes });
};

export const deliverLocalPickupOrder = async (orderId, otp) => {
  return axiosInstance.patch(`seller/orders/${orderId}/deliver`, { otp });
};

export const markOrderDelivered = async (orderId, data) => {
  const payload = typeof data === 'string' ? { otp: data } : data;
  return axiosInstance.patch(`seller/orders/${orderId}/deliver`, payload);
};

// ── Buyer Orders ────────────────────────────────────────────────
export const getBuyerOrders = async () => {
  return axiosInstance.get('/orders');
}

export const getBuyerOrderDetail = async orderId => {
  return axiosInstance.get(`/orders/${orderId}`);
};

export const cancelBuyerOrder = async orderId => {
  return axiosInstance.patch(`/orders/${orderId}/cancel`);
};

export const getSellerDashboard = async () => {
  return axiosInstance.get('/dashboard');
};

export const getMarketplaceBattleInsights = async battleId => {
  return axiosInstance.get(`/marketplace-battles/${battleId}/insights`);
};

export const getMarketplaceOverview = async (range) => {
  return axiosInstance.get('/dashboard/marketPlaceOverview', { params: { range } });
};

export const getMarketplaceAnalytics = async (range) => {
  return axiosInstance.get('/dashboard/marketPlaceAnalytics', { params: { range } });
};

//Payment APIs

export const createPaymentSession = async (data) => {
  return axiosInstance.post('/payment/create', data);
};

export const getPaymentDetails = async () => {
  return axiosInstance.get('/payment/me/list');
};

export const getRecentPaymentDetails = async () => {
  return axiosInstance.get('/payment/me/list/recent');
};

export const getPaymentDetailsByPaymentId = async (paymentId) => {
  return axiosInstance.get(`/payment/${paymentId}`);
};

// Marketplace Battle APIs

export const createMarketplaceBattle = async ({
  title,
  description,
  category = 'Fashion',
  visibility = 'Everyone',
  whoCanVote = 'Everyone',
  shareToFeed = false,
  productIds,
  startAt,
  endAt,
}) => {
  return axiosInstance.post('marketplace-battles', {
    title,
    description,
    category,
    visibility,
    whoCanVote,
    shareToFeed,
    productIds,
    startAt,
    endAt,
  });
};

export const getMarketplaceBattleDetails = async (battleId) => {
  return axiosInstance.get(`marketplace-battles/me/${battleId}`);
};

export const trackMarketplaceBattleView = async battleId => {
  return axiosInstance.post(`/marketplace-battles/${battleId}/view`);
};

export const voteOnBattle = async (battleId, participantId) => {
  return axiosInstance.post(`marketplace-battles/${battleId}/vote`, { participantId });
};

export const getBattleVoters = async (battleId, page = 1, limit = 20) => {
  return axiosInstance.get(`marketplace-battles/${battleId}/voters`, { params: { page, limit } });
}

export const getClosetBattlesPriority = (closetId, { page = 1, limit = 10 } = {}) => {
  return axiosInstance.get(`mycloset/${closetId}/marketplace-battles-priority`, {
    params: { page, limit },
  });
}

// Marketplace Battle Comments APIs 

export const getMarketplaceBattleComments = async (battleId, page = 1, limit = 20, sortOrder = 'desc') => {
  return axiosInstance.get(`marketplace-battles/${battleId}/comments`, {
    params: { page, limit, sortOrder },
  });
}

export const addMarketplaceBattleComment = async (battleId, comment) => {
  return axiosInstance.post(`marketplace-battles/${battleId}/comments`, { comment });
}

export const deleteMarketplaceBattleComment = async (battleId, commentId) => {
  return axiosInstance.delete(`marketplace-battles/${battleId}/comments/${commentId}`);
}

export const reactToMarketplaceBattleComment = async (battleId, commentId, reaction) => {
  return axiosInstance.post(`marketplace-battles/${battleId}/comments/${commentId}/reaction`, {
    reaction,
  });
};

export const getMarketplaceBattleBoostPackages = async () => {
  return axiosInstance.get('/marketplace-battle-boosts/packages');
};

export const getMarketplaceBattleBoostByBattle = async battleId => {
  return axiosInstance.post('/marketplace-battle-boosts/by-battle', { battleId });
};

export const createMarketplaceBattleBoostIntent = async (battleId, data) => {
  return axiosInstance.post(`/marketplace-battles/${battleId}/boosts`, data);
};

export const createMarketplaceBattleBoostPaymentSession = async boostId => {
  return axiosInstance.post(`/marketplace-battle-boosts/${boostId}/payment`);
};

export const createMarketplaceBattleWinnerPromotion = async (battleId, data) => {
  return axiosInstance.post(`/marketplace-battles/${battleId}/winner-promotion`, data);
};

export const getEarning = async (data) => {
  return axiosInstance.get('earnings', data);
};

export const getEarningHistory = async (data) => {
  return axiosInstance.get('earnings/history', data);
};

export const getbattlePerformance = async (data) => {
  return axiosInstance.get('marketplace-battles/marketPlaceBattleOverview', data);
};

export const getShops = async (search) => {
  return axiosInstance.get('/mycloset/shops', { params: { search } });
};

export const challengeShop = async (data) => {
  return axiosInstance.post('/marketplace-battles/challenge', data);
};

export const acceptMarketplaceBattle = async (battleId) => {
  return axiosInstance.post('/marketplace-battles/' + battleId + '/challenge/accept');
};

export const declineMarketplaceBattle = async (battleId) => {
  return axiosInstance.post('/marketplace-battles/' + battleId + '/challenge/decline');
};

export const getMarketplaceBattleChallengeStatus = async (battleId) => {
  return axiosInstance.get('/marketplace-battles/' + battleId + '/challenge');
};
