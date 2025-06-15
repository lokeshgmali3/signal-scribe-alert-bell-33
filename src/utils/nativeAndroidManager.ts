
import { Capacitor } from '@capacitor/core';
import AndroidSignalPlugin from '@/plugins/AndroidSignalPlugin';
import { Signal } from '@/types/signal';

export class NativeAndroidManager {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  isAndroidNative(): boolean {
    return this.isNative;
  }

  async scheduleNativeAlarms(signals: Signal[], antidelaySeconds: number): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      // Cancel existing alarms first
      await AndroidSignalPlugin.cancelAllAlarms();

      // Schedule new alarms
      const now = new Date();
      let alarmId = 1000;

      for (const signal of signals) {
        if (signal.triggered) continue;

        const [hours, minutes] = signal.timestamp.split(':').map(Number);
        const signalTime = new Date();
        signalTime.setHours(hours, minutes, 0, 0);

        // Check if signal time is in the future
        const targetTime = new Date(signalTime.getTime() - (antidelaySeconds * 1000));
        if (targetTime > now) {
          await AndroidSignalPlugin.scheduleAlarm({
            id: alarmId++,
            timestamp: signal.timestamp,
            antidelaySeconds,
            signalData: JSON.stringify(signal)
          });
          console.log('🤖 Native alarm scheduled for:', signal.timestamp);
        }
      }

      return true;
    } catch (error) {
      console.error('🤖 Failed to schedule native alarms:', error);
      return false;
    }
  }

  async cancelNativeAlarms(): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      await AndroidSignalPlugin.cancelAllAlarms();
      console.log('🤖 All native alarms cancelled');
      return true;
    } catch (error) {
      console.error('🤖 Failed to cancel native alarms:', error);
      return false;
    }
  }

  async startForegroundService(): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      await AndroidSignalPlugin.startForegroundService({
        title: 'Signal Alerts Active',
        text: 'Monitoring binary options signals in background'
      });
      console.log('🤖 Native foreground service started');
      return true;
    } catch (error) {
      console.error('🤖 Failed to start foreground service:', error);
      return false;
    }
  }

  async stopForegroundService(): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      await AndroidSignalPlugin.stopForegroundService();
      console.log('🤖 Native foreground service stopped');
      return true;
    } catch (error) {
      console.error('🤖 Failed to stop foreground service:', error);
      return false;
    }
  }

  async playNativeAudio(customAudioPath?: string): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      await AndroidSignalPlugin.playAudio({
        audioPath: customAudioPath,
        isCustom: !!customAudioPath,
        duration: 10000
      });
      console.log('🤖 Native audio started');
      return true;
    } catch (error) {
      console.error('🤖 Failed to play native audio:', error);
      return false;
    }
  }

  async stopNativeAudio(): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      await AndroidSignalPlugin.stopAudio();
      console.log('🤖 Native audio stopped');
      return true;
    } catch (error) {
      console.error('🤖 Failed to stop native audio:', error);
      return false;
    }
  }

  async requestBatteryOptimization(): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      await AndroidSignalPlugin.requestBatteryOptimization();
      console.log('🤖 Battery optimization requested');
      return true;
    } catch (error) {
      console.error('🤖 Failed to request battery optimization:', error);
      return false;
    }
  }

  async checkNativePermissions(): Promise<{
    alarms: boolean;
    notifications: boolean;
    batteryOptimization: boolean;
  } | null> {
    if (!this.isNative) return null;

    try {
      const permissions = await AndroidSignalPlugin.checkPermissions();
      console.log('🤖 Native permissions:', permissions);
      return permissions;
    } catch (error) {
      console.error('🤖 Failed to check permissions:', error);
      return null;
    }
  }
}

export const nativeAndroidManager = new NativeAndroidManager();
