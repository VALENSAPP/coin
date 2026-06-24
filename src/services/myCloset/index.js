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
    appendIfPresent(formData, 'paymentMethod', 'stripe');
    appendIfPresent(formData, 'shippingOptions', data.shippingOptions);
    appendIfPresent(formData, 'returnPolicy', data.returnPolicy);

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
