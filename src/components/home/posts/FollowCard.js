import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, ClipPath, Polygon } from 'react-native-svg';
import HexAvatar from '../story.js/HexAvatar'; // Import your HexAvatar component
import { useAppTheme } from '../../../theme/useApptheme';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import SupportCreatorModal from '../../modals/SupportCreatorModal';
import WalletSelectionModal from '../../modals/WalletSelectionModal';
import { getSupportRecipientWalletAddress, handleMetaMaskSupportFlow, openWalletPayment } from '../../../utils/metaMaskSupport';
import { getUserCredentials } from '../../../services/post';
import { showToastMessage } from '../../displaytoastmessage';
import { connectWalletLogin } from '../../../pages/authentication/socialLogin';

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
  item
}) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [targetWalletAddress, setTargetWalletAddress] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [walletSelectionVisible, setWalletSelectionVisible] = useState(false);
  const [supportDisclaimerVisible, setSupportDisclaimerVisible] = useState(false);
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const toast = useToast();
  const { textStyle, text } = useAppTheme();
  
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
        }
      } catch (error) {
        setTargetWalletAddress('');
      }
    };
    fetchInitialData();
  }, [item?.id]);

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

  const handleWalletSelect = async (wallet) => {
    setWalletSelectionVisible(false);
    
    try {
      const connectedAddress = await connectWalletLogin(toast, navigation, dispatch, {
        returnAddressOnly: true,
        walletType: wallet.id,
      });

      if (connectedAddress) {
        await AsyncStorage.setItem('walletAddress', connectedAddress);
        await AsyncStorage.setItem('walletType', wallet.id);
        setWalletAddress(connectedAddress);
        showToastMessage(toast, 'success', 'Wallet connected successfully');
        
        const connectedWalletChainId = await AsyncStorage.getItem('walletChainId');
        const walletType = await AsyncStorage.getItem('walletType') || 'metamask';
        
        // Open payment flow with the connected wallet
        await openWalletPayment(recipientWalletAddress, connectedWalletChainId, walletType);
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
    }
  };

  const handleSupportNow = async () => {
    if (!canSupport) return;
    setSupportDisclaimerVisible(false);
    await handleMetaMaskSupportFlow({
      recipientWalletAddress,
      walletAddress,
      setWalletAddress,
      toast,
      navigation,
      dispatch,
      onShowWalletSelection: () => setWalletSelectionVisible(true),
    });
  };

  const handleOpenSupportDisclaimer = () => {
    setModalVisible(false);
    setSupportDisclaimerVisible(true);
  };

  // Hexagon dimensions for the card
  const cardWidth = 200;
  const cardHeight = 205; // Height adjusted for hexagon shape
  const hexRadius = cardWidth / 2;
  const centerX = cardWidth / 2;
  const centerY = cardHeight / 2;

  // Calculate hexagon points (flat-top orientation)
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

        {/* Background hexagon with shadow effect */}
        <Polygon
          points={points}
          fill="#fff"
          stroke={text}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>

      <View 
        style={styles.card}
        pointerEvents="box-none"
      >
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
            borderWidth={3}
            borderColor={text}
          />
        </TouchableOpacity>

        {/* Username */}
        <Text style={styles.username} numberOfLines={1}>
          {username}
        </Text>

        {/* Follow Button */}
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.unfollowButton, {backgroundColor: text, shadowColor: text}]}
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

            if (success && shouldFollow && canSupport) {
              setModalVisible(true);
            }
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.followText}>
              {isFollowing ? 'Followed' : 'Follow'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <SupportCreatorModal
        visible={modalVisible}
        creatorName={username || 'Creator'}
        onClose={() => setModalVisible(false)}
        onSupport={handleOpenSupportDisclaimer}
      />
      <SupportCreatorModal
        visible={supportDisclaimerVisible}
        creatorName={username || 'Creator'}
        variant="disclaimer"
        onClose={() => setSupportDisclaimerVisible(false)}
        onSupport={handleSupportNow}
      />
      <WalletSelectionModal
        visible={walletSelectionVisible}
        onClose={() => setWalletSelectionVisible(false)}
        onSelectWallet={handleWalletSelect}
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
    maxWidth: 120,
  },
  followButton: {
    paddingVertical: 7,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 5,
  },
  unfollowButton: {
    backgroundColor: '#4c2a88b2',
  },
  followText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
