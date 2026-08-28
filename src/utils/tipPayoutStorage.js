import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tipPayoutSetup';

export async function getTipPayoutSetup() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveTipPayoutSetup(data) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      connected: true,
      connectedAt: new Date().toISOString(),
      ...data,
    }),
  );
}

export async function clearTipPayoutSetup() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function maskAccountNumber(accountNumber = '') {
  const digits = String(accountNumber).replace(/\D/g, '');
  if (!digits) return '—';
  const tail = digits.slice(-5);
  return `***** ${tail.slice(0, 4)}-${tail.slice(4) || '0'}`;
}
