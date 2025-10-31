import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CommonHeader = ({
  title = 'Header Title',
  showBackButton = false,
  showRightIcon = false,
  rightIconName = 'more-vert',
  onBackPress = () => {},
  onRightPress = () => {},
  backgroundColor = '#000',
  textColor = '#FFFFFF',
  iconColor = '#FFFFFF',
  elevation = 4,
  leftComponent = null,
  rightComponent = null,
  centerComponent = null,
}) => {
  const renderLeftComponent = () => {
    if (leftComponent) {
      return leftComponent;
    }
    
    if (showBackButton) {
      return (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
      );
    }
    
    return <View style={styles.iconButton} />;
  };

  const renderCenterComponent = () => {
    if (centerComponent) {
      return centerComponent;
    }
    
    return (
      <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
        {title}
      </Text>
    );
  };

  const renderRightComponent = () => {
    if (rightComponent) {
      return rightComponent;
    }
    
    if (showRightIcon) {
      return (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onRightPress}
          activeOpacity={0.7}
        >
          <Icon name={rightIconName} size={24} color={iconColor} />
        </TouchableOpacity>
      );
    }
    
    return <View style={styles.iconButton} />;
  };

  return (
    <>
      <StatusBar
        backgroundColor={backgroundColor}
        barStyle="light-content"
        translucent={false}
      />
      <View style={[styles.container, { backgroundColor, elevation }]}>
        <View style={styles.header}>
          {renderLeftComponent()}
          <View style={styles.centerContainer}>
            {renderCenterComponent()}
          </View>
          {renderRightComponent()}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
    paddingTop: 30
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default CommonHeader;