import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    Alert,
    Image,
    ScrollView,
    TextInput,
    Keyboard,
    Linking,
    Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Feather from "react-native-vector-icons/Feather";
import Clipboard from "@react-native-clipboard/clipboard";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import TradeModal from "../../components/modals/TradeModal";
import TextGradient from "../../assets/textgradient/TextGradient";
import { useDispatch, useSelector } from "react-redux";
import { getUserCredentials, getUserDashboard } from "../../services/post";
import { hideLoader, showLoader } from "../../redux/actions/LoaderAction";
import { showToastMessage } from "../../components/displaytoastmessage";
import { useToast } from "react-native-toast-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTopCreators, getTotalTokenPurchase } from "../../services/tokens";
import RBSheet from "react-native-raw-bottom-sheet";
import TokenPurchaseModal from "../../components/modals/TokenPurchaseModal";
import { getCreditsLeft } from "../../services/wallet";
import { createCheckoutSession } from "../../services/stirpe";
import TokenSellModal from "../../components/modals/TokenSellModal";
import InAppBrowser from "react-native-inappbrowser-reborn";

const WalletAddress = '0xf8652b01';
const userCredits = { current: 3, total: 5, renewal: "Oct 1" };
const userVerificationStatus = { verified: true, level: "Dragonfly Verified" };

const sharewallet = () => {
    Alert.alert('Shared', 'Wallet details shared successfully');
}

export default function WalletComponent() {
    const [userData, setUserData] = useState();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCreator, setSelectedCreator] = useState(null);
    const [portfolioValue, setPortfolioValue] = useState();
    const [purchaseAutoFocus, setPurchaseAutoFocus] = useState(false);
    const [creditsLeft, setCreditsLeft] = useState(0);
    const [topCreators, setTopCreators] = useState([]); // State for top creators
    const [holdingsData, setHoldingsData] = useState([]); // State for holdings data
    const [tokenAddress, setTokenAddress] = useState(null);
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const toast = useToast();
    const purchaseSheetRef = useRef(null);
    const sellSheetRef = useRef(null);
    const profileImage = useSelector(state => state.profileImage?.profileImg);

    useFocusEffect(
        React.useCallback(() => {
            fetchUserCreds();
            fetchDashboardData();
            fetchCreditsLeft();
            fetchTopCreators(); // Fetch top creators
        }, [])
    );

    useEffect(() => {
        let timeout;

        const onKeyboardHide = () => {
            timeout = setTimeout(() => {
                purchaseSheetRef.current?.updateLayout?.({ height: 500 });
            }, 300);
        };

        const hideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);

        return () => {
            hideSub.remove();
            if (timeout) clearTimeout(timeout);
        };
    }, []);

    const fetchUserCreds = async () => {
        const id = await AsyncStorage.getItem('userId');
        try {
            dispatch(showLoader());
            const response = await getUserCredentials(id);

            if (response?.statusCode === 200) {
                let userDataToSet;
                if (response.data && response.data.user) {
                    userDataToSet = response.data.user;
                } else if (response.data) {
                    userDataToSet = response.data;
                } else {
                    userDataToSet = response;
                }

                if (userDataToSet?.image) {
                    let formattedImageUrl = userDataToSet.image;
                    formattedImageUrl = formattedImageUrl.trim();

                    if (formattedImageUrl.startsWith('http://') || formattedImageUrl.startsWith('https://')) {
                        console.log('Image URL is already absolute:', formattedImageUrl);
                    } else if (formattedImageUrl.startsWith('/')) {
                        formattedImageUrl = `http://35.174.167.92:3002${formattedImageUrl}`;
                        console.log('Converted relative URL to absolute:', formattedImageUrl);
                    } else {
                        formattedImageUrl = `http://35.174.167.92:3002/${formattedImageUrl}`;
                        console.log('Converted path to absolute URL:', formattedImageUrl);
                    }

                    userDataToSet.image = formattedImageUrl;
                    console.log('Final formatted image URL:', formattedImageUrl);
                }

                console.log(userDataToSet, 'this is response from getUserDashboard in wallet');
                setUserData(userDataToSet);
            } else {
                showToastMessage(toast, 'danger', response.data.message);
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

    const fetchDashboardData = async () => {
        try {
            dispatch(showLoader());
            const response = await getTotalTokenPurchase();
            if (response?.statusCode === 200) {
                const totalPortfolioValue = response.data.reduce(
                    (sum, item) => sum + (item.totalTokenAmount || 0),
                    0
                );
                setPortfolioValue(`$ ${totalPortfolioValue.toFixed(4)}`);
                setHoldingsData(response.data); // Set holdings data
            } else {
                showToastMessage(toast, 'danger', response.data.message);
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

    const fetchCreditsLeft = async () => {
        try {
            dispatch(showLoader());
            const response = await getCreditsLeft();
            if (response?.statusCode === 200) {
                setCreditsLeft(response.data.hitLeft);
            } else {
                showToastMessage(toast, 'danger', response.data.message);
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

    // New function to fetch top creators
    const fetchTopCreators = async () => {
        try {
            dispatch(showLoader());
            const response = await getTopCreators(); // Call your top creators API
            if (response?.statusCode === 200) {
                setTopCreators(response.data || []);
            } else {
                showToastMessage(toast, 'danger', response?.message || 'Failed to fetch creators');
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

    const createStripeSubscription = async () => {
        dispatch(showLoader());
        try {
            const response = await createCheckoutSession();

            if (response?.statusCode === 200 && response?.data?.url) {
                const url = response.data.url;

                if (await InAppBrowser.isAvailable()) {
                    await InAppBrowser.open(url, {
                        // Customization options
                        dismissButtonStyle: 'close',
                        preferredBarTintColor: '#ffffff',
                        preferredControlTintColor: '#000000',
                        readerMode: false,
                        animated: true,
                        modalPresentationStyle: 'fullScreen',
                        modalTransitionStyle: 'coverVertical',
                        enableBarCollapsing: false,
                        showTitle: true,
                        toolbarColor: '#ffffff',
                        secondaryToolbarColor: '#f0f0f0',
                    });
                } else {
                    // Fallback if in-app browser isn’t available
                    await Linking.openURL(url);
                }
            } else {
                showToastMessage(
                    toast,
                    'danger',
                    response?.error ||
                    response?.message ||
                    'Failed to create payment session. Please try again.'
                );
            }
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                'Network error. Please check your internet connection and try again.'
            );
        } finally {
            dispatch(hideLoader());
        }
    };

    const handleFollowUnfollow = (selectedCreator, currentlyFollowing) => {
        console.log(selectedCreator, 'selectedCreator');

        setTokenAddress(selectedCreator?.tokenAddress || null);
        setSelectedCreator(selectedCreator?.vendorId || null);
        if (!currentlyFollowing) {
            setTimeout(() => purchaseSheetRef.current?.open?.(), 0);
        }
        else {
            setTimeout(() => sellSheetRef.current?.open?.(), 0)
        }
    };

    const handleBuyCredits = () => {
        Alert.alert(
            'Buy Post Credits',
            'Purchase 5 additional post credits?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Purchase', onPress: () => {
                        createStripeSubscription()
                    }
                }
            ]
        );
    };

    const copyToClipboard = () => {
        Clipboard.setString(userData?.walletAddress);
        Alert.alert("Copied!", `Your wallet address is copied to clipboard.`);
    };

    const handleTokenModalClose = () => {
        purchaseSheetRef.current?.close?.();
    };

    const handleTokenPurchase = async () => {
        purchaseSheetRef.current?.close?.();
    }

    const handleTokenSell = useCallback(() => {
        sellSheetRef.current?.close();
        showToastMessage(toast, 'success', 'Tokens sold successfully!');
        fetchUserCreds();
        fetchDashboardData();
        fetchCreditsLeft();
        fetchTopCreators();
}, []);

const CreatorDashboard = ({ creator }) => (
    <View style={styles.creatorDashboard}>
        <View style={styles.creatorHeader}>
            <View style={styles.creatorInfo}>
                <View style={styles.creatorAvatar}>
                    <Text style={styles.avatarText}>
                        {creator.vendorName ? creator.vendorName.charAt(0) : 'U'}
                    </Text>
                </View>
                <View>
                    <View style={styles.nameRow}>
                        <Text style={styles.creatorName}>
                            {creator.vendorName || 'Unknown Creator'}
                        </Text>
                    </View>
                    <Text style={styles.creatorUsername}>
                        {creator.tokenAddress ? `${creator.tokenAddress.slice(0, 10)}...` : ''}
                    </Text>
                </View>
            </View>
        </View>

        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <Text style={styles.statValue}>
                    ${creator.tokenPrice?.toFixed(4) || '0.00'}
                </Text>
                <Text style={styles.statLabel}>Current Price</Text>
            </View>
            <View style={styles.statItem}>
                <Text style={styles.statValue}>
                    ${creator.totalTokenAmount?.toFixed(2) || '0.00'}
                </Text>
                <Text style={styles.statLabel}>Total Value</Text>
            </View>
            <View style={styles.statItem}>
                <Text style={styles.statValue}>
                    {creator.tokenAmount || 0}
                </Text>
                <Text style={styles.statLabel}>Tokens Held</Text>
            </View>
        </View>

        <View style={styles.tradeButtons}>
            <TouchableOpacity
                style={[styles.tradeBtn, styles.buyBtn]}
                onPress={() => handleFollowUnfollow(creator, false)}
            >
                <Text style={styles.tradeBtnText}>Buy (Follow)</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tradeBtn, styles.sellBtn]}
                onPress={() => handleFollowUnfollow(creator, true)}
            >
                <Text style={[styles.tradeBtnText, styles.sellBtnText]}>Sell (Unfollow)</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const CoinsList = ({ navigation }) => {
    const filteredList = topCreators.filter(item =>
        (item.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (item.tokenAddress?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#f8f2fd' }}>
            <Text style={styles.subHeader}>{filteredList.length} creators</Text>
            <Text style={styles.note}>Follow = Buy | Unfollow = Sell easily</Text>

            <FlatList
                data={filteredList}
                keyExtractor={(item, index) => item.vendorId || index.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.coinItem}
                        onPress={() => {
                            setSelectedCreator(item);
                        }}
                    >
                        <View style={styles.coinAvatar}>
                            <Text style={styles.avatarText}>
                                {item.username ? item.username.charAt(0) : 'U'}
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.nameRow}>
                                <Text style={styles.coinName}>
                                    {item.username || 'Unknown'}
                                </Text>
                            </View>
                            {/* <Text style={styles.creatorUsername}>
                                    {item.tokenAddress ? `${item.tokenAddress.slice(0, 15)}...` : ''}
                                </Text>
                                <Text style={styles.marketCapText}>
                                    Tokens: {item.tokenAmount || 0}
                                </Text> */}
                        </View>

                        <View style={styles.priceSection}>
                            <Text style={styles.price}>
                                ${item.purchaseTokenPrice?.toFixed(4) || '0.00'}
                            </Text>
                            <TouchableOpacity
                                style={[styles.followBtn, styles.followBtnActive]}
                                onPress={() => { setTimeout(() => purchaseSheetRef.current?.open?.(), 0); }}
                            >
                                <Text style={[styles.followBtnText, styles.followBtnActiveText]}>
                                    Buy
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#666', fontSize: 16 }}>
                            No creators found
                        </Text>
                    </View>
                )}
            />
        </View>
    );
};

const MyHoldings = () => {
    return (
        <View style={{ flex: 1, backgroundColor: '#f8f2fd', }}>
            <Text style={styles.subHeader}>{holdingsData.length} holdings</Text>
            <Text style={styles.note}>Your current creator investments</Text>

            <FlatList
                data={holdingsData}
                keyExtractor={(item, index) => item.vendorId || index.toString()}
                renderItem={({ item }) => (
                    <View style={styles.holdingItem}>
                        <CreatorDashboard creator={item} />
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#666', fontSize: 16 }}>
                            You don't have any holdings yet
                        </Text>
                        <Text style={{ color: '#999', fontSize: 14, marginTop: 8 }}>
                            Start following creators to build your portfolio
                        </Text>
                    </View>
                )}
            />
        </View>
    );
};

const Tab = createMaterialTopTabNavigator();

return (
    <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 10, marginTop: Platform.OS == "ios" ? 20 : 0 }}
            showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 15 }}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View>
                        <View style={styles.nameRow}>
                            <Text style={styles.username}>{userData?.displayName}</Text>
                            {userVerificationStatus.verified && (
                                <Ionicons name="checkmark-circle" size={20} color="#5a2d82" />
                            )}
                        </View>
                        {userVerificationStatus.verified && (
                            <Text style={styles.verificationBadge}>{userVerificationStatus.level}</Text>
                        )}
                        <View style={styles.idRow}>
                            <Text style={styles.walletAddress}>{(userData?.walletAddress || '').trim().slice(0, 10)}</Text>
                            <TouchableOpacity onPress={copyToClipboard} style={styles.clipboardBtn}>
                                <Ionicons name="copy-outline" size={15} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Image
                        source={{
                            uri: profileImage ? profileImage : "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                        }}
                        style={styles.profileImage}
                    />
                </View>

                {/* Holdings Box */}
                <View style={styles.holdingsBox}>
                    <Text style={styles.holdingsText}>Total value of holdings</Text>
                    <Text style={styles.holdingsAmount}>{portfolioValue || '$ 0.00'}</Text>
                </View>

                {/* Credits Section */}
                <View style={styles.creditsBox}>
                    <View style={styles.creditsInfo}>
                        <MaterialCommunityIcons name="credit-card-outline" size={24} color="#5a2d82" />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.creditsTitle}>Post Credits</Text>
                            <Text style={styles.creditsCount}>
                                {creditsLeft} / 5 remaining
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.buyCreditsBtn} onPress={handleBuyCredits}>
                        <Text style={styles.buyCreditsText}>Buy Credits</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>

        {/* Tabs */}
        <View style={{ flex: 1, minHeight: 350 }}>
            <Tab.Navigator
                screenOptions={{
                    tabBarLabelStyle: { fontWeight: '700', fontSize: 14, color: '#5a2d82' },
                    tabBarStyle: { backgroundColor: '#f8f2fd' },
                    tabBarIndicatorStyle: { backgroundColor: '#5a2d82', height: 3, borderRadius: 2 },
                }}
            >
                <Tab.Screen
                    name="Discover"
                    children={() => (
                        <CoinsList
                            navigation={navigation}
                        />
                    )}
                />
                <Tab.Screen
                    name="Holdings"
                    component={MyHoldings}
                />
            </Tab.Navigator>
        </View>

        {/* Token Purchase Modal */}
        <RBSheet
            ref={purchaseSheetRef}
            height={500}
            openDuration={250}
            draggable={true}
            closeOnPressMask={true}
            customModalProps={{ statusBarTranslucent: true }}
            onOpen={() => setPurchaseAutoFocus(true)}
            onClose={() => {
                Keyboard.dismiss();
                setPurchaseAutoFocus(false);
                setSelectedCreator(null);
            }}
            customStyles={{
                container: {
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    backgroundColor: '#f8f2fd',
                    bottom: -30,
                },
                draggableIcon: {
                    backgroundColor: '#ccc',
                    width: 60,
                },
            }}
        >
            <TokenPurchaseModal
                onClose={handleTokenModalClose}
                onPurchase={handleTokenPurchase}
                hasFollowing={true}
                autoFocus={purchaseAutoFocus}
                vendorid={selectedCreator?.vendorId || ''}
            />
        </RBSheet>

        {/* Token Sell Modal */}
        <RBSheet
            ref={sellSheetRef}
            height={550}
            openDuration={250}
            draggable={true}
            closeOnPressMask={true}
            customModalProps={{ statusBarTranslucent: true }}
            onOpen={() => setPurchaseAutoFocus(true)}
            onClose={() => {
                Keyboard.dismiss();
                setPurchaseAutoFocus(false);
                setSelectedCreator(null);
            }}
            customStyles={{
                container: {
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    backgroundColor: '#f8f2fd',
                    bottom: -30,
                },
                draggableIcon: {
                    backgroundColor: '#ccc',
                    width: 60,
                },
            }}
        >
            <TokenSellModal
                onSell={handleTokenSell}
                userId={selectedCreator?.vendorId || ''}
                tokenAddress={tokenAddress}
            />
        </RBSheet>
    </SafeAreaView>
);
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f2fd',
        paddingTop: 20,
        paddingBottom: 50,
    },
    profileSection: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        // paddingVertical: 12,
        borderBottomColor: "#eee",
        marginTop: 0,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    username: {
        fontSize: 20,
        fontWeight: "600",
        color: '#111'
    },
    verificationBadge: {
        fontSize: 12,
        color: '#5a2d82',
        fontWeight: '600',
        marginTop: 2,
    },
    walletAddress: {
        fontSize: 16,
        color: "#5a2d82"
    },
    idRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    clipboardBtn: {
        marginLeft: 3
    },
    profileImage: {
        width: 50,
        height: 50,
        borderRadius: 35,
        borderWidth: 2
    },
    holdingsBox: {
        alignItems: "center",
        marginVertical: 10,
        marginTop: 8,
        backgroundColor: '#ffffff',
        paddingVertical: 10,
        borderRadius: 16,
        marginHorizontal: 8,
        shadowColor: '#5a2d82',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    holdingsText: {
        color: "#666",
        fontSize: 14
    },
    holdingsAmount: {
        fontSize: 34,
        fontWeight: "700",
        color: '#5a2d82',
        paddingHorizontal: 20,
        textAlign: 'center'
    },
    creditsBox: {
        backgroundColor: '#ffffff',
        padding: 10,
        borderRadius: 16,
        // marginVertical: 10,
        marginHorizontal: 8,
        shadowColor: '#5a2d82',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    creditsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    creditsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
    },
    creditsCount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#5a2d82',
    },
    creditsRenewal: {
        fontSize: 12,
        color: '#666',
    },
    buyCreditsBtn: {
        backgroundColor: '#5a2d82',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    buyCreditsText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    actions: {
        flexDirection: "row",
        marginVertical: 15,
    },
    coinName: {
        fontSize: 18,
        fontWeight: "700",
        color: '#111'
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        marginHorizontal: 15,
        marginTop: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        shadowColor: '#5a2d82',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111',
    },
    subHeader: {
        fontSize: 20,
        fontWeight: "700",
        marginHorizontal: 15,
        marginTop: 15,
        color: '#5a2d82'
    },
    note: {
        fontSize: 13,
        color: "#666",
        marginHorizontal: 15,
        marginBottom: 5
    },
    coinItem: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 15,
        marginVertical: 8,
        backgroundColor: '#ffffff',
        padding: 12,
        borderRadius: 16,
        shadowColor: '#5a2d82',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    coinAvatar: {
        width: 44,
        height: 44,
        backgroundColor: "#5a2d82",
        borderRadius: 22,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    creatorUsername: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    marketCapText: {
        fontSize: 11,
        color: '#5a2d82',
        fontWeight: '600',
        marginTop: 1,
    },
    followersText: {
        fontSize: 11,
        color: '#666',
        marginTop: 1,
    },
    priceSection: {
        alignItems: 'center',
        marginRight: 8,
    },
    price: {
        fontSize: 14,
        fontWeight: "700",
        color: '#5a2d82',
        marginBottom: 4,
    },
    followBtn: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#5a2d82',
    },
    followBtnActive: {
        backgroundColor: '#5a2d82',
    },
    unfollowBtn: {
        backgroundColor: '#fff',
    },
    followBtnText: {
        fontSize: 10,
        fontWeight: '600',
    },
    followBtnActiveText: {
        color: '#fff',
    },
    unfollowBtnText: {
        color: '#5a2d82',
    },
    newTag: {
        backgroundColor: "#f3e9ff",
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 10,
    },
    verifiedTag: {
        backgroundColor: '#e8f5e8',
    },
    newText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#5a2d82"
    },
    verifiedText: {
        color: '#2d8f2d',
    },
    creatorDashboard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#5a2d82',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    creatorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    creatorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    creatorAvatar: {
        width: 50,
        height: 50,
        backgroundColor: '#5a2d82',
        borderRadius: 25,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    creatorName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#5a2d82',
    },
    statLabel: {
        fontSize: 11,
        color: '#666',
        marginTop: 2,
    },
    tradeButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    tradeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    buyBtn: {
        backgroundColor: '#5a2d82',
    },
    sellBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#5a2d82',
    },
    tradeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    sellBtnText: {
        color: '#5a2d82',
    },
    holdingItem: {
        marginHorizontal: 15,
    },
});