import { useAppTheme } from '../theme/useApptheme';

export const normalizeProfileType = profile => {
  const normalized = String(profile || '').toLowerCase();
  if (normalized === 'company') return 'company';
  if (normalized === 'user' || normalized === 'normal') return 'user';
  return normalized || undefined;
};

export const getClosetRouteProfile = route =>
  normalizeProfileType(
    route?.params?.sellerProfile ||
    route?.params?.seller?.profile ||
    route?.params?.profileType ||
    route?.params?.profile ||
    route?.params?.userProfile,
  );

export const useClosetTheme = route => {
  const profileType = getClosetRouteProfile(route);
  return useAppTheme(profileType || 'user');
};

export const buildClosetReturnTo = ({
  isOwnProfile = true,
  sellerProfile,
  sellerId,
  fromWallet = false,
} = {}) => {
  const tabKey = normalizeProfileType(sellerProfile) === 'company' ? 'shop' : 'closet';

  if (fromWallet) {
    return {
      tab: 'wallet',
      screen: tabKey === 'shop' ? 'Shop' : 'MyCloset',
    };
  }

  if (!isOwnProfile && sellerId) {
    return {
      tab: 'HomeMain',
      screen: 'UsersProfile',
      params: { userId: sellerId, initialTab: tabKey },
    };
  }

  return {
    tab: 'ProfileMain',
    screen: 'Profile',
    params: { initialTab: tabKey },
  };
};

export const buildClosetNavContext = ({
  isOwnProfile = true,
  sellerProfile,
  sellerId,
  closetId,
  seller,
  fromWallet = false,
} = {}) => {
  const normalizedProfile = normalizeProfileType(sellerProfile);
  return {
    isOwnProfile,
    sellerProfile: normalizedProfile,
    sellerId,
    closetId,
    seller,
    returnTo: buildClosetReturnTo({
      isOwnProfile,
      sellerProfile: normalizedProfile,
      sellerId,
      fromWallet,
    }),
  };
};

export const withClosetNavParams = (route, params = {}) => {
  const sellerProfile =
    getClosetRouteProfile(route) ||
    normalizeProfileType(params?.sellerProfile || params?.seller?.profile || params?.profileType);

  const nextSeller = params?.seller ?? route?.params?.seller;
  const sellerWithProfile =
    nextSeller && sellerProfile
      ? { ...nextSeller, profile: nextSeller.profile || sellerProfile }
      : nextSeller;

  return {
    ...route?.params,
    ...params,
    seller: sellerWithProfile,
    ...(sellerProfile
      ? { sellerProfile, profileType: sellerProfile }
      : {}),
  };
};

export const themeGradient = accent => [accent, accent];

export const navigateClosetReturn = (navigation, returnTo) => {
  if (!navigation) return;

  if (!returnTo) {
    if (navigation.canGoBack?.()) navigation.goBack();
    return;
  }

  if (typeof returnTo === 'string') {
    navigation.navigate(returnTo);
    return;
  }

  const { tab, screen, params } = returnTo;
  const tabNav = navigation.getParent?.() || navigation;

  if (tab && screen) {
    try {
      tabNav.navigate(tab, { screen, params });
      return;
    } catch (_error) {}
    try {
      navigation.navigate(tab, { screen, params });
      return;
    } catch (_error) {}
  }

  if (screen) {
    try {
      navigation.navigate(screen, params || {});
      return;
    } catch (_error) {}
  }

  if (navigation.canGoBack?.()) navigation.goBack();
};

export const navigateToBattleLive = (navigation, params = {}) => {
  const battleParams = { ...params };

  const tryNavigate = nav => {
    if (!nav?.navigate) return false;
    try {
      nav.navigate('BattleLive', battleParams);
      return true;
    } catch (_error) {
      return false;
    }
  };

  if (tryNavigate(navigation)) return true;

  const parent = navigation?.getParent?.();
  if (tryNavigate(parent)) return true;

  if (navigation?.navigate) {
    try {
      navigation.navigate('ProfileMain', {
        screen: 'BattleLive',
        params: battleParams,
      });
      return true;
    } catch (_error) {}
  }

  return false;
};
