// CreatorCoinScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import { useToast } from 'react-native-toast-notifications';
import UnverifiedProfileModal from '../../components/modals/Unverifiedmodal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { getUserCredentials } from '../../services/post';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFirstDayOfMonth } from 'date-fns';

export default function CreatorCoin() {
  const [visible3, setVisible3] = useState(false);
  const [data, setData] = useState();
  const navigation = useNavigation();
  const toast = useToast();
  const userId = '';
  const dispatch = useDispatch();
  const copyToClipboard = () => {
    Clipboard.setString(data?.walletAddress);
    showToastMessage(toast, 'success', 'Copied to clipboard ✅');
    // Alert.alert("Copied!", `User ID $ copied to clipboard.`);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    const id = await AsyncStorage.getItem('userId');
    try {
      dispatch(showLoader());

      // Run both API calls in parallel
      const [profileResponse] = await Promise.all([
        getUserCredentials(id)
      ]);

      // Handle profile response
      if (profileResponse?.statusCode === 200) {
        let userDataToSet;
        if (profileResponse.data && profileResponse.data.user) {
          userDataToSet = profileResponse.data.user;
        } else if (profileResponse.data) {
          userDataToSet = profileResponse.data;
        } else {
          userDataToSet = profileResponse;
        }
        setData(userDataToSet);
        console.log('User profile:', userDataToSet.profile);
      } else {
        showToastMessage(toast, 'danger', profileResponse.data.message);
      }

    } catch (error) {
      showToastMessage(
        toast,
        'danger',
        error?.response?.message ?? 'Something went wrong',
      );
    } finally {
      dispatch(hideLoader());
    }
  };

  const PLACEHOLDER_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  const avatarUri = typeof data?.image === 'string' && data?.image.length ? data?.image : PLACEHOLDER_AVATAR;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Creator coin</Text>
        <TouchableOpacity>
          <Ionicons name="share-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}

        {/* Profile + Price */}
        <View style={styles.priceSection}>
          <View style={styles.username}>
            <View style={styles.userRow}>
              <Text style={styles.coinName}>${data?.userName}</Text>
              <TouchableOpacity
                onPress={() => {
                  setVisible3(true);
                }}
              >
                {/* <Text style={styles.unverified}>Unverified</Text> */}
              </TouchableOpacity>
            </View>

            <Text style={styles.coinPrice}>$2,803</Text>
          </View>
          <TouchableOpacity>
            <Image
              source={{
                uri: avatarUri,
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={styles.balanceBox}>
          <Image
            source={{
              uri: avatarUri,
            }}
            style={styles.balanceAvatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceTitle}>Your balance</Text>
            <Text style={styles.balanceValue}>1,908,352</Text>
          </View>
          {/* <Text style={styles.balanceAmount}>$0</Text> */}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View>
            <TouchableOpacity>
              <Text style={styles.statLabel}>Holders</Text>
              <Text style={styles.statValue}>0</Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity>
              <Text style={styles.statLabel}>Total volume</Text>
              <Text style={styles.statValue}>$0</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.wrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.buttonRow}
          >
            <TouchableOpacity style={styles.smallBtn} onPress={copyToClipboard}>
              <Text style={styles.smallBtnText}>Copy address</Text>
              <Ionicons name="copy-outline" size={15} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn}>
              <Ionicons name="remove-circle-outline" size={15} color="#000" />
              <Text style={styles.smallBtnText}>Basescan</Text>
            </TouchableOpacity>

            {/* {/* <TouchableOpacity style={styles.smallBtn}>
              <Ionicons name="globe-outline" size={15} color="#000" />
              <Text style={styles.smallBtnText}>Username</Text>
            </TouchableOpacity> */}
          </ScrollView>
        </View>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total supply</Text>
            <Text style={styles.detailValue}>1,00,000</Text>
          </View>

          <View style={styles.detailRow1}>
            <Text style={styles.detailLabel}>Contract address</Text>
            <TouchableOpacity
              onPress={copyToClipboard}
              style={styles.adressCopy}
            >
              <Text style={styles.detailValue}>{data?.walletAddress.trim().slice(0, 12) + '....'}</Text>
              {/* <Ionicons name="copy-outline" size={15} color="#000" /> */}
            </TouchableOpacity>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{new Date(data?.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Trade Button */}
      <TouchableOpacity style={styles.tradeButton}>
        <Text style={styles.tradeText}>Withdraw</Text>
      </TouchableOpacity>
      <UnverifiedProfileModal visible3={visible3} setVisible3={setVisible3} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f2fd' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    // alignItems: "center",
    position: 'static',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'black' },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    position: 'relative',
  },
  coinName: { fontSize: 18, fontWeight: '700', color: 'black' },
  unverified: {
    fontSize: 12,
    color: 'gray',
    backgroundColor: '#eee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  coinPrice: { fontSize: 28, fontWeight: '700', marginVertical: 10 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    position: 'absolute',
    right: 20,
    top: 0,
    borderWidth: 3,
  },
  chartBox: {
    alignItems: 'center',
    padding: 40,
    borderBottomWidth: 0.5,
    borderColor: '#ddd',
  },
  chartText: { color: 'gray' },

  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    // paddingVertical: 20,
    marginTop: 15,
  },
  statLabel: { fontSize: 14, color: 'gray', textAlign: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  balanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f2fd',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: -15,
  },
  balanceAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  balanceTitle: { fontSize: 14, color: 'gray' },
  balanceValue: { fontSize: 16, fontWeight: '600', color: 'black' },
  balanceAmount: { fontSize: 14, fontWeight: '600', color: 'black' },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f8f2fd',
    paddingHorizontal: 15,
    // paddingVertical: 8,
    borderRadius: 20,
  },
  smallBtnText: {
    fontSize: 14,
    color: 'black',
    paddingHorizontal: 4,
    fontWeight: '600',
  },
  detailsBox: {
    backgroundColor: '#f8f2fd',
    gap: 5,
    padding: 10,
    borderRadius: 20,
    marginBottom: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f8f2fd',
    paddingHorizontal: 10,
  },
  detailRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f8f2fd',
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  detailLabel: { color: 'gray', fontSize: 16, fontWeight: '600' },
  detailValue: {
    color: 'black',
    fontSize: 14,
    fontWeight: '600',
    alignItems: 'flex-end',
  },
  tradeButton: {
    backgroundColor: '#5a2d82',
    marginHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    position: 'static',
  },
  tradeText: { fontSize: 16, fontWeight: '600', color: 'white' },
  username: { flexDirection: 'column', marginLeft: 20 },
  adressCopy: { flexDirection: 'row', justifyContent: 'space-evenly', gap: 3 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 40,
  },
  wrapper: {
    marginVertical: 10,
    alignItems: 'center',
  },
});
