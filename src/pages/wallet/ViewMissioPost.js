import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity, FlatList, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllMissionPost } from '../../services/wallet';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../theme/useApptheme';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../../i18n';

export default function ViewMissioPost({ navigation, route }) {
    const { isBusinessProfile } = route.params || {};
    const { bgStyle, text } = useAppTheme();
    const { t } = useLanguage();

    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterLoading, setFilterLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [error, setError] = useState(null);

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
                    status: item.end_time && new Date(item.end_time) < new Date()
                        ? 'Completed'
                        : item.start_time && new Date(item.start_time) > new Date()
                            ? 'Upcoming'
                            : 'Active',
                    period: item.start_time && item.end_time
                        ? `${new Date(item.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(item.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : t('viewMissionPost.noPeriodSet'),
                    endTime: item.end_time,
                    startTime: item.start_time,
                    requests: item.commentCount ?? 0,
                    earned: item.earning?.total ?? 0,
                    split: item.earning?.total ? (item.earning.total * 0.8).toFixed(2) : '0.00',
                    valensFee: item.earning?.platformFees ?? '0.00',
                    stripeFee: item.earning?.total ? (item.earning.total * 0.05).toFixed(2) : '0.00',
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
            setError(t('viewMissionPost.failedToLoad'));
            setMissions([]);
        } finally {
            setLoading(false);
            setFilterLoading(false);
        }
    }, [t]);

    const handleFilterChange = (tab) => {
        setStatusFilter(tab);
        fetchMissions(tab, true);
    };

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
                label: t('viewMissionPost.completedOn', {
                    date: new Date(item.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                }),
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
                label: t('viewMissionPost.endsIn', { days, hours }),
            };
        }
        if (s === 'upcoming' && item.startTime) {
            const diff = new Date(item.startTime) - new Date();
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            return {
                icon: 'time-outline',
                color: '#2563eb',
                bg: '#dbeafe',
                label: t('viewMissionPost.startsIn', { days }),
            };
        }
        return null;
    };

    const walletScreenGradient = useMemo(
        () => isBusinessProfile ? ['#D3B683', '#f8f2fd'] : ['#513189', '#f8f2fd'],
        [isBusinessProfile]
    );

    const filterTabs = [
        { key: 'all',       label: t('viewMissionPost.filterAll') },
        { key: 'active',    label: t('viewMissionPost.filterActive') },
        { key: 'completed', label: t('viewMissionPost.filterCompleted') },
    ];

    if (loading) {
        return (
            <SafeAreaView style={[{ flex: 1 }, bgStyle]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={text} />
                    <Text style={[styles.loadingText, { color: text }]}>
                        {t('viewMissionPost.loadingMissions')}
                    </Text>
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
                        <Text style={styles.retryText}>{t('viewMissionPost.retry')}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[{ flex: 1 }, bgStyle]}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={styles.headerBox}>
                    <LinearGradient
                        colors={walletScreenGradient}
                        start={{ x: -1, y: -1 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={[styles.headerTitle, { color: text }]}>
                                    {t('viewMissionPost.totalEarned')}
                                </Text>
                                <Text style={[styles.headerAmount, { color: text }]}>${totalEarned}</Text>
                                <Text style={[styles.headerActive, { color: text }]}>
                                    {t('viewMissionPost.active')}: {activeCount}
                                </Text>
                            </View>
                            <Ionicons name="ribbon" size={48} color={text} style={{ marginRight: 10 }} />
                        </View>
                    </LinearGradient>
                </View>

                {/* Section Title */}
                <Text style={[styles.sectionTitle, { color: text }]}>
                    {t('viewMissionPost.campaigns')}
                </Text>

                {/* Status Filter Tabs */}
                <View style={styles.filterTabs}>
                    {filterTabs.map(({ key, label }) => (
                        <TouchableOpacity
                            key={key}
                            style={[styles.filterTab, statusFilter === key && styles.filterTabActive]}
                            onPress={() => handleFilterChange(key)}
                        >
                            <Text style={[styles.filterTabText, statusFilter === key && { color: text }]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Inline Filter Loader */}
                {filterLoading && (
                    <View style={styles.filterLoaderContainer}>
                        <ActivityIndicator size="small" color={text} />
                        <Text style={[styles.filterLoaderText, { color: text }]}>
                            {t('viewMissionPost.updating')}
                        </Text>
                    </View>
                )}

                {!filterLoading && missions.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="ribbon-outline" size={48} color="#aaa" />
                        <Text style={[styles.emptyText, { color: text }]}>
                            {t('viewMissionPost.noMissionsFound')}
                        </Text>
                        <Text style={[styles.emptySubtext, { color: text }]}>
                            {statusFilter !== 'all'
                                ? t('viewMissionPost.noMissionsFilteredSub', { status: statusFilter })
                                : t('viewMissionPost.noMissionsDefaultSub')}
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
                                   /* onPress={() => navigation?.navigate('MissionPostDetail', { mission: c })}*/
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
                                                <Text style={styles.campaignTitle} numberOfLines={1}>
                                                    {c.title?.charAt(0).toUpperCase() + c.title?.slice(1)}
                                                </Text>
                                                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                    <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                                                        {c.status}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.periodRow}>
                                                <Ionicons name="calendar-outline" size={13} color="#888" />
                                                <Text style={styles.campaignPeriod}> {c.period}</Text>
                                            </View>
                                            {timeLabel && (
                                                <View style={[styles.timeLabelRow, { backgroundColor: timeLabel.bg }]}>
                                                    <Ionicons name={timeLabel.icon} size={13} color={timeLabel.color} />
                                                    <Text style={[styles.timeLabelText, { color: timeLabel.color }]}>
                                                        {' '}{timeLabel.label}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Stats Row */}
                                    <View style={styles.statsRow}>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statLabel}>
                                                {t('viewMissionPost.totalRequests')}
                                            </Text>
                                            <Text style={[styles.statValue, { color: text }]}>{c.requests}</Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <Text style={styles.statLabel}>
                                                {t('viewMissionPost.totalEarnedLabel')}
                                            </Text>
                                            <Text style={[styles.statValueAccent, { color: text }]}>${c.earned}.00</Text>
                                        </View>
                                    </View>

                                    {/* Earnings Split */}
                                    <View style={styles.splitContainer}>
                                        <Text style={styles.splitLabel}>
                                            {t('viewMissionPost.earningsSplitLabel')}
                                        </Text>
                                        <View style={styles.splitRow}>
                                            <View style={styles.splitItem}>
                                                <Text style={styles.splitItemLabel}>
                                                    {t('viewMissionPost.youPercent')}
                                                </Text>
                                                <Text style={[styles.splitItemValue, { color: '#16a34a' }]}>${c.split}</Text>
                                            </View>
                                            <View style={styles.splitItem}>
                                                <Text style={styles.splitItemLabel}>
                                                    {t('viewMissionPost.platformFee')}
                                                </Text>
                                                <Text style={[styles.splitItemValue, { color: text }]}>${c.valensFee}</Text>
                                            </View>
                                            {/* <View style={styles.splitItem}>
                                                <Text style={styles.splitItemLabel}>
                                                    {t('viewMissionPost.total')}
                                                </Text>
                                                <Text style={[styles.splitItemValue, { color: text }]}>${c.total}.00</Text>
                                            </View> */}
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
    container: { padding: 16, paddingBottom: 50 },
    headerBox: { marginBottom: 16,flex: 1 },
    headerGradient: { borderRadius: 18, paddingTop: 20, marginBottom: 10,  minHeight: 150, },
    headerTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 ,paddingLeft:15},
    headerAmount: { fontSize: 32, fontWeight: 'bold' ,paddingLeft:15},
    headerActive: { fontSize: 14, marginTop: 2, opacity: 0.8 ,paddingLeft:15},
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 ,paddingLeft:15},
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