// src/components/DrawerToggleButton.js
import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';

const DrawerToggleButton = ({ color = '#000', size = 28, style }) => {
  const dispatch = useDispatch();

  const handlePress = () => {
    // If using Redux Toolkit:
    // dispatch(openDrawer());
    
    // If using traditional Redux:
    dispatch({ type: 'OPEN_DRAWER' });
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.container, style]}
      activeOpacity={0.7}
    >
      <Ionicons name="menu" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DrawerToggleButton;