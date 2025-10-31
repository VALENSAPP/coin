import React, { memo, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Dimensions, Image, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const itemSize = width / 3 - 2;

// Use local placeholder instead of external URLs for better performance
const createPlaceholderColor = (id) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  return colors[parseInt(id) % colors.length];
};

const ReelsScreen = memo(() => {
  const navigation = useNavigation();

  const renderItem = useCallback(({ item, index }) => (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.8}
      onPress={() => {
        // Handle reel tap - you can add navigation logic here
        console.log('Reel tapped:', item.id);
      }}
    >
      <View style={[styles.thumbnail, { backgroundColor: createPlaceholderColor(item.id) }]}>
        <Text style={styles.placeholderText}>🎬</Text>
      </View>
    </TouchableOpacity>
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: itemSize,
    offset: itemSize * index,
    index,
  }), []);

  return (
    <View style={styles.screen}>
      <FlatList
        data={Array.from({ length: 6 }, (_, i) => ({ id: (i + 1).toString() }))}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={6}
        windowSize={5}
        initialNumToRender={6}
        getItemLayout={getItemLayout}
        updateCellsBatchingPeriod={50}
        disableVirtualization={false}
      />
    </View>
  );
});

ReelsScreen.displayName = 'ReelsScreen';

export default ReelsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f2fd',
  },
  item: {
    width: itemSize,
    height: itemSize,
    margin: 1,
    backgroundColor: '#f8f2fd',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  placeholderText: {
    fontSize: 32,
    opacity: 0.7,
  },
}); 