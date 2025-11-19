import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '../../theme/useApptheme';

const CustomButton = React.forwardRef(
  (
    {
      title,
      onPress,
      disabled = false,
      loading = false,
      style,
      textStyle,
      icon,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const { bgStyle, bg, text } = useAppTheme();

    return (
      <TouchableOpacity
        ref={ref}
        activeOpacity={0.7}
        onPress={!isDisabled ? onPress : null}
        disabled={isDisabled}
        style={[
          styles.button,
          isDisabled && styles.buttonDisabled,
          style,
          {backgroundColor: text}
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.icon}>{icon}</View>}
            <Text style={[styles.text, textStyle]}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

export default CustomButton;

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#8bbce7',
    opacity: 0.7,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});