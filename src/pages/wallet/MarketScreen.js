import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    TextInput,
    Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TradeModal from '../../components/modals/TradeModal';
import { useAppTheme } from '../../theme/useApptheme';

export const MarketScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [tradeModalVisible, setTradeModalVisible] = useState(false);
    const { bgStyle, textStyle, text } = useAppTheme();

    const marketCreators = [
        { id: 1, name: '@alpha', price: '$0.91', change: '+12.4%', marketCap: '$2.1M', volume: '$124.5K', holders: 2341, verified: true },
        { id: 2, name: '@carol', price: '$0.77', change: '+9.8%', marketCap: '$1.8M', volume: '$98.2K', holders: 1923, verified: true },
        { id: 3, name: '@lyra', price: '$0.72', change: '+7.1%', marketCap: '$1.5M', volume: '$87.3K', holders: 1654, verified: false },
        { id: 4, name: '@jinx', price: '$0.69', change: '+6.3%', marketCap: '$1.2M', volume: '$76.8K', holders: 1432, verified: true },
    ];

    const renderMarketCreator = ({ item }) => (
        <View style={[styles.marketCreatorItem, {shadowColor: text}]}>
            <View style={styles.creatorLeft}>
                <View style={[styles.creatorAvatar, {backgroundColor: text}]}>
                    <Text style={styles.avatarText}>{item.name.charAt(1).toUpperCase()}</Text>
                </View>
                <View>
                    <View style={styles.creatorNameRow}>
                        <Text style={styles.creatorName}>{item.name}</Text>
                        {item.verified && <Ionicons name="checkmark-circle" size={14} color={text} />}
                    </View>
                    <Text style={[styles.marketCapText, textStyle]}>MCap: {item.marketCap}</Text>
                    <Text style={styles.holdersText}>{item.holders} holders</Text>
                </View>
            </View>
            <View style={styles.creatorRight}>
                <Text style={[styles.creatorPrice, textStyle]}>{item.price}</Text>
                <Text style={styles.creatorChange}>{item.change}</Text>
                <View style={styles.marketActions}>
                    <TouchableOpacity style={[styles.buyButton, {backgroundColor: text}]} onPress={() => setTradeModalVisible(true)}>
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
                    <Text style={styles.headerTitle}>Market</Text>
                    <Text style={styles.headerSubtitle}>Discover and support creator coins</Text>
                </View> */}

                {/* Market Stats */}
                <View style={styles.marketStats}>
                    <View style={[styles.statCard, {shadowColor: text}]}>
                        <Text style={styles.statValue}>$45.2M</Text>
                        <Text style={styles.statLabel}>Market Cap</Text>
                        <Text style={styles.statChange}>+8.3% (24h)</Text>
                    </View>
                    <View style={[styles.statCard, {shadowColor: text}]}>
                        <Text style={styles.statValue}>$2.8M</Text>
                        <Text style={styles.statLabel}>Volume (24h)</Text>
                        <Text style={styles.statChange}>+12.5%</Text>
                    </View>
                    <View style={[styles.statCard, {shadowColor: text}]}>
                        <Text style={styles.statValue}>1,234</Text>
                        <Text style={styles.statLabel}>Active Supporters</Text>
                        <Text style={styles.statChange}>Online now</Text>
                    </View>
                </View>

                {/* Search */}
                <View style={[styles.searchContainer, {shadowColor: text}]}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search creators..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#666"
                    />
                </View>

                {/* Creators List */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, textStyle]}>All Creators</Text>
                    <Text style={styles.sectionSubtitle}>Follow = Buy | Unfollow = Sell easily</Text>
                    <FlatList
                        data={marketCreators}
                        renderItem={renderMarketCreator}
                        keyExtractor={(item) => item.id.toString()}
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
        paddingBottom: 30,
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
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },

    // Market Stats
    marketStats: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        marginTop: Platform.OS == "ios" ? 20 : 0
    },
    statCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flex: 1,
        marginHorizontal: 4,
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    statChange: {
        fontSize: 12,
        color: '#10b981',
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 20,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: '#111',
    },

    // Market Creator Item
    marketCreatorItem: {
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
    creatorLeft: {
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
    marketCapText: {
        fontSize: 12,
        fontWeight: '600',
    },
    holdersText: {
        fontSize: 12,
        color: '#666',
    },
    creatorRight: {
        alignItems: 'flex-end',
    },
    creatorPrice: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    creatorChange: {
        fontSize: 14,
        color: '#10b981',
        textAlign: 'right',
    },
    marketActions: {
        flexDirection: 'row',
        marginTop: 8,
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
    },
});

export default MarketScreen;