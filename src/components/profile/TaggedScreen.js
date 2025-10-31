import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native'; 
import Ionicons from 'react-native-vector-icons/Ionicons';

const TaggedScreen = memo(() => {
  return (
    <View style={styles.container}>
      <Ionicons name="person-outline" size={80} color='#666' style={styles.icon}/>
      <Text style={styles.message}>
        Photos and videos show here where you were tagged.
      </Text>
    </View>
  );
});

TaggedScreen.displayName = 'TaggedScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f8f2fd', 
    marginTop: -30,
    paddingHorizontal: 20,
  },
  icon: {
    marginBottom: 25, 
  },
  message: {
    fontSize: 18,
    color: '#333', 
    textAlign: 'center', 
    lineHeight: 25,
    maxWidth: 280,
  },
});

export default TaggedScreen;
