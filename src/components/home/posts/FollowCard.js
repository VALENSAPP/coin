import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, ClipPath, Polygon } from 'react-native-svg';
import HexAvatar from '../story.js/HexAvatar';
import { useAppTheme } from '../../../theme/useApptheme';
import { useThemeContext } from '../../../theme/ThemeContext';
import SupportCreatorModal from '../../modals/SupportCreatorModal';
import { getSupportRecipientWalletAddress } from '../../../utils/walletPaymentSupport';
import { useWalletConnectSupport } from '../../../context/WalletConnectSupportContext';
import { getUserCredentials } from '../../../services/post';
import { isSupportAllowed, normalizeProfileType } from '../../../utils/supportEligibility';
import { useLanguage } from '../../../i18n';

export default function FollowCard({
  userId,
  username,
  avatar,
  isFollowing,
  loading,
  onToggle,
  onClose,
  isBusinessProfile,
  executeFollowAction,
  item,
  type,
}) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [targetWalletAddress, setTargetWalletAddress] = useState('');
  const [targetProfileType, setTargetProfileType] = useState(item?.profile || type || 'user');
  const [modalVisible, setModalVisible] = useState(false);
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const navigation = useNavigation();
  const { startSupportPayment } = useWalletConnectSupport();
  const { isDarkMode } = useThemeContext();
  const { textStyle, text, card } = useAppTheme(isBusinessProfile ? 'company' : undefined);
  const { t } = useLanguage();
  const profileAccent = type === 'company'
    ? (isDarkMode ? '#C9A15A' : '#C9A15a')
    : (isDarkMode ? '#5a2d82' : '#5a2d82');
  const profileButtonColor = profileAccent;

  const handleUserProfile = userId => {
    navigation.navigate('UsersProfile', { userId });
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const id = await AsyncStorage.getItem('userId');
      const storedWalletAddress = await AsyncStorage.getItem('walletAddress');
      setCurrentUserId(id);
      setWalletAddress(storedWalletAddress || '');

      if (!item?.id) return;
      try {
        const profileResponse = await getUserCredentials(item.id);
        if (profileResponse?.statusCode === 200) {
          const profileUser = profileResponse?.data?.user || profileResponse?.data || {};
          setTargetWalletAddress(getSupportRecipientWalletAddress(profileUser) || '');
          setTargetProfileType(profileUser?.profile || type || item?.profile || 'user');
        }
      } catch (error) {
        setTargetWalletAddress('');
      }
    };
    fetchInitialData();
  }, [item?.id, item?.profile, type]);

  const recipientWalletAddress = useMemo(
    () =>
      targetWalletAddress ||
      item?.walletAddress ||
      item?.walletId ||
      item?.wallet ||
      item?.userWalletAddress ||
      item?.creatorWalletAddress ||
      item?.vendorWalletAddress ||
      item?.receiverWalletAddress ||
      null,
    [item, targetWalletAddress],
  );
  const canSupport = !!recipientWalletAddress;

  const supporterProfile = useMemo(
    () =>
      typeof isBusinessProfile === 'boolean'
        ? (isBusinessProfile ? 'company' : 'user')
        : 'user',
    [isBusinessProfile],
  );
  const recipientProfile = useMemo(
    () => normalizeProfileType(targetProfileType || type || item?.profile),
    [targetProfileType, type, item?.profile],
  );

  const handleSupportNow = async () => {
    if (!canSupport) {
      Alert.alert(
        t('followCard.walletNotConnectedTitle'),
        t('followCard.walletNotConnectedMessage'),
      );
      return;
    }
    setSupportDisclaimerVisible(false);
    const receiverId = userId ?? item?.id ?? '';
    await startSupportPayment(recipientWalletAddress, {
      senderId: currentUserId != null ? String(currentUserId) : '',
      receiverId: receiverId !== '' ? String(receiverId) : '',
      chain: 'POLYGON',
    });
  };

  const handleOpenSupportDisclaimer = () => {
    if (!isSupportAllowed({ supporterProfile, recipientProfile })) {
      Alert.alert(
        t('followCard.supportUnavailableTitle'),
        t('followCard.supportUnavailableMessage'),
      );
      setModalVisible(false);
      return;
    }
    setModalVisible(false);
    setSupportDisclaimerVisible(true);
  };

  const cardWidth = 200;
  const cardHeight = 205;
  const hexRadius = cardWidth / 2;
  const centerX = cardWidth / 2;
  const centerY = cardHeight / 2;

  const points = [
    `${centerX + hexRadius * Math.cos(0)},${centerY + hexRadius * Math.sin(0)}`,
    `${centerX + hexRadius * Math.cos(Math.PI / 3)},${centerY + hexRadius * Math.sin(Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(2 * Math.PI / 3)},${centerY + hexRadius * Math.sin(2 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(Math.PI)},${centerY + hexRadius * Math.sin(Math.PI)}`,
    `${centerX + hexRadius * Math.cos(4 * Math.PI / 3)},${centerY + hexRadius * Math.sin(4 * Math.PI / 3)}`,
    `${centerX + hexRadius * Math.cos(5 * Math.PI / 3)},${centerY + hexRadius * Math.sin(5 * Math.PI / 3)}`,
  ].join(' ');

  return (
    <View style={[styles.cardContainer, { width: cardWidth, height: cardHeight, shadowColor: text }]}>
      <Svg
        width={cardWidth}
        height={cardHeight}
        style={styles.hexagonBackground}
      >
        <Defs>
          <ClipPath id={`hexClip-card-${userId}`}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>
        <Polygon
          points={points}
          fill={text}
          opacity={0.12}
          transform={`translate(2,4)`}
        />
        <Polygon
          points={points}
          fill={card}
          stroke={profileAccent}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </Svg>

      <View style={styles.card} pointerEvents="box-none">
        {/* Close Button */}
        <TouchableOpacity
          style={[
            styles.closeButton,
            { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.9)' : 'rgba(255, 255, 255, 0.8)' },
          ]}
          onPress={onClose}
        >
          <Text style={[styles.closeText, textStyle]}>✕</Text>
        </TouchableOpacity>

        {/* Hexagonal Avatar */}
        <TouchableOpacity
          onPress={() => handleUserProfile(userId)}
          style={styles.avatarContainer}
        >
          <HexAvatar
            uri={avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
            size={90}
            borderWidth={2}
            borderColor={profileAccent}
          />
        </TouchableOpacity>

        {/* Username */}
        <Text style={[styles.username, textStyle]} numberOfLines={1}>
          {username}
        </Text>

        {/* Follow Button */}
        <TouchableOpacity
          style={[
            styles.followButton,
            isFollowing && styles.unfollowButton,
            {
              backgroundColor: profileButtonColor,
              shadowColor: text,
            },
          ]}
          onPress={async () => {
            if (item.id === currentUserId) return;

            const shouldFollow = !isFollowing;
            let success = false;

            if (typeof executeFollowAction === 'function') {
              success = await executeFollowAction(item.id, shouldFollow);
            } else if (typeof onToggle === 'function') {
              await onToggle(item.id, shouldFollow, item.userTokenAddress);
              success = true;
            }

            if (!success || !shouldFollow) return;

            if (isSupportAllowed({ supporterProfile, recipientProfile })) {
              setModalVisible(true);
            }
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.followText}>
              {isFollowing ? t('followCard.followed') : t('followCard.follow')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <SupportCreatorModal
        visible={modalVisible}
        creatorName={username || t('followCard.defaultCreatorName')}
        onClose={() => setModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={username || t('followCard.defaultCreatorName')}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
        canSupport={canSupport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginRight: 16,
    marginBottom: 20,
    position: 'relative',
    // Shadow for the hexagon card
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  hexagonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 25,
    right: 45,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  avatarContainer: {
    marginTop: 5,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
    maxWidth: 120,
  },
  followButton: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 5,
    alignSelf: 'center',
    minWidth: 90,
    maxWidth: '80%',
  },
  unfollowButton: {
    backgroundColor: '#4c2a88b2',
  },
  followText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
});
