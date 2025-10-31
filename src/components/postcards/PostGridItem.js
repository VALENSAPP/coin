import React from 'react';
import { TouchableOpacity, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const ITEM_SIZE = width / 3; // 3 columns

const PostGridItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={{
        width: ITEM_SIZE,
        height: ITEM_SIZE,
      }}
      activeOpacity={0.8}
      onPress={() => onPress(item)}
    >
      <Image
        source={{ uri: item.image }}
        style={{
          width: '100%',
          height: '100%',
        }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
};

export default PostGridItem;
