import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { getTopCreators } from '../../services/tokens';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';

export const CreatorsScreen = ({ navigation }) => {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(false);
  const { bgStyle, textStyle, text } = useAppTheme();
  const dispatch = useDispatch();
  const toast = useToast();

  const fetchTopCreators = async () => {
    try {
      setLoading(true);
      dispatch(showLoader());
      const response = await getTopCreators();
      if (response?.statusCode === 200) {
        const formattedCreators = response.data.map((creator, index) => ({
          id: index + 1,
          name: `@${creator.username || 'unknown'}`,
          vendorId: creator.vendorId,
          price: `$${Number(creator.purchaseTokenPrice).toFixed(4) || '0.0000'}`,
          marketCap: '$--', // Placeholder unless provided by API
          followers: Math.floor(Math.random() * 3000), // Placeholder for now
          // verified: index % 2 === 0, // Randomly set for demo
          bio: 'Tokenized creator on the platform', // Placeholder bio
        }));

        setCreators(formattedCreators.slice(0, 10)); // Limit to 10 if needed
      } else {
        showToastMessage('danger', response.data.message || 'Failed to fetch creators');
      }
    } catch (error) {
      showToastMessage(
        'danger',
        error?.response?.message ?? 'Something went wrong while fetching creators',
      );
    } finally {
      dispatch(hideLoader());
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopCreators();
  }, []);

  const renderCreator = ({ item }) => (
    <View style={[styles.creatorCard, {shadowColor: text}]}>
      <View style={[styles.creatorCardHeader, { backgroundColor: text}]}>
        <View style={styles.creatorAvatar}>
          <Text style={styles.avatarText}>{item.name.charAt(1).toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.creatorCardContent}>
        <View style={styles.creatorNameRow}>
          <Text style={styles.creatorCardName}>{item.name}</Text>
          {/* {item.verified && <Ionicons name="checkmark-circle" size={16} color={text} />} */}
        </View>
        <Text style={styles.creatorBio}>{item.bio}</Text>

        <View style={styles.creatorStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.price}</Text>
            <Text style={styles.statLabel}>Price</Text>
          </View>
          {/* <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.marketCap}</Text>
            <Text style={styles.statLabel}>Market Cap</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.followers}</Text>
            <Text style={styles.statLabel}>Holders</Text>
          </View> */}
        </View>

        <View style={styles.creatorActions}>
          {/* <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>Vallow</Text>
          </TouchableOpacity> */}
          <TouchableOpacity style={[styles.viewProfileButton, {backgroundColor: text}]} onPress={() => navigation.navigate('CreatorProfile', { userId: item.vendorId })}>
            <Text style={styles.viewProfileButtonText}>View Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, bgStyle]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* <View style={styles.header}>
          <Text style={styles.headerTitle}>Creators</Text> */}
          {/* <TouchableOpacity style={styles.createProfileButton}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createProfileButtonText}>Create Profile</Text>
          </TouchableOpacity> */}
        {/* </View> */}

        {loading ? (
          <ActivityIndicator size="large" color={text} />
        ) : (
          <View style={styles.section}>
            <FlatList
              data={creators}
              renderItem={renderCreator}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              columnWrapperStyle={styles.creatorRow}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: Platform.OS == "ios" ? 40 : 0
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: Platform.OS == "ios" ? 20 : 0
  },

  // Creator Cards
  createProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createProfileButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  creatorRow: {
    justifyContent: 'space-between',
  },
  creatorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    flex: 1,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  creatorCardHeader: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  creatorCardContent: {
    padding: 10,
    paddingTop: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  creatorCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginRight: 4,
  },
  creatorBio: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  creatorStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
  },
  creatorActions: {
    flexDirection: 'row',
  },
  followButton: {
    paddingHorizontal: 10,
    // paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flex: 1,
    marginRight: 6,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    // marginTop: '14%',
  },
  viewProfileButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 6,
  },
  viewProfileButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CreatorsScreen;