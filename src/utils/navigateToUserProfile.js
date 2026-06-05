import AsyncStorage from '@react-native-async-storage/async-storage';

export async function resolveLoggedInUserId(providedId) {
  if (providedId != null && String(providedId).trim()) {
    return String(providedId).trim();
  }
  const stored = await AsyncStorage.getItem('userId');
  return stored ? String(stored).trim() : '';
}

export function isSameUserId(firstId, secondId) {
  if (firstId == null || secondId == null) return false;
  return String(firstId).trim() === String(secondId).trim();
}

/**
 * Open the correct profile screen:
 * - own profile -> Profile tab (ProfileMain / Profile)
 * - other user -> UsersProfile on Home stack
 */
export async function navigateToUserProfile(navigation, targetUserId, options = {}) {
  const targetId = targetUserId != null ? String(targetUserId).trim() : '';
  if (!targetId || !navigation?.navigate) return false;

  const loggedInUserId = await resolveLoggedInUserId(options.loggedInUserId);
  const isSelf = isSameUserId(loggedInUserId, targetId);

  if (isSelf) {
    navigation.navigate('ProfileMain', {
      screen: 'Profile',
      params: {
        returnTo: options.returnTo,
        returnParams: options.returnParams,
        ...(options.profileParams || {}),
      },
    });
    return true;
  }

  const params = {
    userId: targetId,
    ...(options.user ? { user: options.user } : {}),
    ...(options.returnTo != null ? { returnTo: options.returnTo } : {}),
    ...(options.returnParams != null ? { returnParams: options.returnParams } : {}),
    ...(options.battleLive != null ? { battleLive: options.battleLive } : {}),
    ...(options.username ? { username: options.username } : {}),
  };

  const parent = navigation.getParent?.();
  if (parent?.navigate) {
    parent.navigate('HomeMain', {
      screen: 'UsersProfile',
      params,
    });
  } else {
    navigation.navigate('UsersProfile', params);
  }

  return false;
}

export async function shouldOpenOwnProfile(targetUserId, loggedInUserId) {
  const targetId = targetUserId != null ? String(targetUserId).trim() : '';
  if (!targetId) return false;
  const me = await resolveLoggedInUserId(loggedInUserId);
  return isSameUserId(me, targetId);
}
