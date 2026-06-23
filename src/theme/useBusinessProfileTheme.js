import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from './useApptheme';

/** Wallet / settings screens: theme follows logged-in business vs personal profile. */
export function useBusinessProfileTheme() {
  const reduxProfile = useSelector(state => state.userProfile.userProfile);
  const [isBusinessProfile, setIsBusinessProfile] = useState(false);

  const loadProfileType = useCallback(async () => {
    const type = await AsyncStorage.getItem('profile');
    if (type) {
      setIsBusinessProfile(String(type).toLowerCase() !== 'user');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileType();
    }, [loadProfileType]),
  );

  useEffect(() => {
    if (reduxProfile && reduxProfile !== 'normal') {
      setIsBusinessProfile(String(reduxProfile).toLowerCase() !== 'user');
    }
  }, [reduxProfile]);

  const theme = useAppTheme(isBusinessProfile ? 'company' : undefined);

  return { isBusinessProfile, ...theme };
}
