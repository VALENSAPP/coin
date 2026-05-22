import React, { useEffect, useState } from 'react';
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
import { hideLoader, showLoader } from '../../redux/actions/LoaderAction';
import { getTopCreators } from '../../services/tokens';
import { showToastMessage } from '../../components/displaytoastmessage';
import { useDispatch } from 'react-redux';
import { useToast } from 'react-native-toast-notifications';
import { useLanguage } from '../../i18n';

export const MarketScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [tradeModalVisible, setTradeModalVisible] = useState(false);
    const [marketCreators, setMarketCreators] = useState('');
    const { bgStyle, textStyle, text } = useAppTheme();
    const dispatch = useDispatch();
    const toast = useToast();
    const { t } = useLanguage();

    const fetchTopCreators = async () => {
        try {
            dispatch(showLoader());
            const response = await getTopCreators();
            if (response?.statusCode === 200) {
                console.log('response in fetch top creators--------------', response);

                const formattedCreators = response.data.map((creator, index) => ({
                    id: index + 1,
                    name: `@${creator.username || 'unknown'}`,
                    vendorId: creator.vendorId,
                    price: `$${Number(creator.purchaseTokenPrice).toFixed(4) || '0.0000'}`,
                    followers: Math.floor(Math.random() * 3000),
                }));

                setMarketCreators(formattedCreators.slice(0, 10));
            } else {
                showToastMessage(toast, 'danger', response.data.message || t('market.fetchError'));
            }
        } catch (error) {
            showToastMessage(
                toast,
                'danger',
                error?.response?.message ?? t('market.fetchError'),
            );
        } finally {
            dispatch(hideLoader());
        }
    };

    useEffect(() => {
        fetchTopCreators();
    }, []);

    const renderMarketCreator = ({ item }) => (
        <View style={[styles.marketCreatorItem, { shadowColor: text }]}>
            <View style={styles.creatorLeft}>
                <View style={[styles.creatorAvatar, { backgroundColor: text }]}>
                    <Text style={styles.avatarText}>{item.name.charAt(1).toUpperCase()}</Text>
                </View>
                <View>
                    <View style={styles.creatorNameRow}>
                        <Text style={styles.creatorName}>{item.name}</Text>
                        {item.verified && <Ionicons name="checkmark-circle" size={14} color={text} />}
                    </View>
                </View>
            </View>
            <View style={styles.marketActions}>
                <TouchableOpacity
                    style={[styles.buyButton, { backgroundColor: text }]}
                    onPress={() => navigation.navigate('CreatorProfile', { userId: item.vendorId })}
                >
                    <Text style={styles.buyButtonText}>{t('market.viewProfile')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, bgStyle]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Market Stats */}
                <View style={styles.marketStats}>
                    <View style={[styles.statCard, { shadowColor: text }]}>
                        <Text style={styles.statValue}>$45.2M</Text>
                        <Text style={styles.statLabel}>{t('market.marketCap')}</Text>
                        <Text style={styles.statChange}>+8.3% (24h)</Text>
                    </View>
                    <View style={[styles.statCard, { shadowColor: text }]}>
                        <Text style={styles.statValue}>$2.8M</Text>
                        <Text style={styles.statLabel}>{t('market.volume24h')}</Text>
                        <Text style={styles.statChange}>+12.5%</Text>
                    </View>
                    <View style={[styles.statCard, { shadowColor: text }]}>
                        <Text style={styles.statValue}>1,234</Text>
                        <Text style={styles.statLabel}>{t('market.activeSupporters')}</Text>
                        <Text style={styles.statChange}>{t('market.onlineNow')}</Text>
                    </View>
                </View>

                {/* Creators List */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, textStyle]}>{t('market.allCreators')}</Text>
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