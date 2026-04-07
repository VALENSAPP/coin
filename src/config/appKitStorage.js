import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AppKit Storage implementation backed by AsyncStorage.
 * @see https://docs.reown.com/appkit/react-native/core/options#storage
 */
export const appKitStorage = {
  async getKeys() {
    return AsyncStorage.getAllKeys();
  },

  async getEntries() {
    const keys = await this.getKeys();
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs.map(([k, v]) => {
      if (v == null) {
        return [k, undefined];
      }
      try {
        return [k, JSON.parse(v)];
      } catch {
        return [k, v];
      }
    });
  },

  async getItem(key) {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) {
      return undefined;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  async setItem(key, value) {
    const raw =
      typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, raw);
  },

  async removeItem(key) {
    await AsyncStorage.removeItem(key);
  },
};
