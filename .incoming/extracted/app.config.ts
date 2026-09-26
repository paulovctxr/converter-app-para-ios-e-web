import './scripts/load-env.js';
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Summer Fit',
  slug: 'summer-fit',
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'summerfit',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: { supportsTablet: true, bundleIdentifier: 'com.summertreinos.app', infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: { package: 'com.summertreinos.app', adaptiveIcon: { backgroundColor: '#F4C400', foregroundImage: './assets/images/android-icon-foreground.png', backgroundImage: './assets/images/android-icon-background.png', monochromeImage: './assets/images/android-icon-monochrome.png' }, edgeToEdgeEnabled: true, predictiveBackGestureEnabled: false, permissions: ['POST_NOTIFICATIONS'] },
  web: { bundler: 'metro', output: 'static', favicon: './assets/images/favicon.png' },
  plugins: ['expo-router', ['expo-splash-screen', { image: './assets/images/splash-icon.png', imageWidth: 240, resizeMode: 'contain', backgroundColor: '#FFFDF7' }], ['expo-build-properties', { android: { buildArchs: ['armeabi-v7a', 'arm64-v8a'], minSdkVersion: 24 } }]],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
