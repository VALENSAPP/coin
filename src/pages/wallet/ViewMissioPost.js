import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity, FlatList, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllMissionPost } from '../../services/wallet';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useFocusEffect } from '@react-navigation/native';

export default function ViewMissioPost({ navigation }) {
    const { bgStyle, text } = useAppTheme();
    const [isBusinessProfile, setIsBusinessProfile] = useState(false);
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterLoading, setFilterLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [error, setError] = useState(null);

    const getUserDetail = async () => {
        try {
            const profile = await AsyncStorage.getItem('userProfile');
            setIsBusinessProfile(profile !== null && profile !== 'user');
        } catch (err) {
            console.log('Error fetching user details:', err);
        }
    };

    const fetchMissions = useCallback(async (filter = 'all', isFilterChange = false) => {
        try {
            if (isFilterChange) setFilterLoading(true);
            else setLoading(true);
            setError(null);
            const params = filter !== 'all' ? { status: filter } : {};
            const response = await getAllMissionPost(params);

            if (response?.statusCode === 200) {
                const raw = response.data?.data || response.data || [];
                const data = Array.isArray(raw) ? raw.map(item => ({
                    id: item.id,
                    title: item.caption || item.text || item.type || 'Mission Post',
                    status: item.status
                        ? item.status
                        : (item.end_time && new Date(item.end_time) < new Date() ? 'Completed' : 'Active'),
                    period: item.start_time && item.end_time
                        ? `${new Date(item.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(item.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'No period set',
                    endTime: item.end_time,
                    startTime: item.start_time,
                    requests: item.commentCount ?? 0,
                    earned: item.tokenBalance ?? 0,
                    split: item.raiseAmount ? (item.raiseAmount * 0.8).toFixed(2) : '0.00',
                    valensFee: item.raiseAmount ? (item.raiseAmount * 0.05).toFixed(2) : '0.00',
                    stripeFee: item.raiseAmount ? (item.raiseAmount * 0.05).toFixed(2) : '0.00',
                    total: item.tokenBalance ?? 0,
                    type: item.type,
                    userImage: item.userImage,
                    userName: item.userName,
                    thumbnail: item.thumbnails?.[0] || item.images?.[0] || null,
                })) : [];
                setMissions(data);
            } else {
                setMissions([]);
            }
        } catch (err) {
            console.error('Error fetching missions:', err);
            setError('Failed to load missions');
            setMissions([]);
        } finally {
            setLoading(false);
            setFilterLoading(false);
        }
    }, []);

    const handleFilterChange = (tab) => {
        setStatusFilter(tab);
        fetchMissions(tab, true);
    };

    useEffect(() => {
        getUserDetail();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchMissions(statusFilter);
        }, [fetchMissions])
    );

    const totalEarned = useMemo(() =>
        missions.reduce((sum, m) => sum + (parseFloat(m.earned) || 0), 0).toFixed(2),
        [missions]
    );

    const activeCount = useMemo(() =>
        missions.filter(m => (m.status || '').toLowerCase() === 'active').length,
        [missions]
    );

    const getStatusStyle = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'active') return { bg: '#dcfce7', color: '#166534' };
        if (s === 'completed') return { bg: '#fef3c7', color: '#92400e' };
        return { bg: '#dbeafe', color: '#1e40af' };
    };

    const getTimeLabel = (item) => {
        const s = (item.status || '').toLowerCase();
        if (s === 'completed' && item.endTime) {
            return {
                icon: 'checkmark-circle',
                color: '#16a34a',
                bg: '#dcfce7',
                label: `Completed on ${new Date(item.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            };
        }
        if (s === 'active' && item.endTime) {
            const diff = new Date(item.endTime) - new Date();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            return {
                icon: 'time-outline',
                color: '#d97706',
                bg: '#fef3c7',
                label: `Ends in ${days}d ${hours}h`,
            };
        }
        if (s === 'upcoming' && item.startTime) {
            const diff = new Date(item.startTime) - new Date();
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            return {
                icon: 'time-outline',
                color: '#2563eb',
                bg: '#dbeafe',
                label: `Starts in ${days}d`,
            };
        }
        return null;
    };

    const walletScreenGradient = useMemo(
        () => isBusinessProfile ? ['#D3B683', '#f8f2fd'] : ['#513189', '#f8f2fd'],
        [isBusinessProfile]
    );

    if (loading) {
        return (
            <SafeAreaView style={[{ flex: 1 }, bgStyle]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={text} />
                    <Text style={[styles.loadingText, { color: text }]}>Loading missions...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={[{ flex: 1 }, bgStyle]}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                    <Text style={[styles.errorText, { color: text }]}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchMissions(statusFilter)}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[{ flex: 1, paddingBottom: 50 }, bgStyle]}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={styles.headerBox}>
                    <LinearGradient colors={walletScreenGradient} start={{ x: -1, y: -1 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={[styles.headerTitle, { color: text }]}>Total Earned</Text>
                                <Text style={[styles.headerAmount, { color: text }]}>${totalEarned}</Text>
                                <Text style={[styles.headerActive, { color: text }]}>Active: {activeCount}</Text>
                            </View>
                            <Ionicons name="ribbon" size={48} color={text} style={{ marginRight: 10 }} />
                        </View>
                    </LinearGradient>
                </View>

                {/* Section Title */}
                <Text style={[styles.sectionTitle, { color: text }]}>Campaigns</Text>

                {/* Status Filter Tabs */}
                <View style={styles.filterTabs}>
                    {['all', 'active', 'completed'].map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.filterTab, statusFilter === tab && styles.filterTabActive]}
                            onPress={() => handleFilterChange(tab)}
                        >
                            <Text style={[styles.filterTabText, statusFilter === tab && { color: text }]}>
                                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Inline Filter Loader */}
                {filterLoading && (
                    <View style={styles.filterLoaderContainer}>
                        <ActivityIndicator size="small" color={text} />
                        <Text style={[styles.filterLoaderText, { color: text }]}>Updating...</Text>
                    </View>
                )}

                {!filterLoading && missions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="ribbon-outline" size={48} color="#aaa" />
                        <Text style={[styles.emptyText, { color: text }]}>No missions found</Text>
                        <Text style={[styles.emptySubtext, { color: text }]}>
                            {statusFilter !== 'all' ? `No ${statusFilter} missions at the moment` : 'No missions available yet'}
                        </Text>
                    </View>
                ) : !filterLoading ? (
                    <FlatList
                        data={missions}
                        scrollEnabled={false}
                        showsVerticalScrollIndicator={false}
                        keyExtractor={(item) => item.id?.toString()}
                        contentContainerStyle={{ gap: 14 }}
                        renderItem={({ item: c }) => {
                            const statusStyle = getStatusStyle(c.status);
                            const timeLabel = getTimeLabel(c);
                            return (
                                <TouchableOpacity
                                    style={styles.campaignCard}
                                    activeOpacity={0.85}
                                    onPress={() => navigation?.navigate('MissionPostDetail', { mission: c })}
                                >
                                    {/* Top Row: Thumbnail + Info */}
                                    <View style={styles.cardTopRow}>
                                        {c.thumbnail ? (
                                            <Image
                                                source={{ uri: c.thumbnail }}
                                                style={styles.thumbnail}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                                                <Ionicons name="image-outline" size={28} color="#aaa" />
                                            </View>
                                        )}

                                        <View style={{ flex: 1 }}>
                                            <View style={styles.titleRow}>
                                                <Text style={styles.campaignTitle} numberOfLines={1}>{c.title}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                    <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{c.status}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.periodRow}>
                                                <Ionicons name="calendar-outline" size={13} color="#888" />
                                                <Text style={styles.campaignPeriod}> {c.period}</Text>
                                            </View>
                                            {timeLabel && (
                                                <View style={[styles.timeLabelRow, { backgroundColor: timeLabel.bg }]}>
                                                    <Ionicons name={timeLabel.icon} size={13} color={timeLabel.color} />
                                                    <Text style={[styles.timeLabelText, { color: timeLabel.color }]}> {timeLabel.label}</Text>
                                                </View>
                                            )}
                                        </View>

                                        <Ionicons name="chevron-forward" size={20} color="#bbb" style={{ marginLeft: 4 }} />
                                    </View>

                                    {/* Stats Row */}
                                    <View style={styles.statsRow}>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statLabel}>Total Requests</Text>
                                            <Text style={[styles.statValue, { color: text }]}>{c.requests}</Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <Text style={styles.statLabel}>Total Earned</Text>
                                            <Text style={[styles.statValueAccent, { color: text }]}>${c.earned}.00</Text>
                                        </View>
                                    </View>

                                    {/* Earnings Split */}
                                    <View style={styles.splitContainer}>
                                        <Text style={styles.splitLabel}>Earnings Split (per post total)</Text>
                                        <View style={styles.splitRow}>
                                            <View style={styles.splitItem}>
                                                <Text style={styles.splitItemLabel}>You (80%)</Text>
                                                <Text style={[styles.splitItemValue, { color: '#16a34a' }]}>${c.split}</Text>
                                            </View>
                                            <View style={styles.splitItem}>
                                                <Text style={styles.splitItemLabel}>Platform Fee (5%)</Text>
                                                <Text style={[styles.splitItemValue, { color: text }]}>${c.valensFee}</Text>
                                            </View>
                                            <View style={styles.splitItem}>
                                                <Text style={styles.splitItemLabel}>Total</Text>
                                                <Text style={[styles.splitItemValue, { color: text }]}>${c.total}.00</Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    headerBox: { marginBottom: 16 },
    headerGradient: { borderRadius: 18, padding: 20, marginBottom: 10 },
    headerTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    headerAmount: { fontSize: 32, fontWeight: 'bold' },
    headerActive: { fontSize: 14, marginTop: 2, opacity: 0.8 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    filterTabs: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 4,
        marginBottom: 16,
    },
    filterTab: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
    filterTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    filterTabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    filterLoaderContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    filterLoaderText: {
        fontSize: 13,
        opacity: 0.6,
    },
    campaignCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    thumbnail: { width: 72, height: 72, borderRadius: 12, marginRight: 12 },
    thumbnailPlaceholder: { backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
    campaignTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e1b4b', flex: 1 },
    periodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    campaignPeriod: { fontSize: 12, color: '#64748b' },
    timeLabelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    timeLabelText: { fontSize: 12, fontWeight: '600' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
        marginBottom: 10,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
    statLabel: { fontSize: 11, color: '#64748b', marginBottom: 2 },
    statValue: { fontSize: 15, fontWeight: 'bold' },
    statValueAccent: { fontSize: 15, fontWeight: 'bold' },
    splitContainer: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10 },
    splitLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 8 },
    splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
    splitItem: { alignItems: 'center' },
    splitItemLabel: { fontSize: 10, color: '#64748b', marginBottom: 2, textAlign: 'center' },
    splitItemValue: { fontSize: 13, fontWeight: '700' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    loadingText: { marginTop: 12, fontSize: 16 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    errorText: { marginTop: 12, fontSize: 16, textAlign: 'center', marginBottom: 16 },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3b82f6', borderRadius: 8 },
    retryText: { color: '#fff', fontWeight: '600' },
    emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 4 },
    emptySubtext: { fontSize: 14, opacity: 0.7 },
});