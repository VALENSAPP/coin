/**
 * @format
 */

import 'react-native-get-random-values';
import '@walletconnect/react-native-compat';
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { Text } from 'react-native';
import { registerBackgroundHandler } from './src/services/NotificationService';

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
registerBackgroundHandler();   
AppRegistry.registerComponent(appName, () => App);
