import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage } from './signalStorage';
import { playCustomRingtoneBackground } from './audioUtils';

class BackgroundService {
  private notificationIds: number[] = [];
  private backgroundCheckInterval: NodeJS.Timeout | null = null;
  private isAppActive = true;
  private customRingtone: string | null = null;

  async initialize() {
    try {
      console.log('🚀 Initializing background service');
      await this.requestPermissions();
      await this.setupAppStateListeners();
      console.log('🚀 Background service initialized successfully');
    } catch (error) {
      console.error('🚀 Failed to initialize background service:', error);
    }
  }

  setCustomRingtone(ringtone: string | null) {
    console.log('🚀 Background service custom ringtone set:', ringtone ? 'custom file' : 'null');
    this.customRingtone = ringtone;
  }

  private async requestPermissions() {
    try {
      console.log('🚀 Requesting permissions');
      const notificationPermission = await LocalNotifications.requestPermissions();
      console.log('🚀 Notification permission status:', notificationPermission);
    } catch (error) {
      console.error('🚀 Error requesting permissions:', error);
    }
  }

  private async setupAppStateListeners() {
    console.log('🚀 Setting up app state listeners');
    
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('🚀 App state changed. Active:', isActive);
      this.isAppActive = isActive;
      
      if (!isActive) {
        console.log('🚀 App moved to background - starting aggressive monitoring');
        this.startBackgroundMonitoring();
      } else {
        console.log('🚀 App came to foreground - stopping background monitoring');
        this.stopBackgroundMonitoring();
      }
    });

    LocalNotifications.addListener('localNotificationActionPerformed', 
      async (notification) => {
        console.log('🚀 Notification action performed:', notification);
        await this.triggerHapticFeedback();
      }
    );
  }

  private startBackgroundMonitoring() {
    if (this.backgroundCheckInterval) {
      clearInterval(this.backgroundCheckInterval);
    }

    console.log('🚀 Starting background monitoring with 1-second intervals');
    this.backgroundCheckInterval = setInterval(async () => {
      await this.checkSignalsInBackground();
    }, 1000);
  }

  private stopBackgroundMonitoring() {
    if (this.backgroundCheckInterval) {
      clearInterval(this.backgroundCheckInterval);
      this.backgroundCheckInterval = null;
      console.log('🚀 Background monitoring stopped');
    }
  }

  private async checkSignalsInBackground() {
    try {
      const signals = loadSignalsFromStorage();
      const antidelaySeconds = loadAntidelayFromStorage();
      
      if (!signals || signals.length === 0) return;

      const now = new Date();
      console.log('🚀 Background check at:', now.toLocaleTimeString(), 'for', signals.length, 'signals');
      
      for (const signal of signals) {
        if (this.shouldTriggerSignal(signal, antidelaySeconds, now) && !signal.triggered) {
          console.log('🚀 Signal should trigger in background:', signal);
          await this.triggerBackgroundNotification(signal);
          await this.playBackgroundAudio(signal);
          
          signal.triggered = true;
          console.log('🚀 Signal marked as triggered in background:', signal);
        }
      }
    } catch (error) {
      console.error('🚀 Error checking signals in background:', error);
    }
  }

  private async playBackgroundAudio(signal: Signal) {
    try {
      console.log('🚀 Playing background audio for signal:', signal);
      console.log('🚀 Using custom ringtone:', this.customRingtone ? 'yes' : 'no');
      
      await playCustomRingtoneBackground(this.customRingtone);
    } catch (error) {
      console.error('🚀 Error playing background audio:', error);
    }
  }

  private shouldTriggerSignal(signal: Signal, antidelaySeconds: number, now: Date): boolean {
    if (signal.triggered) return false;
    
    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
    const signalDate = new Date();
    signalDate.setHours(signalHours, signalMinutes, 0, 0);
    
    const targetTime = new Date(signalDate.getTime() - (antidelaySeconds * 1000));
    const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
    
    const shouldTrigger = timeDiff < 1000;
    if (shouldTrigger) {
      console.log('🚀 Signal timing check - should trigger:', signal.timestamp);
      console.log('🚀 Target time:', targetTime.toLocaleTimeString());
      console.log('🚀 Current time:', now.toLocaleTimeString());
      console.log('🚀 Time diff (ms):', timeDiff);
    }
    
    return shouldTrigger;
  }

  private async triggerBackgroundNotification(signal: Signal) {
    try {
      const notificationId = Date.now();
      this.notificationIds.push(notificationId);

      console.log('🚀 Scheduling background notification for signal:', signal);

      await LocalNotifications.schedule({
        notifications: [
          {
            title: '🚨 Binary Options Signal Alert!',
            body: `${signal.asset || 'Asset'} - ${signal.direction || 'Direction'} at ${signal.timestamp}`,
            id: notificationId,
            schedule: { at: new Date() },
            sound: 'default',
            attachments: undefined,
            actionTypeId: 'SIGNAL_ALERT',
            extra: {
              signal: JSON.stringify(signal),
              timestamp: Date.now()
            }
          }
        ]
      });

      await this.triggerHapticFeedback();
      console.log('🚀 Background notification scheduled successfully');
    } catch (error) {
      console.error('🚀 Failed to schedule background notification:', error);
    }
  }

  private async triggerHapticFeedback() {
    try {
      console.log('🚀 Triggering haptic feedback');
      await Haptics.impact({ style: ImpactStyle.Heavy });
      
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }, 200);
      
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }, 400);
    } catch (error) {
      console.error('🚀 Error triggering haptic feedback:', error);
    }
  }

  async scheduleAllSignals(signals: Signal[]) {
    try {
      await this.cancelAllScheduledNotifications();
      
      const antidelaySeconds = loadAntidelayFromStorage();
      const now = new Date();
      
      console.log('🚀 Scheduling', signals.length, 'signals with antidelay:', antidelaySeconds);
      
      const notifications = signals
        .filter(signal => !signal.triggered)
        .map((signal, index) => {
          const [hours, minutes] = signal.timestamp.split(':').map(Number);
          const signalTime = new Date();
          signalTime.setHours(hours, minutes, 0, 0);
          
          const notificationTime = new Date(signalTime.getTime() - (antidelaySeconds * 1000));
          
          if (notificationTime > now) {
            const notificationId = 1000 + index;
            this.notificationIds.push(notificationId);
            
            console.log('🚀 Scheduling advance notification for:', signal.timestamp, 'at:', notificationTime.toLocaleTimeString());
            
            return {
              title: '🚨 Binary Options Signal Alert!',
              body: `${signal.asset || 'Asset'} - ${signal.direction || 'Direction'} at ${signal.timestamp}`,
              id: notificationId,
              schedule: { at: notificationTime },
              sound: 'default',
              attachments: undefined,
              actionTypeId: 'SIGNAL_ALERT',
              extra: {
                signal: JSON.stringify(signal)
              }
            };
          }
          return null;
        })
        .filter(Boolean);

      if (notifications.length > 0) {
        await LocalNotifications.schedule({
          notifications: notifications as any[]
        });
        console.log('🚀 Scheduled', notifications.length, 'advance notifications');
      }
    } catch (error) {
      console.error('🚀 Failed to schedule advance notifications:', error);
    }
  }

  async cancelAllScheduledNotifications() {
    try {
      if (this.notificationIds.length > 0) {
        await LocalNotifications.cancel({
          notifications: this.notificationIds.map(id => ({ id }))
        });
        this.notificationIds = [];
        console.log('🚀 Cancelled all scheduled notifications');
      }
    } catch (error) {
      console.error('🚀 Error cancelling notifications:', error);
    }
  }

  async cleanup() {
    try {
      this.stopBackgroundMonitoring();
      await this.cancelAllScheduledNotifications();
      console.log('🚀 Background service cleaned up');
    } catch (error) {
      console.error('🚀 Error cleaning up background service:', error);
    }
  }
}

export const backgroundService = new BackgroundService();
