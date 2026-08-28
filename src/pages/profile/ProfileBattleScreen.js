import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useLanguage } from '../../i18n';
import ProfileBattleHub from '../../components/profile/ProfileBattleHub';
import { useAppTheme } from '../../theme/useApptheme';
import { useThemeContext } from '../../theme/ThemeContext';

export default function ProfileBattleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const returnTo = route?.params?.returnTo;
  const { profile } = route.params || {};
  const { bgStyle, accent, bg } = useAppTheme(profile);
  const { isDarkMode } = useThemeContext();
  const viewedUserId = route?.params?.viewedUserId || '';
  const isOwner = Boolean(route?.params?.isOwner);
  const title = route?.params?.title || t('profileBattle.defaultTitle');

  const handleBack = () => {
    if (route?.params?.returnTo === 'UserProfile') {
      navigation.goBack();
    } else if (route?.params?.returnTo === 'Home') {
      navigation.navigate('ProfileMain', { screen: 'Profile' });
    } else if (route?.params?.returnTo) {
      navigation.navigate(route.params.returnTo);
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerIconBtn}>
            <Icon name="arrow-back-ios-new" size={20} color={accent} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: accent }]}>{title}</Text>
          <View style={styles.headerIconBtn} />
        </View>

        <ProfileBattleHub
          viewedUserId={String(viewedUserId)}
          isOwner={isOwner}
          openBattleRoute="OpenBattle"
          profile={profile}
          returnTo={returnTo}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
});
