import { View, Text } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '../../theme/useApptheme';
const Following = () => {
  const { bgStyle, textStyle } = useAppTheme();
  return (
    <SafeAreaView style={[{height:'100%'}, bgStyle]}>
      <Text>vallowing</Text>
    </SafeAreaView>
  )
}

export default Following