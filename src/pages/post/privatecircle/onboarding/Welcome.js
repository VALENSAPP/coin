import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../../../../i18n';
import { useAppTheme } from '../../../../theme/useApptheme';
import { useThemeContext } from '../../../../theme/ThemeContext';

export default function PrivateCircleWelcome() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const [profileType, setProfileType] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('profile').then((type) => setProfileType(type || ''));
  }, []);

  const isCompanyProfile = profileType === 'company';
  const { bgStyle, textStyle, accent, mutedText, icon } = useAppTheme(profileType);
  const { isDarkMode } = useThemeContext();
  const profileActionGradient = isCompanyProfile
    ? ['#D3B683', '#D3B683']
    : ['#513189bd', '#e54ba0'];
  const headingColor = isDarkMode ? accent : (isCompanyProfile ? '#B8954F' : '#513189');
  const lockCircleBg = isDarkMode ? `${accent}22` : (isCompanyProfile ? '#F7F3EA' : '#F3EDFF');

  const handleNext = () => {
    navigation.navigate('PrivateCircleSelectAccess', { mode: 'setup' });
  };

  return (
    <SafeAreaView style={[styles.container, bgStyle]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, textStyle]}>
          {t('privateCircleMint.welcomeTitle')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <View style={[styles.lockCircle, { backgroundColor: lockCircleBg }]}>
          <Ionicons name="lock-closed" size={72} color={headingColor} />
        </View>

        <Text style={[styles.heading, { color: headingColor }]}>
          {t('privateCircleMint.welcomeHeading')}
        </Text>

        <Text style={[styles.description, { color: mutedText }]}>
          {t('privateCircleMint.welcomeDesc1')}
        </Text>
        <Text style={[styles.description, { color: mutedText }]}>
          {t('privateCircleMint.welcomeDesc2')}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleNext}
          style={styles.nextBtnWrapper}
        >
          <LinearGradient
            colors={profileActionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtn}
          >
            <Text style={styles.nextBtnText}>{t('privateCircleMint.welcomeNext')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  lockCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
  },
  nextBtnWrapper: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  nextBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
