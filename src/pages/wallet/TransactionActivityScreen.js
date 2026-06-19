import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import { useDispatch } from 'react-redux';

import { useAppTheme } from '../../theme/useApptheme';
import { showToastMessage } from '../../components/displaytoastmessage';
import { transationActivity } from '../../services/wallet';
import { getUserCredentials } from '../../services/post';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { useLanguage } from '../../i18n';
import HexAvatar from '../../components/home/story.js/HexAvatar';

const pickFirst = (...values) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const getProfilePayload = (response) =>
  response?.data?.user ||
  response?.data?.data?.user ||
  response?.data?.data ||
  response?.data ||
  response;

const getProfileImage = (profile) =>
  profile?.image ||
  profile?.avatar ||
  profile?.profilePicture ||
  profile?.profilePic ||
  '';

const resolveTransactionUserId = (tx) => pickFirst(
  tx?.userId,
  tx?.senderId,
  tx?.payerId,
  tx?.buyerId,
  tx?.fromUserId,
  tx?.user?.id,
  tx?.user?._id,
  tx?.user?.userId,
  '',
);

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatSignedMoney = (value) => {
  const n = toNumber(value);
  const sign = n < 0 ? '-' : '+';
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
};

const formatActivityDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return parts.replace(', ', ' • ').replace(', ', ' • ');
};

const resolveIcon = (type) => {
  const t = String(type || '').toLowerCase();
  if (t.includes('withdraw')) return 'arrow-down-outline';
  if (t.includes('mission')) return 'cash-outline';
  if (t.includes('subscription')) return 'people-outline';
  if (t.includes('support') || t.includes('follow')) return 'heart-outline';
  if (t.includes('transfer') || t.includes('wallet')) return 'swap-horizontal-outline';
  return 'receipt-outline';
};

const resolveTypeLabel = (tx) => {
  const rawType = pickFirst(
    tx?.typeTransaction,
    tx?.action,
    tx?.forPayment,
    tx?.type,
    tx?.transactionType,
    tx?.category,
    tx?.source,
    '',
  );
  const t = String(rawType || '').trim();
  const lowered = t.toLowerCase();
  if (lowered === 'payfollowing' || lowered === 'following' || lowered.includes('following')) return 'Following Payment';
  if (lowered === 'missiondonation' || lowered.includes('mission')) return 'Mission Donation';
  if (lowered === 'donation') return 'Donation';
  if (!t) return 'Transaction';
  return t
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const mapTransactionsToActivity = async (raw) => {
  const items = Array.isArray(raw) ? raw : [];
  const transactionUserIds = [
    ...new Set(items.map(resolveTransactionUserId).filter(Boolean).map(String)),
  ];

  const profileResults = await Promise.allSettled(
    transactionUserIds.map((id) => getUserCredentials(id)),
  );

  const profileMap = {};
  transactionUserIds.forEach((id, index) => {
    const result = profileResults[index];
    if (result?.status !== 'fulfilled') return;

    const profile = getProfilePayload(result.value);
    profileMap[id] = {
      displayName: pickFirst(profile?.displayName, profile?.name, profile?.fullName, ''),
      userName: pickFirst(profile?.userName, profile?.username, ''),
      image: getProfileImage(profile),
    };
  });

  return items.map((tx, index) => {
    const id = pickFirst(tx?.id, tx?._id, tx?.transactionId, tx?.txId, tx?.hash, `tx_${index}`);
    const transactionUserId = resolveTransactionUserId(tx);
    const userProfile = transactionUserId ? profileMap[String(transactionUserId)] : null;
    const typeLabel = resolveTypeLabel(tx);
    const status = pickFirst(tx?.status, tx?.paymentStatus, tx?.state, '');
    const rawAmount = pickFirst(tx?.amountUsd, tx?.amountUSD, tx?.amount_usd, tx?.amount, tx?.usdAmount, tx?.value, 0);
    const amountNumber = toNumber(rawAmount);
    const amountTone = amountNumber < 0 ? 'negative' : 'positive';

    const profileName = pickFirst(
      userProfile?.displayName,
      userProfile?.userName ? `@${userProfile.userName}` : '',
      tx?.senderName,
      tx?.receiverName,
      '',
    );
    const profileHandle = userProfile?.userName ? `@${userProfile.userName}` : '';
    const title = pickFirst(profileName, tx?.title, tx?.label, typeLabel) || 'Transaction';

    const subtitle = pickFirst(
      profileHandle, tx?.subtitle, tx?.description, tx?.note, tx?.missionQuestion,
      tx?.mission?.question, tx?.mission?.title, tx?.receiverName, tx?.senderName, '',
    );

    const createdAt = pickFirst(
      tx?.createdAt, tx?.created_at, tx?.timestamp, tx?.date, tx?.updatedAt, tx?.updated_at, null,
    );

    return {
      key: String(id),
      icon: resolveIcon(typeLabel),
      title: String(title),
      subtitle: subtitle ? String(subtitle) : [typeLabel, status].filter(Boolean).join(' • ') || '—',
      amount: formatSignedMoney(amountNumber),
      amountTone,
      date: formatActivityDate(createdAt),
      typeLabel,
      status,
      profileUserId: transactionUserId ? String(transactionUserId) : '',
      profileImage: userProfile?.image || '',
      profileUserName: userProfile?.userName || '',
      profileDisplayName: userProfile?.displayName || '',
    };
  });
};

export default function TransactionActivityScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const dispatch = useDispatch();
  const { bgStyle, text, cardStyle } = useAppTheme();
  const { t } = useLanguage();

  const initialActivity = route?.params?.activity;
  const [activity, setActivity] = useState(Array.isArray(initialActivity) ? initialActivity : []);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      dispatch(showLoader());
      const response = await transationActivity();
      const raw =
        response?.data?.transactions ||
        response?.data?.data?.transactions ||
        response?.data?.data ||
        response?.data ||
        [];
      setActivity(await mapTransactionsToActivity(raw));
    } catch (e) {
      showToastMessage(toast, 'danger', e?.response?.data?.message || e?.message || t('transactions.loadFailed'));
    } finally {
      dispatch(hideLoader());
      setLoading(false);
    }
  }, [dispatch, toast, t]);

  useFocusEffect(
    React.useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const data = useMemo(() => (Array.isArray(activity) ? activity : []), [activity]);

  const handleActivityProfilePress = useCallback((item) => {
    if (!item?.profileUserId) return;

    navigation.navigate('HomeMain', {
      screen: 'UsersProfile',
      params: {
        userId: item.profileUserId,
        returnTo: { tab: 'wallet', screen: 'TransactionActivity' },
        userName: item.profileUserName,
      },
    });
  }, [navigation]);

  const renderItem = useCallback(({ item }) => {
    const amountColor =
      item.amountTone === 'positive'
        ? '#22C55E'
        : item.amountTone === 'negative'
          ? '#EF4444'
          : text;

    return (
      <View style={[styles.activityRow, cardStyle, { borderColor: `${text}1a` }]}>
        <TouchableOpacity
          style={styles.activityProfilePressable}
          activeOpacity={item.profileUserId ? 0.75 : 1}
          onPress={() => handleActivityProfilePress(item)}
          disabled={!item.profileUserId}
          accessibilityRole={item.profileUserId ? 'button' : undefined}
        >
          <View style={styles.activityAvatarWrap}>
            <HexAvatar uri={item.profileImage} size={38} borderWidth={1.5} borderColor={text} />
          </View>
          <View style={styles.activityTextWrap}>
            <Text style={[styles.activityTitle, { color: text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.activitySubtitle, { color: `${text}99` }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
            <Text style={[styles.activityMetaText, { color: `${text}80` }]} numberOfLines={1}>
              {[item.typeLabel, item.status].filter(Boolean).join(' • ')}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.activityRight}>
          <Text style={[styles.activityAmount, { color: amountColor }]}>{item.amount}</Text>
          <Text style={[styles.activityDate, { color: `${text}80` }]}>{item.date}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={`${text}66`} style={styles.activityChevron} />
      </View>
    );
  }, [cardStyle, handleActivityProfilePress, text]);

  const keyExtractor = useCallback((item, index) => String(item?.key ?? index), []);

  const ListEmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={text} />
        </View>
      );
    }
    return (
      <View style={[styles.activityRow, cardStyle, { borderColor: `${text}1a` }]}>
        <View style={[styles.activityIconWrap, { backgroundColor: `${text}0d`, borderColor: `${text}1a` }]}>
          <Ionicons name="time-outline" size={18} color={text} />
        </View>
        <View style={styles.activityTextWrap}>
          <Text style={[styles.activityTitle, { color: text }]}>{t('transactions.noTransactionsTitle')}</Text>
          <Text style={[styles.activitySubtitle, { color: `${text}99` }]} numberOfLines={1}>
            {t('transactions.noTransactionsSubtitle')}
          </Text>
        </View>
      </View>
    );
  }, [cardStyle, loading, text, t]);

  return (
    <View style={[styles.screen, bgStyle]}>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  listContent: { paddingBottom: 22 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  activityIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  activityProfilePressable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAvatarWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  activityTextWrap: { flex: 1, minWidth: 0, paddingRight: 10 },
  activityTitle: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  activitySubtitle: { fontSize: 12, fontWeight: '700' },
  activityMetaText: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  activityRight: { alignItems: 'flex-end', marginRight: 10 },
  activityAmount: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  activityDate: { fontSize: 11, fontWeight: '700' },
  activityChevron: { marginLeft: 2 },
  emptyWrap: { paddingVertical: 22 },
});
