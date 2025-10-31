import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const PostCard = ({ item, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <Text style={styles.user}>{item.user}</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Icon name="triangle" size={14} color="#17e243" />
            <Text style={styles.amount}>{item.amount}</Text>
          </View>
          <View style={styles.metricItem}>
            <Icon name="flame" size={14} color="#000" />
            <Text style={styles.flame}>{item.flame}</Text>
          </View>
          <View style={styles.metricItem}>
            <Icon name="people" size={14} color="#000" />
            <Text style={styles.people}>{item.people}</Text>
          </View>
          <Text style={styles.badge}>{item.badge}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
  },

});

export default PostCard;
