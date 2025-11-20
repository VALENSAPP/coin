import { View, Text } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '../../theme/useApptheme';
    
const Favourites = () => {
  const { bgStyle, textStyle } = useAppTheme();
  return (
    <SafeAreaView style={[{height:'100%'}, bgStyle]}>
      <Text>favourites</Text>
    </SafeAreaView>
  )
}

export default Favourites