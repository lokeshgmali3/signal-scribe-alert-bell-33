import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Signal } from '@/types/signal';
import { loadAntidelayFromStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { BackgroundMonitoringManager } from './backgroundMonitoringManager';

export class BackgroundServiceCore {
  private instanceId: string;
  private isAppActive = true;
  private appStateListenerInitialized = false;
  private listenerCleanupFunctions: (() => void)[] = [];
  
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private monitoringManager: BackgroundMonitoringManager;

  constructor() {
    this.instanceId = globalBackgroundManager.generateInstanceId();
    console.log('🚀 Background service instance created with ID:', this.instanceId);
    
    this.notificationManager = new BackgroundNotificationManager();
    this.audioManager = new BackgroundAudioManager();
    this.monitoringManager = new BackgroundMonitoringManager(
      this.instanceId,
      this.notificationManager,
      this.audioManager
    );
  }

  async initialize() {
    try {
      console.log('🚀 Initializing background service instance:', this.instanceId);
      await this.notificationManager.requestPermissions();
      
      if (!this.appStateListenerInitialized) {
        await this.setupAppStateListeners();
        this.appStateListenerInitialized = true;
      }
      
      // Android-specific: Optionally start background reliability enhancements
      if (this.isAndroidPlatform()) {
        this.requestBatteryOptimizationBypass();
        this.startForegroundServiceNotification();
      }

      // Start background monitoring manager on init
      this.monitoringManager.startBackgroundMonitoring();

      // Output debug info
      this.debugBackgroundStatus();
      
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
    await this.audioManager.playBackgroundAudio(signal);
  }

  // Notification methods
  async scheduleAllSignals(signals: Signal[]) {
    const antidelaySeconds = loadAntidelayFromStorage();
    await this.notificationManager.scheduleAllSignals(signals, antidelaySeconds);
  }

  async cancelAllScheduledNotifications() {
    await this.notificationManager.cancelAllScheduledNotifications();
  }

  private async setupAppStateListeners() {
    console.log('🚀 Setting up app state listeners for instance:', this.instanceId);
    
    // Clean up any existing listeners first
    this.cleanupListeners();
    
    try {
      const appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        console.log('🚀 App state changed. Active:', isActive, 'Instance:', this.instanceId);
        this.isAppActive = isActive;
        
        if (!isActive) {
          console.log('🚀 App moved to background - attempting to start monitoring');
          this.monitoringManager.startBackgroundMonitoring();
        } else {
          console.log('🚀 App came to foreground - stopping monitoring');
          this.monitoringManager.stopBackgroundMonitoring();
        }
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
      
      // Remove listeners from global count
      globalBackgroundManager.removeListener();
      globalBackgroundManager.removeListener();
      
      console.log('🚀 Background service cleaned up for instance:', this.instanceId);
    } catch (error) {
      console.error('🚀 Error cleaning up background service:', error);
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
      // Extra debugging possible (add more fields as needed)
      globalStatus: globalBackgroundManager.getStatus()
    };
    console.log('[DEBUG STATUS] Background service:', status);
    // For testing: Could expose as window.bgServiceDebug = status;
    (window as any).bgServiceDebug = status;
    return status;
  }

  getStatus() {
    // Use debugBackgroundStatus as the status getter
    return this.debugBackgroundStatus();
  }

  isAndroidPlatform() {
    return /android/i.test(navigator.userAgent);
  }
}
