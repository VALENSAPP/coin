import { Text } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppTheme } from '../../theme/useApptheme';
import { useLanguage } from '../../i18n';
const Following = () => {
  const { bgStyle } = useAppTheme();
  const { t } = useLanguage();
  return (
    <SafeAreaView style={[{height:'100%'}, bgStyle]}>
      <Text>{t('modalHome.following')}</Text>
    </SafeAreaView>
  )
}

export default Following