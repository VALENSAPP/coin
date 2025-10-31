import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LogoIcon } from '../../assets/icons';

const { height } = Dimensions.get('window');

const AuthHeader = ({ 
  title = 'VALENS', 
  subtitle, 
  showBackButton = true, 
  onBackPress, 
  headerHeight = height * 0.3,
  logoSize = 80,
  titleSize = 30,
  subtitleSize = 14
}) => {
  return (
    <View style={[styles.headerGradient, { height: headerHeight }]}>
      <View style={styles.headerContent}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
          >
            <Icon name="arrow-back" size={24} color="#5a2d82" />
          </TouchableOpacity>
        )}

        <View style={styles.logoContainer}>
          <View style={styles.logoBackground}>
            <LogoIcon height={logoSize} width={logoSize} />
          </View>
          <View style={styles.brandContainer}>
            <Text style={[styles.brandTitle, { fontSize: titleSize }]}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.tagline, { fontSize: subtitleSize }]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.decorativeElements} />
      </View>
    </View>
  );
};

const styles = {
  headerGradient: {
    backgroundColor: '#f8f2fd',
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backButton: {
    position: 'absolute',
    top: 30,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#5a2d82',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    zIndex: 2,
  },
  logoBackground: {
    borderRadius: 35,
    padding: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 0,
  },
  brandTitle: {
    fontWeight: '800',
    color: '#5a2d82',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontWeight: '500',
    color: '#5a2d82',
    opacity: 0.8,
    marginTop: 0,
    marginBottom:7,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  decorativeElements: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
};

export default AuthHeader;
