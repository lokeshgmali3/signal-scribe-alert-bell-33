
import { Signal } from '@/types/signal';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { BackgroundMonitoringManager } from './backgroundMonitoringManager';
import { nativeAndroidManager } from './nativeAndroidManager';
import { AudioOnlyModeManager } from './audioOnlyModeManager';
import { AppStateManager } from './appStateManager';
import { PlatformUtils } from './platformUtils';
import { PlatformInitializer } from './platformInitializer';
import { SignalScheduler } from './signalScheduler';
import { ServiceStatusManager } from './serviceStatusManager';

export class BackgroundServiceCore {
  private instanceId: string;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private monitoringManager: BackgroundMonitoringManager;
  private audioOnlyModeManager: AudioOnlyModeManager;
  private appStateManager: AppStateManager;
  private platformInitializer: PlatformInitializer;
  private signalScheduler: SignalScheduler;
  private statusManager: ServiceStatusManager;

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
    this.platformInitializer = new PlatformInitializer(
      this.notificationManager,
      this.appStateManager,
      this.audioOnlyModeManager
    );
    this.signalScheduler = new SignalScheduler(this.notificationManager, this.platformInitializer);
    this.statusManager = new ServiceStatusManager(
      this.instanceId,
      this.audioManager,
      this.notificationManager,
      this.monitoringManager,
      this.appStateManager
    );
    
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
        await this.platformInitializer.initializeNativeAndroid();
      } else {
        await this.platformInitializer.initializeWebPlatform();
      }

      this.monitoringManager.setAudioOnlyMode(this.audioOnlyModeManager.getAudioOnlyMode());
      this.monitoringManager.startBackgroundMonitoring();
      this.statusManager.debugBackgroundStatus();
      
      console.log('🚀 Background service initialized successfully');
    } catch (error) {
      console.error('🚀 Failed to initialize background service:', error);
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
    await this.signalScheduler.scheduleAllSignals(signals);
  }

  async cancelAllScheduledNotifications(): Promise<void> {
    await this.signalScheduler.cancelAllScheduledNotifications();
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
    await this.platformInitializer.requestBatteryOptimizationBypass();
  }

  async startForegroundServiceNotification(): Promise<void> {
    await this.platformInitializer.startForegroundServiceNotification();
  }

  async stopForegroundServiceNotification(): Promise<void> {
    await this.platformInitializer.stopForegroundServiceNotification();
  }

  debugBackgroundStatus(): any {
    return this.statusManager.debugBackgroundStatus();
  }

  getStatus(): any {
    return this.statusManager.getStatus();
  }
}
