// App entry: registers the Android widget handler, then starts Expo Router.
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/android/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

require('expo-router/entry');
