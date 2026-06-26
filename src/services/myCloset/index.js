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

const buildItemPayload = data => {
  const payload = data instanceof FormData ? data : new FormData();

  if (!(data instanceof FormData) && data && typeof data === 'object') {
    appendItemField(payload, 'name', data.name);
    appendItemField(payload, 'category', data.category);
    appendItemField(payload, 'brand', data.brand);
    appendItemField(payload, 'condition', normalizeItemCondition(data.condition));
    appendItemField(payload, 'description', data.description);
    appendItemField(payload, 'price', data.price);
    appendItemField(payload, 'quantity', data.quantity);
    appendItemField(payload, 'shippingOption', normalizeItemShippingOption(data.shippingOption));
    appendItemField(payload, 'shippingOptions', normalizeItemShippingOption(data.shippingOptions));
    appendItemField(payload, 'estimateShippingTime', data.estimateShippingTime);
    appendItemField(payload, 'returnPolicy', data.returnPolicy);

    if (Array.isArray(data.images)) {
      data.images.forEach(image => appendItemImage(payload, image));
    } else if (data.image) {
      appendItemImage(payload, data.image);
    }
  }

  return payload;
};

export const createMyClosetItem = async data => {
  return axiosInstance.post('mycloset/items', buildItemPayload(data));
};

export const updateMyClosetItem = async (itemId, data) => {
  return axiosInstance.patch(`mycloset/items/${itemId}`, buildItemPayload(data));
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
  console.log('addCartItem------------------', data)
  return axiosInstance.post('cart/items', data);
}

export const getCart = async () => {
  return axiosInstance.get('/cart');
}

export const updateCartItem = async (id, data) => {
  return axiosInstance.patch(`/cart/items/${id}`, data);
}

export const deleteCartItem = async (id) => {
  return axiosInstance.delete(`/cart/items/${id}`);
}

export const clearCart = async () => {
  return axiosInstance.delete('/cart');
}
