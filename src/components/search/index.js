import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../../i18n';
 
export default function SearchScreen() {
  const { t } = useLanguage();
 
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('searchScreen.title')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18 }
});
