import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ScrollView,
    Image,
    Pressable,
} from 'react-native';
import RBSheet from 'react-native-raw-bottom-sheet';
import PagerView from 'react-native-pager-view';
import Ionicons from 'react-native-vector-icons/Ionicons';

const TradeModal = ({ visible, onClose }) => {
    const rbSheetRef = useRef(null);
    const pagerRef = useRef(null);
    const [page, setPage] = useState(0);
    const [buyAmount, setBuyAmount] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const sellBalance = 1900000;
    const isDisabled = !buyAmount || parseInt(buyAmount) === 0;
    const isSellDisabled = !sellAmount || parseInt(sellAmount) === 0;

    useEffect(() => {
        if (visible) {
            rbSheetRef.current?.open();
        } else {
            rbSheetRef.current?.close();
        }
    }, [visible]);

    const handleTabPress = (index) => {
        setPage(index);
        pagerRef.current?.setPage(index);
    };

    const formatNumber = (num) =>
        num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const handlePercentagePress = (percentage) => {
        const calculated = Math.floor((sellBalance * percentage) / 100);
        setSellAmount(calculated.toString());
    };

    return (
        <RBSheet
            ref={rbSheetRef}
            draggable
            height={500}
            onClose={onClose}
            customModalProps={{
                statusBarTranslucent: true,
            }}
            customStyles={{
                container: {
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    backgroundColor: '#f8f2fd',

                },
                draggableIcon: {
                    width: 80,
                    backgroundColor: '#ccc',
                },
            }}>
            <View style={styles.modalContainer}>
                <View style={styles.tabHeader}>
                    <TouchableOpacity onPress={() => handleTabPress(0)} style={styles.tab}>
                        <Text style={[styles.tabText, page === 0 && styles.activeTabText]}>
                            Follow
                        </Text>
                        {page === 0 && <View style={styles.activeIndicator} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleTabPress(1)} style={styles.tab}>
                        <Text style={[styles.tabText, page === 1 && styles.activeTabText]}>
                            Unfollow
                        </Text>
                        {page === 1 && <View style={styles.activeIndicator} />}
                    </TouchableOpacity>
                </View>

                <PagerView
                    style={styles.pagerView}
                    initialPage={0}
                    ref={pagerRef}
                    onPageSelected={(e) => setPage(e.nativeEvent.position)}
                >
                    {/* Buy Page */}
                    <View key="1" style={styles.page}>
                        <ScrollView contentContainerStyle={styles.content}>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.amountInput}
                                    value={buyAmount}
                                    onChangeText={setBuyAmount}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#999"
                                />
                                <View style={{ alignItems: 'center' }}>
                                    <View style={styles.tokenInfo}>
                                        <Ionicons name="sparkles-outline" size={18} />
                                        <Text style={styles.tokenLabel}>Sparks</Text>
                                        <Ionicons name="chevron-down" size={16} color="#000" />
                                    </View>
                                    <Text style={styles.balanceText}>Balance: ✨0</Text>
                                </View>
                            </View>

                            <View style={styles.quickButtonsRow}>
                                {['111', '1,111', '11,111', 'Max'].map((label, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.quickButton}
                                        disabled={isDisabled}
                                    >
                                        <Text
                                            style={[
                                                styles.quickButtonText,
                                                isDisabled && styles.disabledQuickButtonText,
                                            ]}
                                        >
                                            ✨ {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TextInput
                                style={styles.commentInput}
                                placeholder="Add a comment..."
                                placeholderTextColor="#999"
                            />

                            <TouchableOpacity
                                style={[styles.buyButton, isDisabled && styles.disabledBuyButton]}
                                disabled={isDisabled}
                            >
                                <Text
                                    style={[
                                        styles.buyButtonText,
                                        isDisabled && styles.disabledBuyButtonText,
                                    ]}
                                >
                                    Follow
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>

                    {/* Sell Page */}
                    <View key="2" style={styles.page}>
                        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.amountInput}
                                    value={sellAmount}
                                    onChangeText={setSellAmount}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#999"
                                />
                                <View style={styles.profileBalance}>
                                    <Image
                                        source={{
                                            uri: 'https://images.unsplash.com/photo-1752159140408-906317c0fa6c?q=80&w=435&auto=format&fit=crop',
                                        }}
                                        style={styles.avatar}
                                    />
                                    <Text style={styles.balanceText}>
                                        Balance: {formatNumber(sellBalance)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.quickButtonsRow}>
                                {[25, 50, 75, 100].map((percent) => (
                                    <TouchableOpacity
                                        key={percent}
                                        style={styles.quickButton}
                                        onPress={() => handlePercentagePress(percent)}
                                    >
                                        <Text style={styles.quickButtonText}>{percent}%</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.warningContainer}>
                                <Ionicons name="alert-circle-outline" size={18} color="#000" />
                                <Text style={styles.warningText}>Selling unavailable</Text>
                            </View>
                            <Text style={styles.warningDescription}>
                                No liquidity. This coin will become available to sell as this post
                                gets discovered and collected.
                            </Text>

                            <TextInput
                                style={styles.commentInput}
                                placeholder="Add a comment..."
                                placeholderTextColor="#999"
                            />

                            <TouchableOpacity
                                style={[styles.buyButton, isSellDisabled && styles.disabledBuyButton]}
                                disabled={isSellDisabled}
                            >
                                <Text
                                    style={[
                                        styles.buyButtonText,
                                        isSellDisabled && styles.disabledBuyButtonText,
                                    ]}
                                >
                                    Unfollow
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </PagerView>
            </View>
        </RBSheet>
    );
};

export default TradeModal;

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        paddingTop: 10,
            backgroundColor: '#f8f2fd',
    },
    tabHeader: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 15,
        paddingHorizontal: 20,
    },
    tab: {
        alignItems: 'center',
        flex: 1,
    },
    tabText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#888',
    },
    activeTabText: {
        color: '#000',
        fontWeight: 'bold',
    },
    activeIndicator: {
        marginTop: 15,
        height: 2,
        width: '100%',
        backgroundColor: '#000',
    },
    pagerView: {
        flex: 1,
    },
    page: {
        flex: 1,
        paddingHorizontal: 16,
    },
    content: {
        gap: 12,
        paddingBottom: 20,
    },
    inputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f2fd',
        borderRadius: 12,
    },
    amountInput: {
        fontSize: 32,
        fontWeight: '600',
        color: '#000',
        flex: 1,
    },
    tokenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tokenLabel: {
        fontWeight: '600',
        color: '#000',
    },
    balanceText: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
    },
    buyButton: {
        backgroundColor: '#000',
        borderRadius: 8,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    buyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    disabledBuyButton: {
        backgroundColor: '#e0e0e0',
    },
    disabledBuyButtonText: {
        color: '#aaa',
    },
    quickButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 5,
    },
    quickButton: {
        flex: 1,
        paddingVertical: 8,
        marginHorizontal: 2,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        backgroundColor: '#f8f2fd',
    },
    quickButtonText: {
        fontSize: 14,
        color: '#000',
    },
    disabledQuickButtonText: {
        color: '#aaa',
    },
    commentInput: {
        backgroundColor: '#f8f2fd',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 15,
        fontSize: 14,
        marginBottom: 5,
        color: '#000',
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    warningText: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
        color: '#000',
    },
    warningDescription: {
        textAlign: 'center',
        fontSize: 13,
        color: '#888',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    profileBalance: {
        alignItems: 'flex-end',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginBottom: 4,
    },
});