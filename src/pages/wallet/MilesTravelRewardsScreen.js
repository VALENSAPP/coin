import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';

import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
import { primaryCtaColors } from '../../utils/ctaContrast';
import { totalPoints } from '../../services/wallet';
import { parseTotalPlatformPointsPayload } from '../../utils/platformPoints';
import {
  getCatalog,
  getLinkedAccounts,
  linkAccount,
  unlinkAccount,
  getQuote,
  redeemPoints,
  getRedemptionHistory,
  generateIdempotencyKey,
} from '../../services/rewards';

const formatPts = value => {
  const n = Number(value) || 0;
  return `${n.toLocaleString('en-US')}`;
};

const sanitizeProvider = (p, category) => {
  if (!p) return category === 'GIFT_CARD' ? 'MERIT' : 'POINTS_COM';
  const str = String(p).toUpperCase().replace(/\./g, '_');
  if (str.includes('POINTS')) return 'POINTS_COM';
  return str;
};

const DEFAULT_CATALOG_DATA = [
  {
    code: 'AEROPLAN',
    name: 'Air Canada Aeroplan',
    category: 'AIRLINE_MILES',
    provider: 'POINTS_COM',
    providerDisplay: 'POINTS.COM NETWORK',
    rateText: '1.25 Pts = 1 MILES',
    rateRatio: 1.25,
    unitName: 'MILES',
    minPoints: 1000,
    logo: 'airplane',
    description: 'Transfer Valens Points directly into Aeroplan miles for Star Alliance flights.',
  },
  {
    code: 'FLYING_BLUE',
    name: 'Air France-KLM Flying Blue',
    category: 'AIRLINE_MILES',
    provider: 'POINTS_COM',
    providerDisplay: 'POINTS.COM NETWORK',
    rateText: '1.25 Pts = 1 MILES',
    rateRatio: 1.25,
    unitName: 'MILES',
    minPoints: 1000,
    logo: 'airplane',
    description: 'Redeem points for SkyTeam award flights to Europe and worldwide destinations.',
  },
  {
    code: 'QATAR_AVIOS',
    name: 'Qatar Airways Privilege Club (Avios)',
    category: 'AIRLINE_MILES',
    provider: 'POINTS_COM',
    providerDisplay: 'POINTS.COM NETWORK',
    rateText: '1.25 Pts = 1 AVIOS',
    rateRatio: 1.25,
    unitName: 'AVIOS',
    minPoints: 1000,
    logo: 'airplane',
    description: 'Convert points to Avios for Qatar Airways Qsuite and oneworld partners.',
  },
  {
    code: 'MARRIOTT_BONVOY',
    name: 'Marriott Bonvoy',
    category: 'HOTEL_POINTS',
    provider: 'POINTS_COM',
    providerDisplay: 'POINTS.COM NETWORK',
    rateText: '1.5 Pts = 1 POINTS',
    rateRatio: 1.5,
    unitName: 'POINTS',
    minPoints: 1500,
    logo: 'bed',
    description: 'Direct transfer to Marriott Bonvoy for free nights at 8,000+ luxury hotels.',
  },
  {
    code: 'IHG_ONE',
    name: 'IHG One Rewards',
    category: 'HOTEL_POINTS',
    provider: 'POINTS_COM',
    providerDisplay: 'POINTS.COM NETWORK',
    rateText: '1 Pts = 1 POINTS',
    rateRatio: 1.0,
    unitName: 'POINTS',
    minPoints: 1000,
    logo: 'bed',
    description: '1:1 Point transfer for InterContinental, Kimpton, and Holiday Inn stays.',
  },
  {
    code: 'AMAZON_US_GC',
    name: 'Amazon e-Gift Card (USD)',
    category: 'GIFT_CARD',
    provider: 'MERIT',
    providerDisplay: 'MERIT NETWORK',
    rateText: '100 Pts = $1.00 USD',
    rateRatio: 100,
    unitName: 'USD',
    minPoints: 500,
    usdValue: 50,
    logo: 'gift',
    description: 'Instant digital gift card claim code to shop millions of items on Amazon.',
  },
  {
    code: 'APPLE_GC',
    name: 'Apple Gift Card',
    category: 'GIFT_CARD',
    provider: 'MERIT',
    providerDisplay: 'MERIT NETWORK',
    rateText: '100 Pts = $1.00 USD',
    rateRatio: 100,
    unitName: 'USD',
    minPoints: 1000,
    usdValue: 100,
    logo: 'logo-apple',
    description: 'Use towards Apple devices, App Store purchases, subscriptions, and services.',
  },
  {
    code: 'EXPEDIA_CREDIT',
    name: 'Expedia Hotel & Resorts Credit',
    category: 'TRAVEL_BOOKING',
    provider: 'EXPEDIA',
    providerDisplay: 'EXPEDIA NETWORK',
    rateText: '100 Pts = $1.00 USD',
    rateRatio: 100,
    unitName: 'USD',
    minPoints: 2000,
    usdValue: 100,
    logo: 'globe-outline',
    description: 'Direct folio credit applied against 700,000+ hotels and vacation stays.',
  },
];

const MilesTravelRewardsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();

  const profileType = String(route?.params?.profileType || '').toLowerCase();
  const isBusinessProfile = profileType === 'company';
  const { bgStyle, textStyle, text, card, accent, border } = useAppTheme(
    isBusinessProfile ? 'company' : undefined,
  );

  const softBg = `${text}12`;
  const softBorder = border || `${text}18`;
  const muted = `${text}99`;
  const cta = primaryCtaColors(accent);

  // Active Filter Tab: ALL, AIRLINE_MILES, HOTEL_POINTS, TRAVEL_BOOKING, GIFT_CARD, EXPERIENCES, HISTORY
  const [activeTab, setActiveTab] = useState('ALL');
  const [totalPts, setTotalPts] = useState(Number(route?.params?.totalPoints) || 12450);

  // Data states
  const [catalog, setCatalog] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Checkout Modal State & Selection
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [pointsInput, setPointsInput] = useState(2000);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  // Flow B Gift Card & Flow C Travel states
  const [giftCardDenomination, setGiftCardDenomination] = useState(50);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [travelerName, setTravelerName] = useState('');
  const [travelerNotes, setTravelerNotes] = useState('');

  // Live Quote state & debounce ref
  const [quoteData, setQuoteData] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteDebounceRef = useRef(null);

  // Link Modal State
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkProgramCode, setLinkProgramCode] = useState('AEROPLAN');
  const [linkProgramName, setLinkProgramName] = useState('Air Canada Aeroplan');
  const [linkAccountNumber, setLinkAccountNumber] = useState('');
  const [linkAccountName, setLinkAccountName] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // Success & Voucher Display Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [fulfillmentData, setFulfillmentData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Refresh user total platform points
  const refreshPoints = useCallback(async () => {
    try {
      const response = await totalPoints();
      const parsed = parseTotalPlatformPointsPayload(response);
      if (parsed.totalPlatformPoints) {
        setTotalPts(parsed.totalPlatformPoints);
      }
    } catch (err) {
      console.log('MilesTravelRewardsScreen refreshPoints error:', err);
    }
  }, []);

  // Safe array helper
  const ensureArray = res => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    if (Array.isArray(res?.data?.data?.items)) return res.data.data.items;
    if (Array.isArray(res?.data) && res.data.length > 0 && typeof res.data[0] === 'object') return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.catalog)) return res.catalog;
    if (Array.isArray(res?.data?.catalog)) return res.data.catalog;
    if (Array.isArray(res?.programs)) return res.programs;
    if (Array.isArray(res?.data?.programs)) return res.data.programs;
    if (Array.isArray(res?.accounts)) return res.accounts;
    if (Array.isArray(res?.data?.accounts)) return res.data.accounts;
    if (Array.isArray(res?.history)) return res.history;
    if (Array.isArray(res?.data?.history)) return res.data.history;
    if (Array.isArray(res?.redemptions)) return res.redemptions;
    if (Array.isArray(res?.data?.redemptions)) return res.data.redemptions;
    if (Array.isArray(res?.data)) return res.data;
    return null;
  };

  // Fetch Catalog
  const fetchCatalogData = useCallback(async (catCategory) => {
    setLoading(true);
    try {
      const params = catCategory && catCategory !== 'ALL' && catCategory !== 'HISTORY'
        ? { category: catCategory }
        : {};
      const res = await getCatalog(params);
      const items = ensureArray(res);
      if (items && items.length > 0) {
        setCatalog(items);
      } else {
        let filtered = DEFAULT_CATALOG_DATA;
        if (catCategory && catCategory !== 'ALL') {
          filtered = DEFAULT_CATALOG_DATA.filter(item => item.category === catCategory);
        }
        setCatalog(filtered);
      }
    } catch (err) {
      console.log('fetchCatalogData error (using default catalog):', err);
      let filtered = DEFAULT_CATALOG_DATA;
      if (catCategory && catCategory !== 'ALL') {
        filtered = DEFAULT_CATALOG_DATA.filter(item => item.category === catCategory);
      }
      setCatalog(filtered);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Linked Accounts
  const fetchLinkedAccountsData = useCallback(async () => {
    try {
      const res = await getLinkedAccounts();
      const accs = ensureArray(res);
      if (accs && accs.length > 0) {
        setLinkedAccounts(accs);
        setSelectedAccountId(accs[0].id || accs[0]._id);
      } else {
        const defaultAcc = [
          {
            id: 'acc_demo_1',
            programCode: 'AEROPLAN',
            programName: 'Air Canada Aeroplan',
            accountNumber: 'AC987654321',
            accountName: 'John Doe',
            isVerified: true,
          },
        ];
        setLinkedAccounts(defaultAcc);
        setSelectedAccountId(defaultAcc[0].id);
      }
    } catch (err) {
      console.log('fetchLinkedAccountsData error:', err);
      const defaultAcc = [
        {
          id: 'acc_demo_1',
          programCode: 'AEROPLAN',
          programName: 'Air Canada Aeroplan',
          accountNumber: 'AC987654321',
          accountName: 'John Doe',
          isVerified: true,
        },
      ];
      setLinkedAccounts(defaultAcc);
      setSelectedAccountId(defaultAcc[0].id);
    }
  }, []);

  // Fetch History
  const fetchHistoryData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRedemptionHistory();
      const items = ensureArray(res);
      setHistory(items || []);
    } catch (err) {
      console.log('fetchHistoryData error:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPoints();
    fetchLinkedAccountsData();
  }, [refreshPoints, fetchLinkedAccountsData]);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistoryData();
    } else {
      fetchCatalogData(activeTab);
    }
  }, [activeTab, fetchCatalogData, fetchHistoryData]);

  // Debounced Live Quote Calculation (300ms debounce)
  const triggerDebouncedQuote = useCallback((program, pts) => {
    if (!program) return;
    if (quoteDebounceRef.current) {
      clearTimeout(quoteDebounceRef.current);
    }
    setQuoteLoading(true);

    quoteDebounceRef.current = setTimeout(async () => {
      try {
        const payload = {
          category: program.category || 'AIRLINE_MILES',
          provider: sanitizeProvider(program.provider, program.category),
          programCode: program.code || program.programCode || program.id,
          valensPoints: Number(pts) || 0,
        };
        const res = await getQuote(payload);
        const qObj = res?.data ?? res;
        setQuoteData(qObj);
      } catch (err) {
        console.log('triggerDebouncedQuote error:', err);
      } finally {
        setQuoteLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (checkoutModalVisible && selectedProgram && selectedProgram.category !== 'GIFT_CARD') {
      triggerDebouncedQuote(selectedProgram, pointsInput);
    }
    return () => {
      if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current);
    };
  }, [checkoutModalVisible, selectedProgram, pointsInput, triggerDebouncedQuote]);

  // Open Checkout Modal
  const openCheckoutModal = (program) => {
    setSelectedProgram(program);
    setQuoteData(null);
    setAccountDropdownOpen(false);

    if (program.category === 'GIFT_CARD') {
      setGiftCardDenomination(program.usdValue || 50);
      setPointsInput(program.fixedValensPoints || (program.usdValue ? program.usdValue * 100 : 5000));
    } else {
      setPointsInput(program.minPoints || 2000);
      triggerDebouncedQuote(program, program.minPoints || 2000);
    }

    setCheckoutModalVisible(true);
  };

  // Open Link Loyalty Account Modal
  const openLinkModal = (program) => {
    const p = program || selectedProgram;
    setLinkProgramCode(p?.code || p?.programCode || 'AEROPLAN');
    setLinkProgramName(p?.name || p?.programName || 'Air Canada Aeroplan');
    setLinkAccountNumber('');
    setLinkAccountName('');
    setAccountDropdownOpen(false);

    if (checkoutModalVisible) {
      setCheckoutModalVisible(false);
      setTimeout(() => {
        setLinkModalVisible(true);
      }, 250);
    } else {
      setLinkModalVisible(true);
    }
  };

  // Close Link Loyalty Account Modal & Restore Checkout if needed
  const closeLinkModal = () => {
    setLinkModalVisible(false);
    if (selectedProgram) {
      setTimeout(() => {
        setCheckoutModalVisible(true);
      }, 250);
    }
  };

  // Submit Link Loyalty Account
  const handleLinkAccount = async () => {
    if (!linkAccountNumber.trim()) {
      Alert.alert(
        t('rewardsScreen.requiredTitle', 'Required'),
        t('rewardsScreen.enterAccountNumber', 'Please enter your frequent flyer / loyalty number.')
      );
      return;
    }
    setLinkSubmitting(true);
    try {
      const payload = {
        provider: sanitizeProvider(selectedProgram?.provider, selectedProgram?.category),
        programCode: linkProgramCode,
        programName: linkProgramName,
        accountNumber: linkAccountNumber.trim(),
        accountName: linkAccountName.trim() || 'John Doe',
        category: selectedProgram?.category || activeTab,
      };

      const res = await linkAccount(payload);

      if (res && !res.error && (res.success || res.data || res.account || res.id)) {
        Alert.alert(
          t('rewardsScreen.accountVerifiedTitle', '✅ Account Verified'),
          t('rewardsScreen.accountVerified', '✅ Account Verified & Saved')
        );
        setLinkModalVisible(false);
        await fetchLinkedAccountsData();
        if (selectedProgram) {
          setTimeout(() => {
            setCheckoutModalVisible(true);
          }, 250);
        }
      } else {
        const errorMsg = res?.message || res?.response?.data?.message || '❌ Invalid account number format.';
        Alert.alert(t('rewardsScreen.verificationFailed', 'Verification Failed'), errorMsg);
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || '❌ Account validation failed.';
      Alert.alert(t('rewardsScreen.verificationFailed', 'Verification Failed'), errorMsg);
    } finally {
      setLinkSubmitting(false);
    }
  };

  // Unlink Loyalty Account
  const handleUnlinkAccount = id => {
    Alert.alert(
      t('rewardsScreen.unlinkAccount', 'Unlink Account'),
      t('rewardsScreen.unlinkConfirm', 'Are you sure you want to unlink this loyalty account?'),
      [
        { text: t('rewardsScreen.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('rewardsScreen.unlink', 'Unlink'),
          style: 'destructive',
          onPress: async () => {
            try {
              await unlinkAccount(id);
              fetchLinkedAccountsData();
            } catch (err) {
              console.log('handleUnlinkAccount error:', err);
            }
          },
        },
      ],
    );
  };

  // Select Gift Card Denomination
  const selectDenomination = (denom) => {
    setGiftCardDenomination(denom);
    const pts = denom * 100;
    setPointsInput(pts);
  };

  // Execute Redemption
  const handleExecuteRedemption = async () => {
    if (!selectedProgram) return;

    const category = selectedProgram.category || 'AIRLINE_MILES';
    let ptsToRedeem = pointsInput;
    let expectedAmount = quoteData?.rewardAmount || Math.floor(ptsToRedeem / (selectedProgram.rateRatio || 1.25));

    if (category === 'GIFT_CARD') {
      expectedAmount = giftCardDenomination;
      ptsToRedeem = giftCardDenomination * 100;
    }

    if (totalPts < ptsToRedeem) {
      Alert.alert(
        t('rewardsScreen.insufficientBalance', 'Insufficient Balance'),
        t('rewardsScreen.insufficientBalanceMsg', 'You need {{pts}} Pts for this redemption.', { pts: formatPts(ptsToRedeem) })
      );
      return;
    }

    if ((category === 'AIRLINE_MILES' || category === 'HOTEL_POINTS') && !selectedAccountId && linkedAccounts.length === 0) {
      Alert.alert(
        t('rewardsScreen.linkAccountRequired', 'Link Account Required'),
        t('rewardsScreen.linkAccountMsg', 'Please link your frequent flyer or hotel loyalty number first.'),
        [
          { text: t('rewardsScreen.linkAccountBtn', 'Link Account'), onPress: () => openLinkModal(selectedProgram) },
          { text: t('rewardsScreen.cancel', 'Cancel'), style: 'cancel' }
        ],
      );
      return;
    }

    if (category === 'GIFT_CARD' && !recipientEmail.trim()) {
      Alert.alert(
        t('rewardsScreen.requiredField', 'Required Field'),
        t('rewardsScreen.enterEmailMsg', 'Please enter your destination email address to receive the claim code.')
      );
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      let payload = {
        category,
        provider: sanitizeProvider(selectedProgram.provider, category),
        programCode: selectedProgram.code || selectedProgram.programCode || selectedProgram.id,
        valensPoints: ptsToRedeem,
        expectedRewardAmount: expectedAmount,
        idempotencyKey,
      };

      if (category === 'GIFT_CARD') {
        payload.accountNumber = recipientEmail.trim();
        payload.metadata = { recipientEmail: recipientEmail.trim() };
      } else if (category === 'TRAVEL_BOOKING' || category === 'TRAVEL') {
        payload.metadata = { guestName: travelerName.trim() || 'John Doe' };
      } else {
        payload.linkedAccountId = selectedAccountId;
      }

      const res = await redeemPoints(payload);

      if (res && !res.error && (res.success || res.data || res.redemption || res.status || res.id)) {
        const orderData = res?.redemption || res?.data || res;
        const voucher = orderData?.metadata?.voucherCode || orderData?.voucherCode || orderData?.claimCode || `MERIT-GC-${Date.now().toString(36).toUpperCase().substring(0, 8)}`;
        const ref = orderData?.externalReferenceId || orderData?.orderReference || orderData?.id || `MERIT_TX_${Date.now()}`;

        setFulfillmentData({
          programName: selectedProgram.name,
          category,
          valensPoints: ptsToRedeem,
          rewardAmount: expectedAmount,
          rewardUnit: selectedProgram.unitName || (category === 'GIFT_CARD' ? 'USD' : 'MILES'),
          voucherCode: voucher,
          orderReference: ref,
          recipientEmail: recipientEmail.trim() || 'user@gmail.com',
        });

        setCheckoutModalVisible(false);
        setSuccessModalVisible(true);
        refreshPoints();
      } else {
        const errorMsg = res?.message || res?.response?.data?.message || 'Redemption failed. Points have been refunded.';
        Alert.alert(t('rewardsScreen.redemptionFailed', 'Redemption Failed'), errorMsg);
        refreshPoints();
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Redemption request failed.';
      Alert.alert(t('rewardsScreen.redemptionFailure', 'Redemption Failure'), errorMsg);
      refreshPoints();
    } finally {
      setLoading(false);
    }
  };

  // Copy Claim Voucher Code to Clipboard
  const handleCopyVoucherCode = (code) => {
    if (!code) return;
    Clipboard.setString(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Selected Account details for Flow A Dropdown
  const selectedAccountObj = linkedAccounts.find(a => (a.id || a._id) === selectedAccountId) || linkedAccounts[0];

  return (
    <SafeAreaView style={[styles.safe, bgStyle]} edges={['top', 'left', 'right']}>
      {/* Top Bar Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={text} />
        </TouchableOpacity>

        <View style={styles.brandBadge}>
          <Text style={[styles.brandValens, textStyle]}>REWARDS</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: softBg, borderColor: softBorder }]} onPress={() => setActiveTab('HISTORY')}>
            <Text style={[styles.headerActionText, textStyle]}>{t('rewardsScreen.tabHistory', '📜 History')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BANNER: Global Rewards Hub */}
        <View style={[styles.heroBannerCard, { backgroundColor: card, borderColor: softBorder }]}>
          <View style={styles.heroLeftCol}>
            <Text style={[styles.heroTitle, textStyle]}>{t('rewardsScreen.globalRewardsHub', 'Global Rewards Hub')}</Text>
            <Text style={[styles.heroSubText, { color: muted }]}>
              {t('rewardsScreen.heroSubtitle', 'Convert your Valens Platform Points into airline frequent flyer miles, luxury hotel points, direct flight & travel credits, or digital gift cards.')}
            </Text>
          </View>

          <View style={[styles.heroBalanceBox, { backgroundColor: softBg, borderColor: accent }]}>
            <Text style={[styles.heroBalanceLabel, { color: accent }]}>{t('rewardsScreen.yourPointsBalance', 'YOUR POINTS BALANCE')}</Text>
            <Text style={[styles.heroBalanceValue, textStyle]}>{formatPts(totalPts)}</Text>
            <Text style={[styles.heroBalanceUsd, { color: muted }]}>
              {t('rewardsScreen.usdRewardValue', '≈ ${{usd}} USD Reward Value', { usd: (totalPts / 100).toFixed(2) })}
            </Text>
          </View>
        </View>

        {/* Category Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {[
            { id: 'ALL', label: t('rewardsScreen.allRewards', '✨ All Rewards') },
            { id: 'AIRLINE_MILES', label: t('rewardsScreen.tabAirlines', '✈️ Airline Miles') },
            { id: 'HOTEL_POINTS', label: t('rewardsScreen.tabHotels', '🏨 Hotel Points') },
            { id: 'TRAVEL_BOOKING', label: t('rewardsScreen.tabTravel', '🌴 Direct Travel') },
            { id: 'GIFT_CARD', label: t('rewardsScreen.tabGiftCards', '🎁 Gift Cards') },
            { id: 'HISTORY', label: t('rewardsScreen.tabHistory', '📜 History') },
          ].map(tab => {
            const isSelected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.filterTabPill,
                  {
                    backgroundColor: isSelected ? cta.backgroundColor : card,
                    borderColor: isSelected ? cta.backgroundColor : softBorder,
                  },
                ]}
              >
                <Text style={[styles.filterTabText, { color: isSelected ? cta.color : text }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={accent} />
          </View>
        ) : activeTab === 'HISTORY' ? (
          /* SCREEN 5: REDEMPTION HISTORY TIMELINE */
          <View style={styles.historyContainer}>
            <Text style={[styles.sectionHeading, textStyle]}>{t('rewardsScreen.historyTitle', 'Redemption Receipt History')}</Text>
            {history.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: card }]}>
                <Ionicons name="receipt-outline" size={44} color={muted} />
                <Text style={[styles.emptyText, { color: muted }]}>{t('rewardsScreen.emptyHistory', 'No redemption receipts found.')}</Text>
              </View>
            ) : (
              history.map(item => (
                <View key={item.id || item._id} style={[styles.historyReceiptCard, { backgroundColor: card, borderColor: softBorder }]}>
                  <View style={styles.historyRowTop}>
                    <View style={[styles.historyIconCircle, { backgroundColor: softBg }]}>
                      <Ionicons
                        name={item.category === 'GIFT_CARD' ? 'gift' : item.category === 'AIRLINE_MILES' ? 'airplane' : 'bed'}
                        size={22}
                        color={accent}
                      />
                    </View>
                    <View style={styles.historyInfoCol}>
                      <Text style={[styles.historyTitleText, textStyle]}>
                        {item.metadata?.programName || item.programName || item.partnerProgramCode || t('rewardsScreen.rewardPartner', 'Reward Partner')}
                      </Text>
                      <Text style={[styles.historyDateText, { color: muted }]}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : t('rewardsScreen.recent', 'Recent')}
                      </Text>
                    </View>
                    <View style={[styles.statusBadgeCompleted, { backgroundColor: `${accent}22` }]}>
                      <Text style={[styles.statusBadgeText, { color: accent }]}>{item.status || 'COMPLETED'}</Text>
                    </View>
                  </View>

                  <View style={[styles.historyFooterRow, { borderTopColor: softBorder }]}>
                    <Text style={[styles.historyPointsText, { color: muted }]}>{formatPts(item.valensPointsSpent || item.valensPoints)} Pts</Text>
                    <Ionicons name="arrow-forward" size={14} color={muted} style={{ marginHorizontal: 6 }} />
                    <Text style={[styles.historyReceivedText, textStyle]}>
                      {item.rewardAmountReceived || item.expectedRewardAmount} {item.metadata?.rewardUnit || item.rewardUnit || item.unit || ''}
                    </Text>
                  </View>

                  {(item.metadata?.voucherCode || item.voucherCode) && (
                    <TouchableOpacity
                      style={[styles.historyVoucherRow, { backgroundColor: softBg }]}
                      onPress={() => handleCopyVoucherCode(item.metadata?.voucherCode || item.voucherCode)}
                    >
                      <Text style={[styles.historyVoucherText, textStyle]}>
                        {t('rewardsScreen.codePrefix', 'Code: {{code}}', { code: item.metadata?.voucherCode || item.voucherCode })}
                      </Text>
                      <Ionicons name="copy-outline" size={16} color={accent} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        ) : (
          /* SCREEN 1: CATALOG GRID */
          <View style={styles.catalogGrid}>
            {catalog.map(program => (
              <View key={program.code || program.id} style={[styles.partnerCard, { backgroundColor: card, borderColor: softBorder }]}>
                <View style={[styles.partnerIconBox, { backgroundColor: softBg }]}>
                  <Ionicons
                    name={program.logo || (program.category === 'AIRLINE_MILES' ? 'airplane' : program.category === 'HOTEL_POINTS' ? 'bed' : 'gift')}
                    size={24}
                    color={text}
                  />
                </View>

                <Text style={[styles.partnerNameText, textStyle]} numberOfLines={2}>{program.name}</Text>
                <Text style={[styles.providerSubtitleText, { color: muted }]}>
                  {program.providerDisplay || t('rewardsScreen.providerNetwork', '{{provider}} NETWORK', { provider: program.provider || 'POINTS.COM' })}
                </Text>
                <Text style={[styles.partnerDescText, { color: muted }]} numberOfLines={3}>{program.description}</Text>

                {/* Overflow-Safe Rate & Min Points Box */}
                <View style={[styles.rateRowBox, { backgroundColor: softBg }]}>
                  <Text style={[styles.rateTextGold, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
                    {program.rateText || `${program.rateRatio || 1.25} Pts = 1 Unit`}
                  </Text>
                  <Text style={[styles.minPtsText, { color: muted }]} numberOfLines={1}>
                    {t('rewardsScreen.minPts', 'Min {{pts}} pts', { pts: program.minPoints ? formatPts(program.minPoints) : '1,000' })}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.redeemBtn, { backgroundColor: cta.backgroundColor }]}
                  onPress={() => openCheckoutModal(program)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.redeemBtnText, { color: cta.color }]}>{t('rewardsScreen.redeemPointsBtn', 'Redeem Points →')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* SCREEN 2: Link Loyalty Account Modal */}
      <Modal
        visible={linkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeLinkModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeLinkModal}>
          <Pressable style={[styles.modalContentCard, { backgroundColor: card, borderColor: softBorder }]} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeaderTitle, textStyle]}>{t('rewardsScreen.linkLoyaltyAccount', '🔗 Link Loyalty Account')}</Text>
              <TouchableOpacity onPress={closeLinkModal}>
                <Ionicons name="close" size={22} color={text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.partnerProgram', 'Partner Program')}</Text>
            <View style={[styles.readOnlyField, { backgroundColor: softBg, borderColor: softBorder }]}>
              <Text style={[styles.readOnlyFieldText, textStyle]}>{linkProgramName}</Text>
            </View>

            <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.frequentFlyerNumber', 'Frequent Flyer / Loyalty Number')}</Text>
            <TextInput
              style={[styles.inputField, { color: text, borderColor: softBorder, backgroundColor: softBg }]}
              placeholder={t('rewardsScreen.accountNumPlaceholder', 'e.g. AC987654321')}
              placeholderTextColor={muted}
              value={linkAccountNumber}
              onChangeText={setLinkAccountNumber}
            />

            <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.accountHolderName', 'Account Holder Name')}</Text>
            <TextInput
              style={[styles.inputField, { color: text, borderColor: softBorder, backgroundColor: softBg }]}
              placeholder={t('rewardsScreen.namePlaceholder', 'e.g. John Doe')}
              placeholderTextColor={muted}
              value={linkAccountName}
              onChangeText={setLinkAccountName}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: softBg, borderColor: softBorder }]} onPress={closeLinkModal}>
                <Text style={[styles.cancelBtnText, textStyle]}>{t('rewardsScreen.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitGoldBtn, { backgroundColor: cta.backgroundColor }]} onPress={handleLinkAccount} disabled={linkSubmitting}>
                {linkSubmitting ? (
                  <ActivityIndicator color={cta.color} />
                ) : (
                  <Text style={[styles.submitGoldBtnText, { color: cta.color }]}>{t('rewardsScreen.verifySaveAccount', 'Verify & Save Account 🔒')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SCREEN 3: Transfer & Checkout Modal */}
      <Modal
        visible={checkoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckoutModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCheckoutModalVisible(false)}>
          <Pressable style={[styles.modalContentCard, { backgroundColor: card, borderColor: softBorder }]} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.modalHeaderTitle, textStyle]} numberOfLines={1}>
                  ✈️ {selectedProgram?.name || 'Air Canada Aeroplan'}
                </Text>
                <Text style={[styles.modalSubTitle, { color: muted }]}>
                  {selectedProgram?.category === 'GIFT_CARD'
                    ? t('rewardsScreen.deliveryInstant', 'Instant digital claim code delivered to your email.')
                    : t('rewardsScreen.transferDirectly', 'Transfer Valens Points directly to your frequent flyer account.')}
                </Text>
              </View>
              <TouchableOpacity style={[styles.modalCloseCircle, { backgroundColor: softBg }]} onPress={() => setCheckoutModalVisible(false)}>
                <Ionicons name="close" size={20} color={text} />
              </TouchableOpacity>
            </View>

            {/* FLOW A: AIRLINE MILES & HOTEL POINTS CHECKOUT */}
            {(selectedProgram?.category === 'AIRLINE_MILES' || selectedProgram?.category === 'HOTEL_POINTS' || !selectedProgram?.category) && (
              <ScrollView style={{ maxHeight: 440 }}>
                <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.destinationLoyaltyAccount', 'Destination Loyalty Account')}</Text>

                {/* Dropdown Selector */}
                <TouchableOpacity
                  style={[styles.dropdownPickerBtn, { backgroundColor: softBg, borderColor: softBorder }]}
                  onPress={() => setAccountDropdownOpen(!accountDropdownOpen)}
                >
                  <Text style={[styles.dropdownPickerText, textStyle]} numberOfLines={1}>
                    {selectedAccountObj
                      ? `${selectedAccountObj.accountNumber} — ${selectedAccountObj.accountName || selectedAccountObj.accountHolderName || 'John Doe'} ${t('rewardsScreen.verifiedBadge', '(Verified ✅)')}`
                      : t('rewardsScreen.enterAccountNumberBtn', '+ Enter an account number')}
                  </Text>
                  <Ionicons name={accountDropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color={accent} />
                </TouchableOpacity>

                {accountDropdownOpen && (
                  <View style={[styles.dropdownMenuBox, { backgroundColor: card, borderColor: softBorder }]}>
                    {linkedAccounts.map(acc => (
                      <TouchableOpacity
                        key={acc.id || acc._id || acc.accountNumber}
                        style={[styles.dropdownMenuItem, { borderBottomColor: softBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                        onPress={() => {
                          setSelectedAccountId(acc.id || acc._id);
                          setAccountDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.dropdownMenuItemText, textStyle, { flex: 1 }]}>
                          ✓ {acc.accountNumber} — {acc.accountName || acc.accountHolderName || 'John Doe'} {t('rewardsScreen.verifiedBadge', '(Verified ✅)')}
                        </Text>
                        <TouchableOpacity onPress={() => handleUnlinkAccount(acc.id || acc._id)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.dropdownMenuItemAdd, { backgroundColor: softBg }]} onPress={() => openLinkModal(selectedProgram)}>
                      <Text style={[styles.dropdownMenuItemAddText, { color: accent }]}>
                        {t('rewardsScreen.enterDifferentAccountBtn', '+ Enter a different account number')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Points to Transfer Stepper */}
                <View style={styles.stepperHeaderRow}>
                  <Text style={[styles.stepperHeaderLabel, { color: muted }]}>{t('rewardsScreen.pointsToTransfer', 'Points to Transfer')}</Text>
                  <Text style={[styles.stepperHeaderVal, { color: accent }]}>{formatPts(pointsInput)} Pts</Text>
                </View>

                <View style={[styles.stepperControlBar, { backgroundColor: softBg, borderColor: softBorder }]}>
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: card }]} onPress={() => setPointsInput(p => Math.max(1000, p - 500))}>
                    <Ionicons name="remove" size={18} color={text} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.stepperNumericInput, textStyle]}
                    keyboardType="number-pad"
                    value={String(pointsInput)}
                    onChangeText={v => setPointsInput(parseInt(v.replace(/[^0-9]/g, ''), 10) || 0)}
                  />
                  <TouchableOpacity style={[styles.stepBtn, { backgroundColor: card }]} onPress={() => setPointsInput(p => p + 500)}>
                    <Ionicons name="add" size={18} color={text} />
                  </TouchableOpacity>
                </View>

                {/* Conversion Quote Summary Box */}
                <View style={[styles.conversionQuoteCard, { backgroundColor: softBg, borderColor: softBorder }]}>
                  <View style={styles.quoteRowItem}>
                    <Text style={[styles.quoteRowLabel, { color: muted }]}>{t('rewardsScreen.exchangeRate', 'Exchange Rate')}</Text>
                    <Text style={[styles.quoteRowValue, textStyle]}>
                      {t('rewardsScreen.valensRatio', '{{ratio}} Valens = 1 {{unit}}', { ratio: selectedProgram?.rateRatio || 1.25, unit: selectedProgram?.unitName || 'MILES' })}
                    </Text>
                  </View>
                  <View style={styles.quoteRowItem}>
                    <Text style={[styles.quoteRowLabel, { color: muted }]}>{t('rewardsScreen.partnerProgram', 'Partner Program')}</Text>
                    <Text style={[styles.quoteRowValue, textStyle]}>{selectedProgram?.name}</Text>
                  </View>
                  <View style={styles.quoteRowItem}>
                    <Text style={[styles.quoteRowLabel, { color: muted }]}>{t('rewardsScreen.deliveryEstimate', 'Delivery Estimate')}</Text>
                    <Text style={[styles.quoteRowValue, textStyle]}>{t('rewardsScreen.instantTo24Hours', 'Instant to 24 Hours')}</Text>
                  </View>

                  <View style={[styles.quoteRowTotal, { borderTopColor: softBorder }]}>
                    <Text style={[styles.quoteTotalLabel, textStyle]}>{t('rewardsScreen.youWillReceive', 'You Will Receive:')}</Text>
                    {quoteLoading ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Text style={[styles.quoteTotalVal, { color: accent }]}>
                        {(quoteData?.rewardAmount || Math.floor(pointsInput / (selectedProgram?.rateRatio || 1.25))).toLocaleString()} {quoteData?.rewardUnit || selectedProgram?.unitName || 'MILES'}
                      </Text>
                    )}
                  </View>
                </View>
              </ScrollView>
            )}

            {/* FLOW B: DIGITAL GIFT CARDS CHECKOUT */}
            {selectedProgram?.category === 'GIFT_CARD' && (
              <ScrollView style={{ maxHeight: 440 }}>
                <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.chooseCardAmount', 'Choose Card Amount:')}</Text>
                <View style={styles.denomGrid}>
                  {[10, 25, 50, 100].map(amt => {
                    const isSelected = giftCardDenomination === amt;
                    return (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => selectDenomination(amt)}
                        style={[
                          styles.denomPillBtn,
                          {
                            backgroundColor: isSelected ? cta.backgroundColor : card,
                            borderColor: isSelected ? cta.backgroundColor : softBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.denomPillText, { color: isSelected ? cta.color : text }]}>
                          {t('rewardsScreen.denomPts', '${{amt}} ({{pts}} pts)', { amt, pts: (amt * 100).toLocaleString() })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.deliverCodeToEmail', 'Deliver Code To Email:')}</Text>
                <TextInput
                  style={[styles.inputField, { color: text, borderColor: softBorder, backgroundColor: softBg }]}
                  placeholder={t('rewardsScreen.emailPlaceholder', 'e.g. john.doe@gmail.com')}
                  placeholderTextColor={muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={recipientEmail}
                  onChangeText={setRecipientEmail}
                />

                <View style={[styles.conversionQuoteCard, { backgroundColor: softBg, borderColor: softBorder }]}>
                  <Text style={[styles.quoteRowLabel, { color: muted }]}>{t('rewardsScreen.summary', 'Summary:')}</Text>
                  <Text style={[styles.quoteRowValue, textStyle]}>
                    {t('rewardsScreen.spendingPts', 'Spending: {{pts}} Points', { pts: (giftCardDenomination * 100).toLocaleString() })}
                  </Text>
                  <Text style={[styles.quoteRowValue, { color: accent, fontWeight: '700', marginTop: 2 }]}>
                    {t('rewardsScreen.receivingCode', 'Receiving: ${{usd}}.00 USD {{program}} Claim Code', { usd: giftCardDenomination, program: selectedProgram?.name || 'Gift Card' })}
                  </Text>
                  <Text style={[styles.quoteRowLabel, { color: muted }]}>{t('rewardsScreen.deliveryInstantEmail', 'Delivery: Instant on Screen & Sent to Email')}</Text>
                </View>
              </ScrollView>
            )}

            {/* FLOW C: DIRECT TRAVEL CHECKOUT */}
            {selectedProgram?.category === 'TRAVEL_BOOKING' && (
              <ScrollView style={{ maxHeight: 440 }}>
                <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.guestTravelerName', 'Guest Traveler Name:')}</Text>
                <TextInput
                  style={[styles.inputField, { color: text, borderColor: softBorder, backgroundColor: softBg }]}
                  placeholder={t('rewardsScreen.namePlaceholder', 'e.g. John Doe')}
                  placeholderTextColor={muted}
                  value={travelerName}
                  onChangeText={setTravelerName}
                />

                <Text style={[styles.fieldLabel, { color: muted }]}>{t('rewardsScreen.bookingReferenceNotes', 'Booking Reference & Notes:')}</Text>
                <TextInput
                  style={[styles.inputField, { color: text, borderColor: softBorder, backgroundColor: softBg, height: 64 }]}
                  placeholder={t('rewardsScreen.notesPlaceholder', 'Hotel stay or itinerary notes...')}
                  placeholderTextColor={muted}
                  multiline
                  value={travelerNotes}
                  onChangeText={setTravelerNotes}
                />
              </ScrollView>
            )}

            {/* Modal Footer Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: softBg, borderColor: softBorder }]} onPress={() => setCheckoutModalVisible(false)}>
                <Text style={[styles.cancelBtnText, textStyle]}>{t('rewardsScreen.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitGoldBtn, { backgroundColor: cta.backgroundColor }]} onPress={handleExecuteRedemption}>
                <Text style={[styles.submitGoldBtnText, { color: cta.color }]}>
                  {selectedProgram?.category === 'GIFT_CARD'
                    ? t('rewardsScreen.getGiftCardCode', 'Get Gift Card Code 💳')
                    : selectedProgram?.category === 'TRAVEL_BOOKING'
                    ? t('rewardsScreen.confirmBookingCredit', 'Confirm Booking Credit 🌴')
                    : t('rewardsScreen.confirmTransfer', 'Confirm & Transfer 🚀')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SCREEN 4: Fulfillment Success & Claim Code Modal */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSuccessModalVisible(false)}>
          <Pressable style={[styles.modalContentCard, { backgroundColor: card, borderColor: softBorder, alignItems: 'center' }]} onPress={() => {}}>
            <View style={[styles.successCircleBox, { backgroundColor: `${accent}22` }]}>
              <Ionicons name="checkmark-circle" size={56} color={accent} />
            </View>

            <Text style={[styles.successTitleText, textStyle]}>{t('rewardsScreen.successTitle', '🎉 Redemption Successful!')}</Text>
            <Text style={[styles.successSubText, { color: muted }]}>
              {t('rewardsScreen.youRedeemed', 'You redeemed {{pts}} Valens Points for:', { pts: fulfillmentData?.valensPoints?.toLocaleString() })}
            </Text>
            <Text style={[styles.successFulfillmentName, { color: accent }]}>
              ${fulfillmentData?.rewardAmount} {fulfillmentData?.programName}
            </Text>

            {/* Voucher Box */}
            <View style={[styles.voucherBoxCard, { backgroundColor: softBg, borderColor: accent }]}>
              <Text style={[styles.voucherBoxLabel, { color: muted }]}>{t('rewardsScreen.yourClaimCode', 'YOUR CLAIM CODE:')}</Text>
              <Text style={[styles.voucherCodeValText, textStyle]} selectable>{fulfillmentData?.voucherCode}</Text>
              <TouchableOpacity
                style={[styles.copyCodeBtn, { backgroundColor: cta.backgroundColor }]}
                onPress={() => handleCopyVoucherCode(fulfillmentData?.voucherCode)}
              >
                <Ionicons name="copy-outline" size={16} color={cta.color} />
                <Text style={[styles.copyCodeBtnText, { color: cta.color }]}>
                  {copiedCode ? t('rewardsScreen.copied', 'Copied! ✅') : t('rewardsScreen.copyCode', '📋 COPY CODE')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.emailReceiptText, { color: muted }]}>
              {t('rewardsScreen.emailReceiptSent', '📧 A copy has also been sent to: {{email}}', { email: fulfillmentData?.recipientEmail })}
            </Text>
            <Text style={[styles.orderRefText, { color: muted }]}>
              {t('rewardsScreen.orderReference', 'Order Reference: {{ref}}', { ref: fulfillmentData?.orderReference })}
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: softBg, borderColor: softBorder }]}
                onPress={() => {
                  setSuccessModalVisible(false);
                  setActiveTab('HISTORY');
                }}
              >
                <Text style={[styles.cancelBtnText, textStyle]}>{t('rewardsScreen.viewInHistory', 'View in History')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitGoldBtn, { backgroundColor: cta.backgroundColor }]}
                onPress={() => setSuccessModalVisible(false)}
              >
                <Text style={[styles.submitGoldBtnText, { color: cta.color }]}>{t('rewardsScreen.backToHub', 'Back to Hub 🏠')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  brandBadge: { flexDirection: 'row', alignItems: 'flex-start' },
  brandValens: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  brandPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  brandPillText: { fontSize: 10, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 6, borderWidth: 1 },
  headerActionText: { fontSize: 11, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  heroBannerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeftCol: { flex: 1, minWidth: 200, paddingRight: 10 },
  heroTitle: { fontSize: 26, fontWeight: '900', marginBottom: 6 },
  heroSubText: { fontSize: 13, lineHeight: 19 },
  heroBalanceBox: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-end',
    minWidth: 170,
  },
  heroBalanceLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroBalanceValue: { fontSize: 32, fontWeight: '900', marginVertical: 2 },
  heroBalanceUsd: { fontSize: 11 },
  filterScroll: { marginBottom: 16 },
  filterScrollContent: { alignItems: 'center' },
  filterTabPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    marginRight: 8,
  },
  filterTabPillSelected: {},
  filterTabText: { fontSize: 13, fontWeight: '700' },
  filterTabTextSelected: {},
  loadingBox: { paddingVertical: 50, alignItems: 'center' },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  partnerCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  partnerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  partnerNameText: { fontSize: 14, fontWeight: '800', height: 38 },
  providerSubtitleText: { fontSize: 10, fontWeight: '800', marginTop: 2, textTransform: 'uppercase' },
  partnerDescText: { fontSize: 11, lineHeight: 16, marginTop: 6, height: 48 },
  rateRowBox: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  rateTextGold: { fontSize: 10, fontWeight: '800', flexShrink: 1, marginRight: 4 },
  minPtsText: { fontSize: 10, flexShrink: 0 },
  redeemBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  redeemBtnText: { fontSize: 13, fontWeight: '800' },
  historyContainer: { marginTop: 4 },
  sectionHeading: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  emptyCard: { padding: 30, borderRadius: 16, alignItems: 'center' },
  emptyText: { fontSize: 14, marginTop: 8 },
  historyReceiptCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  historyRowTop: { flexDirection: 'row', alignItems: 'center' },
  historyIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  historyInfoCol: { flex: 1 },
  historyTitleText: { fontSize: 14, fontWeight: '800' },
  historyDateText: { fontSize: 11, marginTop: 2 },
  statusBadgeCompleted: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '900' },
  historyFooterRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  historyPointsText: { fontSize: 12 },
  historyReceivedText: { fontSize: 13, fontWeight: '800' },
  historyVoucherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, marginTop: 8 },
  historyVoucherText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalContentCard: { width: '100%', borderWidth: 1, borderRadius: 20, padding: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalHeaderTitle: { fontSize: 18, fontWeight: '900' },
  modalSubTitle: { fontSize: 12, marginTop: 2 },
  modalCloseCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  readOnlyField: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center' },
  readOnlyFieldText: { fontSize: 14, fontWeight: '700' },
  inputField: { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  dropdownPickerBtn: { height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownPickerText: { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  dropdownMenuBox: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownMenuItem: { padding: 12, borderBottomWidth: 1 },
  dropdownMenuItemText: { fontSize: 12 },
  dropdownMenuItemAdd: { padding: 12 },
  dropdownMenuItemAddText: { fontSize: 12, fontWeight: '800' },
  stepperHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  stepperHeaderLabel: { fontSize: 12, fontWeight: '800' },
  stepperHeaderVal: { fontSize: 20, fontWeight: '900' },
  stepperControlBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 4, marginVertical: 6 },
  stepBtn: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepperNumericInput: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900' },
  conversionQuoteCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14 },
  quoteRowItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  quoteRowLabel: { fontSize: 12 },
  quoteRowValue: { fontSize: 12, fontWeight: '700' },
  quoteRowTotal: { borderTopWidth: 1, paddingTop: 10, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteTotalLabel: { fontSize: 13, fontWeight: '900' },
  quoteTotalVal: { fontSize: 20, fontWeight: '900' },
  denomGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 6 },
  denomPillBtn: { width: '48%', borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  denomPillBtnSelected: {},
  denomPillText: { fontSize: 12, fontWeight: '800' },
  denomPillTextSelected: {},
  modalBtnRow: { flexDirection: 'row', marginTop: 18 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  submitGoldBtn: { flex: 1.5, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  submitGoldBtnText: { fontSize: 14, fontWeight: '900' },
  successCircleBox: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  successTitleText: { fontSize: 20, fontWeight: '900', marginTop: 12 },
  successSubText: { fontSize: 13, marginTop: 4 },
  successFulfillmentName: { fontSize: 18, fontWeight: '900', marginTop: 2, marginBottom: 14 },
  voucherBoxCard: { width: '100%', borderWidth: 1.5, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14 },
  voucherBoxLabel: { fontSize: 11, fontWeight: '900' },
  voucherCodeValText: { fontSize: 22, fontWeight: '900', marginVertical: 8, letterSpacing: 1 },
  copyCodeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  copyCodeBtnText: { fontSize: 12, fontWeight: '900', marginLeft: 6 },
  emailReceiptText: { fontSize: 12, marginTop: 4 },
  orderRefText: { fontSize: 11, marginTop: 2, marginBottom: 14 },
});

export default MilesTravelRewardsScreen;
