import { Platform, StyleSheet } from 'react-native';
 
export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor: '#f2f2f2',
        paddingHorizontal: 12,
        paddingVertical: 3,
        marginBottom: 16,
        borderWidth: 1.5,
        borderRadius: 24,
        borderColor: "#e6e6e6",
        marginTop: Platform.OS === 'android' ? 35 : 0
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#000',
        fontWeight: '500'
        // borderWidth:1
    },
    tabsContainer: {
        flexDirection: 'row',
        // marginBottom: 25,
        // alignItems: 'center',
    },
    tab: {
        flexDirection: 'row',
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f2f2f2',
        marginRight: 10,
        height: 35
    },
    activeTab: {
        backgroundColor: '#000',
        borderColor: '#000'
    },
    tabText: {
        fontSize: 14,
        color: '#000',
        fontWeight: 'bold'
    },
    activeTabText: {
        color: '#fff'
    },
    card: {
        flexDirection: 'row',
        marginBottom: 13,
        borderWidth: 1,
        borderColor: "#f3f3f3",
        padding: 11,
        borderRadius: 12
    },
    image: {
        width: 70,
        height: 70,
        borderRadius: 8,
        marginRight: 12,
 
    },
    cardContent: {
        flex: 1,
        // borderBottomWidth: 1,
        // borderBottomColor: '#eee',
        // paddingBottom: 8
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    title: {
        fontWeight: '600',
        fontSize: 16,
        color: '#000'
    },
    time: {
        fontSize: 12,
        color: '#999'
    },
    user: {
        fontSize: 14,
        color: '#777',
        marginVertical: 2
    },
    metricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4
    },
    amount: {
        color: '#17e243',
        marginRight: 12,
        fontSize: 14,
        fontWeight: 'bold'
    },
    flame: {
        color: '#000',
        marginRight: 12,
        fontSize: 14,
        fontWeight: 'bold'
    },
    people: {
        color: '#000',
        marginRight: 12,
        fontSize: 14,
        fontWeight: 'bold'
    },
    badge: {
        fontSize: 13
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        // marginRight: 12
    },
    toggleContainer: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 2,
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        marginRight: 10,
 
    },
    toggleButton: {
        paddingVertical: 5,
        paddingHorizontal: 5,
        borderRadius: 8,
        height: 30
    },
    toggleActive: {
        backgroundColor: '#f2f2f2',
    },
});