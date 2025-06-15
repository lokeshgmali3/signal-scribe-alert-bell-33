
import { LocalNotifications } from '@capacitor/local-notifications';
import { nativeAndroidManager } from './nativeAndroidManager';
import { AndroidForegroundService } from './androidForegroundService';
import { AndroidBatteryManager } from './androidBatteryManager';

export class BackgroundPermissionManager {
  private audioOnlyMode: boolean;

  constructor(audioOnlyMode: boolean = false) {
    this.audioOnlyMode = audioOnlyMode;
  }

  setAudioOnlyMode(mode: boolean) {
    this.audioOnlyMode = mode;
  }

  isAndroidPlatform(): boolean {
    return /android/i.test(navigator.userAgent);
  }

  async initializePermissions(): Promise<void> {
    try {
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
          await this.requestNotificationPermissions();
        }
        
        if (this.isAndroidPlatform()) {
          await this.startForegroundServiceNotification();
          await this.requestBatteryOptimizationBypass();
        }
      }
    } catch (error) {
      console.error('🚀 Failed to initialize permissions:', error);
    }
  }

  private async requestNotificationPermissions() {
    try {
      console.log('🚀 Requesting notification permissions');
      const notificationPermission = await LocalNotifications.requestPermissions();
      console.log('🚀 Notification permission status:', notificationPermission);
      return notificationPermission;
    } catch (error) {
      console.error('🚀 Error requesting permissions:', error);
      return null;
    }
  }

  async requestBatteryOptimizationBypass() {
    if (this.isAndroidPlatform()) {
      await AndroidBatteryManager.requestBatteryOptimizationBypass();
    }
  }

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
}
