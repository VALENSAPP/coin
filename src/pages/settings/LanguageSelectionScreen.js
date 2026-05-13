import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useLanguage } from '../../i18n';
import { useAppTheme } from '../../theme/useApptheme';

const LanguageSelectionScreen = ({ navigation }) => {
  const { t, currentLanguage, languageNames, languages, changeLanguage } = useLanguage();
  const { bgStyle, textStyle, text } = useAppTheme();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLangSelect = (lang) => {
    changeLanguage(lang);
    setShowDropdown(false);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, bgStyle]}>
      <Text style={[styles.title, textStyle]}>{t('login.selectLanguage')}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setShowDropdown(!showDropdown)}
        activeOpacity={0.7}
      >
        <Ionicons name="language" size={22} color={text} style={{ marginRight: 8 }} />
        <Text style={styles.selectedText}>{languageNames[currentLanguage] || 'English'}</Text>
        <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={22} color="#6B7280" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
      {showDropdown && (
        <ScrollView style={styles.dropdownList}>
          {languages.map(lang => (
            <TouchableOpacity
              key={lang}
              style={styles.dropdownItem}
              onPress={() => handleLangSelect(lang)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownItemText}>{languageNames[lang]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    marginBottom: 8,
  },
  selectedText: {
    fontSize: 16,
    flex: 1,
    color: '#111',
  },
  dropdownList: {
    marginTop: -6,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#111',
  },
});

export default LanguageSelectionScreen;
