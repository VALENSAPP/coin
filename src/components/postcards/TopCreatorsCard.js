import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const TopCreatorsCard = ({ rank, profileImage, name, username, amount, time }) => {
  return (
    <View style={styles.cardContainer}>
      {/* Rank */}
      <View style={styles.rankContainer}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>

      {/* Profile Image */}
      <Image source={{ uri: profileImage }} style={styles.profileImage} />

      {/* Name & Username */}
      <View style={styles.infoContainer}>
        <Text style={styles.nameText}>{name}</Text>
        <Text style={styles.usernameText}>{username}</Text>
      </View>

      {/* Amount & Time */}
      <View style={styles.rightContainer}>
        <View style={styles.amountContainer}>
          <Icon name="triangle" size={14} color="#17e243"  style={{ marginRight: 2 }} />
          <Text style={styles.amountText}>{amount}</Text>
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
    backgroundColor: '#f8f2fd',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    marginHorizontal:15,
  },
  rankContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  usernameText: {
    fontSize: 13,
    color: '#888',
  },
  rightContainer: {
    flexDirection: 'row',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountText: {
    fontSize: 14,
    color: '#17e243',
    fontWeight: '600',

  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    marginLeft:25
  },
});

export default TopCreatorsCard;
