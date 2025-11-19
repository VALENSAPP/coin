import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Dimensions,
    ScrollView,
    Platform,
    PanResponder,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const GlobalLeftDrawer = () => {
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const isDrawerOpen = useSelector(state => state.drawer?.isOpen || false);

    const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;
    const { bgStyle, textStyle, bg, text } = useAppTheme();

    useEffect(() => {
        if (isDrawerOpen) {
            openDrawer();
        } else {
            closeDrawer();
        }
    }, [isDrawerOpen]);

    const openDrawer = () => {
        Animated.parallel([
            Animated.spring(drawerAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 9,
            }),
            Animated.timing(overlayAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeDrawer = () => {
        Animated.parallel([
            Animated.spring(drawerAnim, {
                toValue: -DRAWER_WIDTH,
                useNativeDriver: true,
                tension: 65,
                friction: 9,
            }),
            Animated.timing(overlayAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleClose = () => {
        dispatch({ type: 'CLOSE_DRAWER' });
    };

    const navigateTo = (screen, params = {}) => {
        handleClose();
        setTimeout(() => {
            navigation.navigate(screen, params);
        }, 300);
    };

    // 🧭 SWIPE DETECTION — Left-to-right gesture
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: (_, gestureState) => false, // only move matters
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only horizontal swipe, to the right, when drawer is closed
                return !isDrawerOpen && gestureState.dx > 10 && Math.abs(gestureState.dy) < 20;
            },
            onPanResponderMove: (_, gestureState) => {
                if (!isDrawerOpen && gestureState.dx > 0 && gestureState.dx < DRAWER_WIDTH) {
                    drawerAnim.setValue(gestureState.dx - DRAWER_WIDTH);
                    overlayAnim.setValue(gestureState.dx / DRAWER_WIDTH);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx > DRAWER_WIDTH * 0.3) {
                    dispatch({ type: 'OPEN_DRAWER' });
                } else {
                    closeDrawer();
                }
            },
        })
    ).current;

    const menuItems = [
        { icon: 'home', iconType: 'Ionicons', label: 'Dashboard', screen: 'Home', color: text },
        // { icon: 'wallet', iconType: 'Ionicons', label: 'Wallet', screen: 'wallet', color: '#e54ba0' },
        // {
        //     icon: 'chart-line',
        //     iconType: 'MaterialCommunityIcons',
        //     label: 'Portfolio',
        //     screen: 'wallet',
        //     params: { screen: 'Portfolio' },
        //     color: '#513189',
        // },
        // {
        //     icon: 'store',
        //     iconType: 'MaterialCommunityIcons',
        //     label: 'Market',
        //     screen: 'wallet',
        //     params: { screen: 'Market' },
        //     color: '#d946ef',
        // },
        // {
        //     icon: 'account-group',
        //     iconType: 'MaterialCommunityIcons',
        //     label: 'Creators',
        //     screen: 'wallet',
        //     params: { screen: 'Creators' },
        //     color: '#8b5cf6',
        // },
        // {
        //     icon: 'heart',
        //     iconType: 'Ionicons',
        //     label: 'Favorites',
        //     screen: 'HomeMain',
        //     params: { screen: 'Favourites' },
        //     color: '#ec4899',
        // },
        // {
        //     icon: 'notifications',
        //     iconType: 'Ionicons',
        //     label: 'Notifications',
        //     screen: 'HomeMain',
        //     params: { screen: 'HeartNotification' },
        //     color: '#f59e0b',
        // },
        // {
        //     icon: 'bookmark',
        //     iconType: 'Ionicons',
        //     label: 'Saved Posts',
        //     screen: 'ProfileMain',
        //     params: { screen: 'SavedPost' },
        //     color: '#10b981',
        // },
        // {
        //     icon: 'settings',
        //     iconType: 'Ionicons',
        //     label: 'Settings',
        //     screen: 'ProfileMain',
        //     params: { screen: 'Settings' },
        //     color: '#6366f1',
        // },
    ];

    const EDGE_WIDTH = 20;

    return (
        <>
            {/* Edge Swipe Area */}
            {!isDrawerOpen && (
                <Animated.View
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                    pointerEvents="box-none"  // allows touches to pass through
                    {...panResponder.panHandlers}
                />
            )}

            {/* Overlay */}
            <Animated.View
                style={[styles.overlay, { opacity: overlayAnim }]}
                pointerEvents={isDrawerOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={styles.overlayTouchable}
                    activeOpacity={1}
                    onPress={handleClose}
                />
            </Animated.View>

            {/* Drawer */}
            <Animated.View
                style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}
            >
                {/* Header */}
                <View style={[styles.header, {backgroundColor: text}]}>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Valens</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Menu Items */}
                <ScrollView
                    style={styles.menuContainer}
                    contentContainerStyle={styles.menuContentContainer}
                >
                    {menuItems.map((item, index) => {
                        const IconComponent = item.iconType === 'Ionicons' ? Ionicons : MaterialCommunityIcons;
                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.menuItem}
                                onPress={() => navigateTo(item.screen, item.params)}
                            >
                                {/* <View style={[styles.iconContainer, { backgroundColor: item.color + '33' }]}>
                                    <IconComponent name={item.icon} size={22} color={item.color} />
                                </View> */}
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2025 YourApp</Text>
                </View>
            </Animated.View>
        </>
    );

};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
    },
    overlayTouchable: { flex: 1 },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: DRAWER_WIDTH,
        backgroundColor: '#fff',
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        paddingTop: 35
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButton: { padding: 5 },
    menuContainer: { flex: 1 },
    menuContentContainer: { paddingVertical: 10 },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f0f0f0',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    divider: {
        height: 8,
        backgroundColor: '#f5f5f5',
        marginVertical: 10,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '600',
    },
});

export default GlobalLeftDrawer;