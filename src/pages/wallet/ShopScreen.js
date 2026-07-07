import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { getUserCredentials } from '../../services/post';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';

const mixWithWhite = (hex, amount = 0.85) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return '#f3f4f6';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = c => Math.round(c + (255 - c) * amount);
  const toHex = c => mix(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const withAlpha = (hex, alpha = 0.12) => {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(124,58,237,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const ShopScreen = ({ navigation }) => {
  const [profileType, setProfileType] = useState('company');
  const [displayName, setDisplayName] = useState('');
  const { bgStyle, textStyle, text, cardStyle } = useAppTheme(profileType);
  const { t } = useLanguage();
  const toast = useToast();
  const dispatch = useDispatch();

  useEffect(() => {
    const loadProfileData = async () => {
      const [storedProfile] = await Promise.all([
        AsyncStorage.getItem('profile'),
      ]);
      if (storedProfile) setProfileType(storedProfile);
    };

    loadProfileData();
    fetchAllData();
  }, []);

    const fetchAllData = useCallback(async () => {
      const id = await AsyncStorage.getItem('userId');
      if (!id) {
        showToastMessage(toast, 'danger', t('profile.noUserIdError'));
        return;
      }
      dispatch(showLoader());
      try {
        const [ userRes] = await Promise.all([
          getUserCredentials(id),
        ]);
        if (userRes.statusCode === 200) {
          let userDataToSet;
          if (userRes.data && userRes.data.user) {
            userDataToSet = userRes.data.user;
          } else if (userRes.data) {
            userDataToSet = userRes.data;
          } else {
            userDataToSet = userRes;
          } 
          setDisplayName(userDataToSet.displayName || userDataToSet.username || '');
        } else {
          showToastMessage(toast, 'danger', t('profile.fetchProfileError'));
        }
      } catch (error) {
        console.error('Error fetching profile screen data:', error);
        showToastMessage(toast, 'danger', t('profile.networkError'));
      } finally {
        dispatch(hideLoader());
      }
    }, []);

  return (
    <ScrollView
      style={[styles.screen, bgStyle]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.marketingCard,
          cardStyle,
          { borderColor: withAlpha(text, 0.12) },
        ]}
      >
        <LinearGradient
          colors={[withAlpha(text, 0.16), withAlpha(text, 0.06)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.leftRail}
        >
          <View
            style={[
              styles.railIconBubble,
              { backgroundColor: mixWithWhite(text, 0.9) },
            ]}
          >
            <Ionicons name="bag-handle" size={34} color={text} />
          </View>
        </LinearGradient>

        <View style={styles.marketingBody}>
          <Text style={[styles.marketingTitle, textStyle]}>
            {displayName
              ? `${displayName}'s ${t('privateContent.shopTitle')}`
              : t('shop.title')}
          </Text>
          <Text style={[styles.marketingText, textStyle]}>
            {t('shop.welcome')}
          </Text>
          <Text style={[styles.marketingText, textStyle]}>
            {t('shop.description')}
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate('ProfileMain', {
                screen: 'MyClosetCreateShop',
              })
            }
            style={[styles.ctaButton, { backgroundColor: text }]}
          >
            <Text style={styles.ctaText}>{t('shop.ctaButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    // justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 24,
  },
  marketingCard: {
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    flexDirection: 'row',
  },
  leftRail: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railIconBubble: {
    height: 58,
    width: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketingBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  marketingTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  marketingText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  ctaButton: {
    borderRadius: 18,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default ShopScreen;
