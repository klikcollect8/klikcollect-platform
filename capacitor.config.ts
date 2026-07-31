import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.klikcollect.app',
  appName: 'KlikCollect',
  webDir: 'out',
  server: {
    // In production, set this to your deployed URL
    // For development, leave empty to use localhost
    url: process.env.CAPACITOR_SERVER_URL || '',
    cleartext: true, // Allow HTTP in development
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#1e3a8a',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000',
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    scheme: 'klikcollect',
  },
  // Note: Windows support requires Electron - see CAPACITOR_SETUP.md
};

export default config;

