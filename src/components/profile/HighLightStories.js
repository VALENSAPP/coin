import { View, Text, FlatList, StyleSheet, TouchableOpacity, alert } from 'react-native';
import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TopHoldersModal from '../modals/TopHoldersModal';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../theme/useApptheme';

const HighlightStories = ({ userData }) => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const { textStyle, text } = useAppTheme();
  const handlePress = () => {

  }
  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.card, { shadowColor: text }]} onPress={() => { navigation.navigate('CreatorCoin') }}>
        <Text style={[styles.cardTitle, { color: text }]}>Score</Text>
        <Text style={styles.cardValue}>$1,666</Text>
        {/* <Ionicons name="chevron-forward" size={18} color="#000" style={styles.cardIcon} /> */}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.card, { shadowColor: text }]} activeOpacity={0.5}
        onPress={() => setModalVisible(true)}>
        <Text style={[styles.cardTitle, { color: text }]}>Top holders</Text>
        {/* <Text style={styles.cardValue}>NEW</Text> */}
        <Ionicons name="chevron-forward" size={18} color="#000" style={[textStyle]} />
      </TouchableOpacity>

      <TopHoldersModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

export default HighlightStories; 

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 18,
    marginTop: -10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#22c55e', // success green
    marginLeft: 8,
  },
});


