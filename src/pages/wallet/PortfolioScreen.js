import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TradeModal from '../../components/modals/TradeModal';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getTotalTokenPurchase } from '../../services/tokens';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { useAppTheme } from '../../theme/useApptheme';

export const PortfolioScreen = ({ navigation }) => {

    const [tradeModalVisible, setTradeModalVisible] = useState(false);
    const [portfolioValue, setPortfolioValue] = useState();
    const [holdingsData, setHoldingsdata] = useState([]);
    const dispatch = useDispatch();
    const toast = useToast();
    const { bgStyle, textStyle, text } = useAppTheme();

    useFocusEffect(
        React.useCallback(() => {
            fetchDashboardData();
        }, [])
    );
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
                setHoldingsdata(response.data);
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

    const renderHolding = ({ item }) => (
        <View style={[styles.holdingItem, {shadowColor: text}]}>
            <View style={styles.holdingLeft}>
                <View style={[styles.creatorAvatar, {backgroundColor: text}]}>
                    <Text style={styles.avatarText}>{item.vendorName.charAt(1).toUpperCase()}</Text>
                </View>
                <View>
                    <View style={styles.creatorNameRow}>
                        <Text style={styles.creatorName}>{item.vendorName}</Text>
                        {item.verified && <Ionicons name="checkmark-circle" size={14} color={text} />}
                    </View>
                    <Text style={styles.holdingAmount}>{item.tokenAmount} tokens</Text>
                </View>
            </View>
            <View style={styles.holdingRight}>
                <Text style={styles.holdingValue}>{item.totalTokenAmount}</Text>
                {/* <Text style={styles.holdingChange}>{item.change}</Text> */}
                <View style={styles.holdingActions}>
                    <TouchableOpacity style={[styles.buyButton, {backgroundColor: text}]} onPress={() => navigation.navigate('CreatorProfile', { userId: item.vendorId })}>
                        <Text style={styles.buyButtonText}>Support</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* <View style={styles.header}>
                    <Text style={styles.headerTitle}>Portfolio</Text>
                    <Text style={styles.headerSubtitle}>Track the ones you fuel with your support</Text>
                </View> */}

                {/* Portfolio Summary */}
                <View style={styles.portfolioSummary}>
                    <View style={[styles.summaryCard, {backgroundColor: text}]}>
                        <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
                        <Text style={styles.summaryValue}>{portfolioValue}</Text>
                        {/* <Text style={styles.summaryChange}>+5.2% this month</Text> */}
                    </View>

                    {/* <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Supported</Text>
                            <Text style={styles.summaryValue}>$10,269.50</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Available</Text>
                            <Text style={styles.summaryValue}>$2,180.50</Text>
                        </View>
                    </View> */}
                </View>

                {/* Holdings */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, textStyle]}>My Holdings ({holdingsData.length})</Text>
                    <FlatList
                        data={holdingsData}
                        renderItem={renderHolding}
                        keyExtractor={(item) => item.tokenAddress.toString()}
                        scrollEnabled={false}
                    />
                </View>
            </ScrollView>
            <TradeModal
                visible={tradeModalVisible}
                onClose={() => setTradeModalVisible(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 20,
        paddingBottom: 40,
        marginBottom: Platform.OS == "ios" ? 50 : 0
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#666',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
        marginTop: -22
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },

    // Portfolio Summary
    portfolioSummary: {
        paddingHorizontal: 20,
        marginBottom: 24,
        marginTop: Platform.OS == "ios" ? 20 : 0
    },
    summaryCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#fff',
        opacity: 0.8,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    summaryChange: {
        fontSize: 14,
        color: '#10b981',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    summaryItem: {
        borderRadius: 12,
        padding: 16,
        flex: 1,
        marginHorizontal: 4,
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },

    // Holdings
    holdingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
        borderRadius: 12,
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    holdingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    creatorAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    creatorNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    creatorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
        marginRight: 4,
    },
    holdingAmount: {
        fontSize: 14,
        color: '#666',
    },
    holdingRight: {
        alignItems: 'flex-end',
    },
    holdingValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 2,
        width: '90%'
    },
    holdingChange: {
        fontSize: 14,
        color: '#10b981',
        marginBottom: 8,
    },
    holdingActions: {
        flexDirection: 'row',
    },
    buyButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        // marginRight: 6,
    },
    buyButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    }
});

export default PortfolioScreen;