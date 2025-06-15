
import { Signal } from '@/types/signal';
import { loadAntidelayFromStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { BackgroundMonitoringManager } from './backgroundMonitoringManager';
import { BackgroundPermissionManager } from './backgroundPermissionManager';
import { BackgroundServiceManager } from './backgroundServiceManager';
import { nativeAndroidManager } from './nativeAndroidManager';
import { AndroidAlarmManager } from './androidAlarmManager';

const AUDIO_ONLY_MODE_KEY = 'audioOnlyMode';

export class BackgroundServiceCore {
  private serviceManager: BackgroundServiceManager;
  private permissionManager: BackgroundPermissionManager;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private monitoringManager: BackgroundMonitoringManager;
  private audioOnlyMode: boolean = false;

  constructor() {
    const instanceId = globalBackgroundManager.generateInstanceId();
    this.audioOnlyMode = localStorage.getItem(AUDIO_ONLY_MODE_KEY) === 'true';
    console.log('🚀 Background service instance created with ID:', instanceId);
    
    this.serviceManager = new BackgroundServiceManager(instanceId);
    this.permissionManager = new BackgroundPermissionManager(this.audioOnlyMode);
    this.notificationManager = new BackgroundNotificationManager();
    this.audioManager = new BackgroundAudioManager();
    this.monitoringManager = new BackgroundMonitoringManager(
      instanceId,
      this.notificationManager,
      this.audioManager
    );
    this.monitoringManager.setAudioOnlyMode(this.audioOnlyMode);
  }

  setAudioOnlyMode(mode: boolean) {
    this.audioOnlyMode = mode;
    localStorage.setItem(AUDIO_ONLY_MODE_KEY, mode ? "true" : "false");
    this.permissionManager.setAudioOnlyMode(mode);
    this.monitoringManager.setAudioOnlyMode(mode);
    console.log('Audio Only Mode set to:', mode);
  }

  getAudioOnlyMode() {
    return this.audioOnlyMode;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing background service instance:', this.serviceManager.getInstanceId());
      
      await this.permissionManager.initializePermissions();

      if (!nativeAndroidManager.isAndroidNative() && !this.serviceManager.isAppStateListenerInitialized()) {
        await this.serviceManager.setupAppStateListeners();
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
    if (nativeAndroidManager.isAndroidNative()) {
      const audioInfo = this.audioManager.getAudioInfo();
      const customRingtone = audioInfo.hasCustomRingtone ? 'custom' : undefined;
      const nativeSuccess = await nativeAndroidManager.playNativeAudio(customRingtone);
      if (nativeSuccess) {
        console.log('🤖 Using native Android audio playback');
        return;
      }
    }
    
    await this.audioManager.playBackgroundAudio(signal);
  }

  // Notification methods
  async scheduleAllSignals(signals: Signal[]) {
    const antidelaySeconds = loadAntidelayFromStorage();
    
    if (nativeAndroidManager.isAndroidNative()) {
      const nativeSuccess = await nativeAndroidManager.scheduleNativeAlarms(signals, antidelaySeconds);
      if (nativeSuccess) {
        console.log('🤖 Using native Android alarms');
        return;
      }
    }
    
    await this.notificationManager.scheduleAllSignals(signals, antidelaySeconds);

    if (this.permissionManager.isAndroidPlatform()) {
      await AndroidAlarmManager.scheduleAlarms(signals, antidelaySeconds);
      await this.permissionManager.startForegroundServiceNotification();
    }
  }

  async cancelAllScheduledNotifications() {
    if (nativeAndroidManager.isAndroidNative()) {
      const nativeSuccess = await nativeAndroidManager.cancelNativeAlarms();
      if (nativeSuccess) {
        await nativeAndroidManager.stopForegroundService();
        console.log('🤖 Using native Android cancellation');
        return;
      }
    }
    
    await this.notificationManager.cancelAllScheduledNotifications();
    if (this.permissionManager.isAndroidPlatform()) {
      await AndroidAlarmManager.cancelAllAlarms();
      await this.permissionManager.stopForegroundServiceNotification();
    }
  }

  async cleanup() {
    try {
      this.monitoringManager.cleanup();
      await this.notificationManager.cancelAllScheduledNotifications();
      this.audioManager.clearCustomAudio();
      await this.serviceManager.cleanup();
      
      console.log('🚀 Background service cleaned up for instance:', this.serviceManager.getInstanceId());
    } catch (error) {
      console.error('🚀 Error cleaning up background service:', error);
    }
  }

  getStatus() {
    return {
      instanceId: this.serviceManager.getInstanceId(),
      appActive: this.serviceManager.getAppActiveState(),
      audio: this.audioManager.getAudioInfo(),
      notifIDs: this.notificationManager.getNotificationIds(),
      bgMonitorActive: this.monitoringManager.isActive(),
      globalStatus: globalBackgroundManager.getStatus()
    };
  }
}
