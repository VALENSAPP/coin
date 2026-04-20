import axiosinstance from '../../services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import Geolocation from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';
import { saveOrUpdateAccount } from '../../utils/accountSession';

export const handleLoginSuccess = async (token, dispatch, navigation, getProfileData, toast, accessToken, refreshToken) => {
    if (token) {
        await AsyncStorage.setItem('token', token);
        getProfileData(dispatch, navigation, toast, accessToken, refreshToken);
        // navigation.reset({ index: 0, routes: [{ name: 'MainTabNavigator' }] });
    } else {
        throw new Error('Login successful, but no token received.');
    }
};


export const signup = async (data) => {
    try {
        const deviceId = DeviceInfo.getUniqueId ? await Promise.resolve(DeviceInfo.getUniqueId()) : undefined;
        const deviceName = DeviceInfo.getDeviceName ? await DeviceInfo.getDeviceName() : undefined;
        const deviceType = DeviceInfo.getSystemName ? DeviceInfo.getSystemName() : undefined;
        const location = await getCurrentLocationString();

        const devicePayload = {
            // Prefer backend-friendly camelCase keys
            ...(deviceId ? { deviceId } : {}),
            ...(deviceName ? { deviceName } : {}),
            ...(deviceType ? { deviceType } : {}),
            ...(location ? { location } : {}),
            // Backward compatible snake_case keys (in case backend expects these)
            ...(deviceId ? { device_id: deviceId } : {}),
            ...(deviceName ? { device_name: deviceName } : {}),
            ...(deviceType ? { device_type: deviceType } : {}),
        };
        console.log(devicePayload, 'data in devieve info')
        return axiosinstance.post('/user/register', { ...(data || {}), ...devicePayload });
    } catch (error) {
        // Fallback to normal login if device info fails for any reason
        return axiosinstance.post('/user/register', data);
    }
}

const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
        try {
            const status = await Geolocation.requestAuthorization('whenInUse');
            return status === 'granted';
        } catch (error) {
            console.log(error, 'error requesting ios location permission');
            return false;
        }
    }

    if (Platform.OS !== 'android') {
        return true;
    }

    const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
            title: 'Location Permission',
            message: 'Allow location access to include your current location during login.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
        },
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const getCurrentLocationString = async () => {
    try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
            return undefined;
        }

        const position = await new Promise((resolve, reject) => {
            Geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: false,
                    timeout: 15000,
                    maximumAge: 60000,
                },
            );
        });

        const latitude = position?.coords?.latitude;
        const longitude = position?.coords?.longitude;

        if (
            typeof latitude !== 'number' ||
            Number.isNaN(latitude) ||
            typeof longitude !== 'number' ||
            Number.isNaN(longitude)
        ) {
            return undefined;
        }

        return `${latitude},${longitude}`;
    } catch (error) {
        console.log(error, 'error getting login location');
        return undefined;
    }
};

export const login = async (data) => {
    try {
        const deviceId = DeviceInfo.getUniqueId ? await Promise.resolve(DeviceInfo.getUniqueId()) : undefined;
        const deviceName = DeviceInfo.getDeviceName ? await DeviceInfo.getDeviceName() : undefined;
        const deviceType = DeviceInfo.getSystemName ? DeviceInfo.getSystemName() : undefined;
        const location = await getCurrentLocationString();

        const devicePayload = {
            // Prefer backend-friendly camelCase keys
            ...(deviceId ? { deviceId } : {}),
            ...(deviceName ? { deviceName } : {}),
            ...(deviceType ? { deviceType } : {}),
            ...(location ? { location } : {}),
            // Backward compatible snake_case keys (in case backend expects these)
            ...(deviceId ? { device_id: deviceId } : {}),
            ...(deviceName ? { device_name: deviceName } : {}),
            ...(deviceType ? { device_type: deviceType } : {}),
        };
        console.log(devicePayload, 'data in devieve info')
        return axiosinstance.post('/auth/login', { ...(data || {}), ...devicePayload });
    } catch (error) {
        // Fallback to normal login if device info fails for any reason
        return axiosinstance.post('/auth/login', data);
    }
}

export const forgotPassword = async (data) => {
    return axiosinstance.post('/user/forgot-password', data);
}

export const resetPassword = async (data) => {
    return axiosinstance.post('/user/reset-password', data);
}

export const verifyOtp = async (data) => {
    return axiosinstance.post('/user/verify-otp', data);
}

export const sendEmailotp = async (data) => {
    return axiosinstance.post('/user/send-email-otp', data);
}

export const verifyEmailOtp = async (data) => {
    return axiosinstance.post('/user/verify-email-otp', data);
}

export const firebasePost = async (url, data) => {
    return axiosinstance.post(`auth/${url}`, data);
}

export const refreshToken = async (token) => {
    return axiosinstance.post('auth/refresh', token);
}

export const logout = async (token) => {
    return axiosinstance.post('/auth/logout', token);
}

/** Stable device id for /auth/device-accounts, /auth/switch, /auth/remove-account */
export const getAuthDeviceId = async () => {
    try {
        if (DeviceInfo.getUniqueId) {
            const id = await DeviceInfo.getUniqueId();
            if (id) {
                const s = String(id);
                await AsyncStorage.setItem('device_id', s);
                return s;
            }
        }
    } catch (e) {
        console.warn('[auth] getAuthDeviceId', e?.message);
    }
    const existing = await AsyncStorage.getItem('device_id');
    return existing ? String(existing) : null;
};

/** POST /auth/device-accounts — list accounts saved on this device */
export const fetchDeviceAccounts = async () => {
    const deviceId = await getAuthDeviceId();
    if (!deviceId) {
        throw new Error('Device ID not available');
    }
    return axiosinstance.post('/auth/device-accounts', { deviceId });
};

/** POST /auth/switch — switch session using another account's refresh token */
export const switchAccountRequest = async ({ targetUserId } = {}) => {
    const deviceId = await getAuthDeviceId();
    if (!targetUserId || !deviceId) {
        throw new Error('targetUserId and deviceId are required');
    }
    return axiosinstance.post('/auth/switch', { deviceId, targetUserId: String(targetUserId) });
};

/** POST /auth/remove-account — remove a saved account from this device */
export const removeDeviceAccountRequest = async ({ userId, deviceId: did } = {}) => {
    const deviceId = did || (await getAuthDeviceId());
    if (!userId || !deviceId) {
        throw new Error('userId and deviceId are required');
    }
    return axiosinstance.post('/auth/remove-account', { deviceId, userId: String(userId) });
};

const normalizeDeviceAccountRow = (row) => {
    if (!row || typeof row !== 'object') return null;
    const userId = row.userId ?? row.user_id ?? row.id ?? row._id;
    if (userId == null || userId === '') return null;
    const nestedRt =
        row.session?.refreshToken ??
        row.session?.refresh_token ??
        row.tokens?.refreshToken ??
        row.tokens?.refresh_token;
    return {
        userId: String(userId),
        refreshToken: row.refreshToken ?? row.refresh_token ?? nestedRt,
        displayName:
            row.displayName ??
            row.userName ??
            row.username ??
            row.email ??
            `Account ${userId}`,
        username: row.userName ?? row.username,
        email: row.email,
        image: row.image ?? row.profileImage ?? row.avatar ?? row.profilePic,
    };
};

/** Parse list from device-accounts API (tolerant of response shape). */
export const extractAccountsFromDeviceAccountsResponse = (res) => {
    if (!res) return [];
    const root = res.data !== undefined ? res.data : res;
    const list =
        root?.accounts ??
        root?.deviceAccounts ??
        root?.data?.accounts ??
        (Array.isArray(root?.data) ? root.data : null) ??
        (Array.isArray(root) ? root : null) ??
        [];
    if (!Array.isArray(list)) return [];
    return list.map(normalizeDeviceAccountRow).filter(Boolean);
};

/** Parse /auth/refresh response (aligned with `index.js` fetchRefreshToken). */
export const extractTokensFromRefreshResponse = (res) => {
    if (!res) return null;
    const ok = res.statusCode === 200 || res.statusCode === 201;
    if (!ok) return null;
    const d = res.data !== undefined ? res.data : res;
    const access = d.access_token ?? d.accessToken;
    const refresh = d.refresh_token ?? d.refreshToken;
    if (!access && !refresh) return null;
    return { access, refresh };
};

/**
 * Pick the best refresh token to use for /auth/refresh before /auth/switch.
 * 1) Prefer token from POST /auth/device-accounts for this user.
 * 2) Else use the account's locally stored refresh token.
 */
export const resolveRefreshTokenForAccountSwitch = async (account) => {
    if (!account?.userId) return null;
    const userId = String(account.userId);
    const localRt = account.refreshToken;

    try {
        const deviceRes = await fetchDeviceAccounts();
        const list = extractAccountsFromDeviceAccountsResponse(deviceRes);
        const hit = list.find(a => String(a.userId) === userId);
        if (hit?.refreshToken) {
            return String(hit.refreshToken);
        }
    } catch (e) {
        console.warn('[auth] resolveRefreshToken device-accounts', e?.message);
    }

    return localRt ? String(localRt) : null;
};

/** Parse user payload from /auth/switch response (tolerant of shape). */
export const extractUserFromSwitchResponse = (res) => {
    const root = res?.data !== undefined ? res.data : res;
    const user = root?.user ?? root?.data?.user ?? (root?.access_token || root?.accessToken ? root : null);
    return user && typeof user === 'object' ? user : null;
};

/**
 * Persist tokens and profile fields after a successful /auth/switch (same idea as login).
 * @param {object} user - User object from API
 * @param {import('redux').Dispatch} [dispatch] - Optional, for Stripe id in Redux
 */
export const persistSwitchedUser = async (res, user, dispatch, id) => {
    if (!res) throw new Error('Invalid user payload');

    const access = res.access_token ?? res.accessToken ?? res.token;
    const refresh = res.refresh_token ?? res.refreshToken;

    if (access) await AsyncStorage.setItem('token', String(access));
    if (refresh) await AsyncStorage.setItem('refreshToken', String(refresh));
    if (id != null) await AsyncStorage.setItem('userId', String(id));

    const un = user.userName ?? user.userName;
    if (un) await AsyncStorage.setItem('username', String(un));
    if (user.email) await AsyncStorage.setItem('email', String(user.email));
    if (user.profile != null && user.profile !== '') {
        await AsyncStorage.setItem('profile', String(user.profile));
    }

    // Try to also save to account session, but don't fail if it errors
    try {
        await saveOrUpdateAccount({
            userId: String(id),
            token: access,
            refreshToken: refresh,
            username: un || (await AsyncStorage.getItem('username')),
            email: user.email || (await AsyncStorage.getItem('email')),
            profile: user.profile || (await AsyncStorage.getItem('profile')),
            displayName: un || user.email || `Account ${id}`,
        });
    } catch (e) {
        console.warn('[persistSwitchedUser] saveOrUpdateAccount failed (non-fatal):', e?.message);
    }

    await AsyncStorage.setItem('isLoggedIn', 'true');
};
