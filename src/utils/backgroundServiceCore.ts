
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
import { AudioOnlyModeManager } from './audioOnlyModeManager';
import { AppStateManager } from './appStateManager';
import { PlatformUtils } from './platformUtils';

export class BackgroundServiceCore {
  private instanceId: string;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private monitoringManager: BackgroundMonitoringManager;
  private audioOnlyModeManager: AudioOnlyModeManager;
  private appStateManager: AppStateManager;

  constructor() {
    this.instanceId = globalBackgroundManager.generateInstanceId();
    console.log('🚀 Background service instance created with ID:', this.instanceId);
    
    this.audioOnlyModeManager = new AudioOnlyModeManager();
    this.notificationManager = new BackgroundNotificationManager();
    this.audioManager = new BackgroundAudioManager();
    this.monitoringManager = new BackgroundMonitoringManager(
      this.instanceId,
      this.notificationManager,
      this.audioManager
    );
    this.appStateManager = new AppStateManager(this.instanceId, this.notificationManager);
    
    this.monitoringManager.setAudioOnlyMode(this.audioOnlyModeManager.getAudioOnlyMode());
  }

  setAudioOnlyMode(mode: boolean): void {
    this.audioOnlyModeManager.setAudioOnlyMode(mode);
    this.monitoringManager.setAudioOnlyMode(mode);
  }

  getAudioOnlyMode(): boolean {
    return this.audioOnlyModeManager.getAudioOnlyMode();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing background service instance:', this.instanceId);
      
      if (nativeAndroidManager.isAndroidNative()) {
        await this.initializeNativeAndroid();
      } else {
        await this.initializeWebPlatform();
      }

      this.monitoringManager.setAudioOnlyMode(this.audioOnlyModeManager.getAudioOnlyMode());
      this.monitoringManager.startBackgroundMonitoring();
      this.debugBackgroundStatus();
      
      console.log('🚀 Background service initialized successfully');
    } catch (error) {
      console.error('🚀 Failed to initialize background service:', error);
    }
  }

  private async initializeNativeAndroid(): Promise<void> {
    console.log('🤖 Native Android detected, using native features');
    
    await nativeAndroidManager.requestBatteryOptimization();
    await nativeAndroidManager.startForegroundService();
    
    const permissions = await nativeAndroidManager.checkNativePermissions();
    if (permissions) {
      console.log('🤖 Native permissions status:', permissions);
    }
  }

  private async initializeWebPlatform(): Promise<void> {
    console.log('🌐 Web platform detected, using web features');
    
    if (!this.audioOnlyModeManager.getAudioOnlyMode()) {
      await this.notificationManager.requestPermissions();
    }

    if (!this.appStateManager.isAppStateListenerInitialized()) {
      await this.appStateManager.setupAppStateListeners();
    }
    
    if (PlatformUtils.isAndroidPlatform()) {
      await this.startForegroundServiceNotification();
      await this.requestBatteryOptimizationBypass();
    }
  }

  // Audio methods
  setCustomRingtone(ringtone: string | null): void {
    this.audioManager.setCustomRingtone(ringtone);
  }

  async cacheCustomAudio(base64: string, mimeType: string): Promise<void> {
    await this.audioManager.cacheCustomAudio(base64, mimeType);
  }

  clearCustomAudio(): void {
    this.audioManager.clearCustomAudio();
  }

  async playBackgroundAudio(signal?: Signal): Promise<void> {
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
  async scheduleAllSignals(signals: Signal[]): Promise<void> {
    const antidelaySeconds = loadAntidelayFromStorage();
    
    if (nativeAndroidManager.isAndroidNative()) {
      const nativeSuccess = await nativeAndroidManager.scheduleNativeAlarms(signals, antidelaySeconds);
      if (nativeSuccess) {
        console.log('🤖 Using native Android alarms');
        return;
      }
    }
    
    await this.notificationManager.scheduleAllSignals(signals, antidelaySeconds);

    if (PlatformUtils.isAndroidPlatform()) {
      await AndroidAlarmManager.scheduleAlarms(signals, antidelaySeconds);
      await this.startForegroundServiceNotification();
    }
  }

  async cancelAllScheduledNotifications(): Promise<void> {
    if (nativeAndroidManager.isAndroidNative()) {
      const nativeSuccess = await nativeAndroidManager.cancelNativeAlarms();
      if (nativeSuccess) {
        await nativeAndroidManager.stopForegroundService();
        console.log('🤖 Using native Android cancellation');
        return;
      }
    }
    
    await this.notificationManager.cancelAllScheduledNotifications();
    if (PlatformUtils.isAndroidPlatform()) {
      await AndroidAlarmManager.cancelAllAlarms();
      await this.stopForegroundServiceNotification();
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.monitoringManager.cleanup();
      await this.notificationManager.cancelAllScheduledNotifications();
      this.audioManager.clearCustomAudio();
      this.appStateManager.cleanup();
      
      console.log('🚀 Background service cleaned up for instance:', this.instanceId);
    } catch (error) {
      console.error('🚀 Error cleaning up background service:', error);
    }
  }

  async requestBatteryOptimizationBypass(): Promise<void> {
    if (PlatformUtils.isAndroidPlatform()) {
      await AndroidBatteryManager.requestBatteryOptimizationBypass();
    }
  }

  async startForegroundServiceNotification(): Promise<void> {
    if (PlatformUtils.isAndroidPlatform()) {
      await AndroidForegroundService.getInstance().start();
    }
  }

  async stopForegroundServiceNotification(): Promise<void> {
    if (PlatformUtils.isAndroidPlatform()) {
      await AndroidForegroundService.getInstance().stop();
    }
  }

  debugBackgroundStatus(): any {
    const status = {
      instanceId: this.instanceId,
      appActive: this.appStateManager.getIsAppActive(),
      audio: this.audioManager.getAudioInfo(),
      notifIDs: this.notificationManager.getNotificationIds(),
      bgMonitorActive: this.monitoringManager.isActive(),
      globalStatus: globalBackgroundManager.getStatus()
    };
    console.log('[DEBUG STATUS] Background service:', status);
    (window as any).bgServiceDebug = status;
    return status;
  }

  getStatus(): any {
    return this.debugBackgroundStatus();
  }
}
