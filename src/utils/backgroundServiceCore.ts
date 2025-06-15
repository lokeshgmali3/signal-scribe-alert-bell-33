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
    // --- Android-specific Phase 2 scaffolding ---
    this.prepareAndroidBackgroundFeatures();
  }

  /**
   * Scaffold for Android-specific features (battery, foreground notification, alarm manager)
   */
  private prepareAndroidBackgroundFeatures() {
    // TODO: Request battery optimization bypass (requires plugin/native-side logic)
    // this.requestIgnoreBatteryOptimizations();

    // TODO: Create a persistent foreground service notification to keep the app alive
    // this.startForegroundServiceNotification();

    // TODO: Schedule alarms for background using AlarmManager (requires plugin/native/native-side logic)
    // this.scheduleAlarmManagerSignals();
  }

  // ---- Begin: Android-specific stubs for future implementation ----

  /**
   * Stub: Request the OS to ignore battery optimizations for this app/package.
   * Needs native code or a dedicated plugin (not available in web-only context).
   */
  public async requestIgnoreBatteryOptimizations() {
    // TODO: Implement using e.g. @capacitor-community/battery-optimization or custom native/Cordova plugin
    console.warn('[Android Scaffold] Battery optimization bypass is not implemented yet.');
    // Could trigger an Intent: `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
  }

  /**
   * Stub: Start a foreground notification/service to keep the app alive in background on Android.
   * This can be accomplished only with native plugins or custom Java/Kotlin code.
   */
  public async startForegroundServiceNotification() {
    // TODO: Use native plugin (e.g. capacitor-foreground-service, or write Cordova plugin)
    // This notification should be persistent and ongoing, ideally allow user to stop monitoring
    console.warn('[Android Scaffold] Foreground service notification not implemented yet.');
  }

  /**
   * Stub: Schedule tasks using Android's AlarmManager for reliable background execution.
   */
  public async scheduleAlarmManagerSignals(signals?: Signal[]) {
    // TODO: Use e.g. @capacitor-community/alarm-manager once supported or custom native plugin
    // Call to schedule alarms for each signal (intent-based broadcast to wake app)
    console.warn('[Android Scaffold] AlarmManager-based scheduling not implemented yet.');
  }

  // ---- End: Android-specific stubs ----

  async initialize() {
    console.log('🚀 Initializing background service instance:', this.instanceId);
    await this.notificationManager.requestPermissions();
    if (!this.appStateListenerInitialized) {
      await this.setupAppStateListeners();
      this.appStateListenerInitialized = true;
    }
    console.log('🚀 Background service initialized successfully');
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

  getStatus() {
    const globalStatus = globalBackgroundManager.getStatus();
    return {
      instanceId: this.instanceId,
      hasBackgroundInterval: this.monitoringManager.isActive(),
      isAppActive: this.isAppActive,
      processingSignals: this.monitoringManager.getProcessingSignals(),
      audioInfo: this.audioManager.getAudioInfo(),
      notificationIds: this.notificationManager.getNotificationIds(),
      globalStatus
    };
  }
}
