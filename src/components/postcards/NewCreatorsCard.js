import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

const NewCreatorsCard = ({ profileImage, name, username, time }) => {
    const { bgStyle, textStyle } = useAppTheme();

    return (
        <View style={[styles.cardContainer, bgStyle]}>
            {/* Profile Image */}
            <Image source={{ uri: profileImage }} style={styles.profileImage} />

            {/* Name, Unverified & Username */}
            <View style={styles.middleContainer}>
                <View style={styles.nameRow}>
                    <View style={{marginRight:10}}>
                        <Text style={styles.nameText} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={styles.usernameText}>{username}</Text>
                    </View>

                    <View style={styles.unverifiedBadge}>
                        <Text style={styles.unverifiedText}>Unverified</Text>
                    </View>
                </View>
            </View>

            {/* Right: NEW + Time */}
            <View style={styles.rightContainer}>
                <View style={styles.newBadge}>
                    <Text style={styles.newText}>NEW</Text>
                </View>
                <Text style={styles.timeText}>{time}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
        marginHorizontal: 15
    },
    profileImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    middleContainer: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nameText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginRight: 8,
        maxWidth: 100,
        marginRight: 15
    },
    unverifiedBadge: {
        backgroundColor: '#f2f2f2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    unverifiedText: {
        fontSize: 12,
        color: '#555',
    },
    usernameText: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    rightContainer: {
        flexDirection: 'row',

    },
    newBadge: {
        backgroundColor: '#f2f2f2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 4,
    },
    newText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#000',
    },
    timeText: {
        fontSize: 12,
        color: '#999',
        marginLeft: 25
    },
});

export default NewCreatorsCard;
