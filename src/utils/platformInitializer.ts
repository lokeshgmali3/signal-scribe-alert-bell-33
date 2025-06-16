
import { nativeAndroidManager } from './nativeAndroidManager';
import { AndroidForegroundService } from './androidForegroundService';
import { AndroidBatteryManager } from './androidBatteryManager';
import { PlatformUtils } from './platformUtils';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { AppStateManager } from './appStateManager';
import { AudioOnlyModeManager } from './audioOnlyModeManager';

export class PlatformInitializer {
  private notificationManager: BackgroundNotificationManager;
  private appStateManager: AppStateManager;
  private audioOnlyModeManager: AudioOnlyModeManager;

  constructor(
    notificationManager: BackgroundNotificationManager,
    appStateManager: AppStateManager,
    audioOnlyModeManager: AudioOnlyModeManager
  ) {
    this.notificationManager = notificationManager;
    this.appStateManager = appStateManager;
    this.audioOnlyModeManager = audioOnlyModeManager;
  }

  async initializeNativeAndroid(): Promise<void> {
    console.log('🤖 Native Android detected, using native features');
    
    await nativeAndroidManager.requestBatteryOptimization();
    await nativeAndroidManager.startForegroundService();
    
    const permissions = await nativeAndroidManager.checkNativePermissions();
    if (permissions) {
      console.log('🤖 Native permissions status:', permissions);
    }
  }

  async initializeWebPlatform(): Promise<void> {
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
}
