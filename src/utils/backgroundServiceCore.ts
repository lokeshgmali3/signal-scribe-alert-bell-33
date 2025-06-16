import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Signal } from '@/types/signal';
import { loadAntidelayFromStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { BackgroundMonitoringManager } from './backgroundMonitoringManager';
import { AndroidForegroundService } from './androidForegroundService';
import { AndroidAlarmManager } from './androidAlarmManager';
import { AndroidBatteryManager } from './androidBatteryManager';
import { nativeAndroidManager } from './nativeAndroidManager';

const AUDIO_ONLY_MODE_KEY = 'audioOnlyMode';

export class BackgroundServiceCore {
  private instanceId: string;
  private isAppActive = true;
  private appStateListenerInitialized = false;
  private listenerCleanupFunctions: (() => void)[] = [];
  
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private monitoringManager: BackgroundMonitoringManager;

  private audioOnlyMode: boolean = false;

  constructor() {
    this.instanceId = globalBackgroundManager.generateInstanceId();
    this.audioOnlyMode = localStorage.getItem(AUDIO_ONLY_MODE_KEY) === 'true';
    console.log('🚀 Background service instance created with ID:', this.instanceId);
    
    this.notificationManager = new BackgroundNotificationManager();
    this.audioManager = new BackgroundAudioManager();
    this.monitoringManager = new BackgroundMonitoringManager(
      this.instanceId,
      this.notificationManager,
      this.audioManager
    );
    this.monitoringManager.setAudioOnlyMode(this.audioOnlyMode);
  }

  setAudioOnlyMode(mode: boolean) {
    this.audioOnlyMode = mode;
    localStorage.setItem(AUDIO_ONLY_MODE_KEY, mode ? "true" : "false");
    this.monitoringManager.setAudioOnlyMode(mode);
    console.log('Audio Only Mode set to:', mode);
  }
  getAudioOnlyMode() {
    return this.audioOnlyMode;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing background service instance:', this.instanceId);
      
      if (nativeAndroidManager.isAndroidNative()) {
        console.log('🤖 Native Android detected, using native features');
        
        await nativeAndroidManager.requestBatteryOptimization();
        await nativeAndroidManager.startForegroundService();
        
        const permissions = await nativeAndroidManager.checkNativePermissions();
        if (permissions) {
          console.log('🤖 Native permissions status:', permissions);
        }
      } else {
        console.log('🌐 Web platform detected, using web features');
        
        if (!this.audioOnlyMode) {
          await this.notificationManager.requestPermissions();
        }

        if (!this.appStateListenerInitialized) {
          await this.setupAppStateListeners();
          this.appStateListenerInitialized = true;
        }
        
        if (this.isAndroidPlatform()) {
          await this.startForegroundServiceNotification();
          await this.requestBatteryOptimizationBypass();
        }
      }

      this.monitoringManager.setAudioOnlyMode(this.audioOnlyMode);
      this.monitoringManager.startBackgroundMonitoring();
      
      console.log('🚀 Background service initialized successfully');
    } catch (error) {
      console.error('🚀 Failed to initialize background service:', error);
    }
  }

  // Audio methods
  setCustomRingtone(ringtone: string | null) {
    this.audioManager.setCustomRingtone(ringtone);
  }

  async cacheCustomAudio(base64: string, mimeType: string) {
    await this.audioManager.cacheCustomAudio(base64, mimeType);
  }

  clearCustomAudio() {
    this.audioManager.clearCustomAudio();
  }

  async playBackgroundAudio(signal?: Signal) {
    // Try native Android first
    if (nativeAndroidManager.isAndroidNative()) {
      const audioInfo = this.audioManager.getAudioInfo();
      const customRingtone = audioInfo.hasCustomRingtone ? 'custom' : undefined;
      const nativeSuccess = await nativeAndroidManager.playNativeAudio(customRingtone);
      if (nativeSuccess) {
        console.log('🤖 Using native Android audio playback');
        return;
      }
    }
    
    // Fallback to web-based audio
    await this.audioManager.playBackgroundAudio(signal);
  }

  // Notification methods
  async scheduleAllSignals(signals: Signal[]) {
    const antidelaySeconds = loadAntidelayFromStorage();
    
    // Try native Android first
    if (nativeAndroidManager.isAndroidNative()) {
      const nativeSuccess = await nativeAndroidManager.scheduleNativeAlarms(signals, antidelaySeconds);
      if (nativeSuccess) {
        console.log('🤖 Using native Android alarms');
        return;
      }
    }
    
    // Fallback to web-based notifications
    await this.notificationManager.scheduleAllSignals(signals, antidelaySeconds);

    // Android: schedule alarms natively if on device (legacy web approach)
    if (this.isAndroidPlatform()) {
      await AndroidAlarmManager.scheduleAlarms(signals, antidelaySeconds);
      await this.startForegroundServiceNotification();
    }
  }

  async cancelAllScheduledNotifications() {
    // Try native Android first
    if (nativeAndroidManager.isAndroidNative()) {
      const nativeSuccess = await nativeAndroidManager.cancelNativeAlarms();
      if (nativeSuccess) {
        await nativeAndroidManager.stopForegroundService();
        console.log('🤖 Using native Android cancellation');
        return;
      }
    }
    
    // Fallback to web-based cancellation
    await this.notificationManager.cancelAllScheduledNotifications();
    if (this.isAndroidPlatform()) {
      await AndroidAlarmManager.cancelAllAlarms();
      await this.stopForegroundServiceNotification();
    }
  }

  private async setupAppStateListeners() {
    console.log('🚀 Setting up app state listeners for instance:', this.instanceId);
    
    // Clean up any existing listeners first
    this.cleanupListeners();
    
    try {
      // Handle transitions but don't stop background monitoring when foregrounded!
      const appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        console.log('🚀 App state changed. Active:', isActive, 'Instance:', this.instanceId);
        this.isAppActive = isActive;

        // PERSISTENT: Do NOT stop monitoring when app is foregrounded
        // Only one manager is ever running due to global lock

        // Buffer any signals if in-app transitions cause drift (future improvement: see recovery mechanism)
      });

      const notificationListener = await LocalNotifications.addListener('localNotificationActionPerformed', 
        async (notification) => {
          console.log('🚀 Notification action performed:', notification);
          await this.notificationManager.triggerHapticFeedback();
        }
      );

      this.listenerCleanupFunctions.push(
        () => appStateListener.remove(),
        () => notificationListener.remove()
      );

      globalBackgroundManager.addListener();
      globalBackgroundManager.addListener(); // One for each listener
    } catch (error) {
      console.error('🚀 Error setting up app state listeners:', error);
    }
  }

  private cleanupListeners() {
    console.log('🚀 Cleaning up existing listeners for instance:', this.instanceId);
    this.listenerCleanupFunctions.forEach(cleanup => cleanup());
    this.listenerCleanupFunctions = [];
  }

  async cleanup() {
    try {
      this.monitoringManager.cleanup();
      await this.notificationManager.cancelAllScheduledNotifications();
      this.audioManager.clearCustomAudio();
      this.cleanupListeners();
      
      globalBackgroundManager.removeListener();
      globalBackgroundManager.removeListener();
      
      console.log('🚀 Background service cleaned up for instance:', this.instanceId);
    } catch (error) {
      console.error('🚀 Error cleaning up background service:', error);
    }
  }

  /**
   * Attempt to programmatically request the user to disable battery optimization
   * for this app, so background work is less restricted. Needs Android plugin or intent.
   */
  async requestBatteryOptimizationBypass() {
    // Android native implementation
    if (this.isAndroidPlatform()) {
      await AndroidBatteryManager.requestBatteryOptimizationBypass();
    }
  }

  /**
   * Start a persistent foreground notification to keep the app alive in the background
   * (required for reliable signal processing while backgrounded/locked).
   */
  async startForegroundServiceNotification() {
    if (this.isAndroidPlatform()) {
      await AndroidForegroundService.getInstance().start();
    }
  }
  async stopForegroundServiceNotification() {
    if (this.isAndroidPlatform()) {
      await AndroidForegroundService.getInstance().stop();
    }
  }

  /**
   * Monitor status and diagnostics for debug view.
   */
  debugBackgroundStatus() {
    const status = {
      instanceId: this.instanceId,
      appActive: this.isAppActive,
      audio: this.audioManager.getAudioInfo(),
      notifIDs: this.notificationManager.getNotificationIds(),
      bgMonitorActive: this.monitoringManager.isActive(),
      globalStatus: globalBackgroundManager.getStatus()
    };
    console.log('[DEBUG STATUS] Background service:', status);
    (window as any).bgServiceDebug = status;
    return status;
  }

  getStatus() {
    return {
      instanceId: this.instanceId,
      appActive: this.isAppActive,
      audio: this.audioManager.getAudioInfo(),
      notifIDs: this.notificationManager.getNotificationIds(),
      bgMonitorActive: this.monitoringManager.isActive(),
      globalStatus: globalBackgroundManager.getStatus()
    };
  }

  isAndroidPlatform() {
    return /android/i.test(navigator.userAgent);
  }
}
