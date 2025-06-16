
import { Signal } from '@/types/signal';
import { loadAntidelayFromStorage } from './signalStorage';
import { nativeAndroidManager } from './nativeAndroidManager';
import { AndroidAlarmManager } from './androidAlarmManager';
import { PlatformUtils } from './platformUtils';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { PlatformInitializer } from './platformInitializer';

export class SignalScheduler {
  private notificationManager: BackgroundNotificationManager;
  private platformInitializer: PlatformInitializer;

  constructor(
    notificationManager: BackgroundNotificationManager, 
    platformInitializer: PlatformInitializer
  ) {
    this.notificationManager = notificationManager;
    this.platformInitializer = platformInitializer;
  }

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
      await this.platformInitializer.startForegroundServiceNotification();
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
      await this.platformInitializer.stopForegroundServiceNotification();
    }
  }
}
