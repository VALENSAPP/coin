import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const CustomButton = React.forwardRef(
  ({ title, onPress, disabled = false, style, textStyle, icon }, ref) => (
    <TouchableOpacity
      ref={ref}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
        {icon && icon}
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  )
);

export default CustomButton;

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#5a2d82',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#8bbce7',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
