
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f9b15f93845c45828e5d185285630eeb',
  appName: 'signal-scribe-alert-bell-67',
  webDir: 'dist',
  server: {
    url: 'https://f9b15f93-845c-4582-8e5d-185285630eeb.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#999999",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav",
    },
    BackgroundMode: {
      enabled: true,
      title: "Signal Tracker Running",
      text: "Monitoring binary options signals",
      silent: false,
      hidden: false,
      color: "488AFF",
      resume: true,
    },
    App: {
      handleLaunchUrl: true,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    permissions: [
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
    ]
  },
  ios: {
    scheme: "SignalTracker",
    backgroundColor: "#000000",
    contentInset: "automatic",
    scrollEnabled: true,
    preferences: {
      ScrollEnabled: true,
      'ios-plist': {
        UIBackgroundModes: [
          'background-audio',
          'background-fetch',
          'background-processing'
        ]
      }
    }
  }
};

export default config;
