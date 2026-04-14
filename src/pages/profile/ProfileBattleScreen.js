import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ProfileBattleHub from '../../components/profile/ProfileBattleHub';
import { useAppTheme } from '../../theme/useApptheme';

export default function ProfileBattleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  console.log(route, 'data in route in thi screen')
  const returnTo = route?.params?.returnTo;
  const { profile, } = route.params || {};
  const { bgStyle, text } = useAppTheme(profile);
  const viewedUserId = route?.params?.viewedUserId || '';
  const isOwner = Boolean(route?.params?.isOwner);
  const title = route?.params?.title || 'Battle';

  const handleBack = () => {
    if (returnTo === 'UserProfile') {
      navigation.navigate('ProfileMain', { screen: 'UserProfile' });
    } else if (returnTo) {
      navigation.navigate(returnTo);
    } else {
      navigation.goBack();
    }
  };
  return (
    <SafeAreaView style={[styles.safeArea, bgStyle]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.headerIconBtn}
        >
          <Icon name="arrow-back-ios-new" size={20} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>{title}</Text>
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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginTop: Platform.OS === 'android' ? '5%' : 0,
    marginBottom:'10%'
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
