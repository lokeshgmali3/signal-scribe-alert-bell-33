
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Signal } from '@/types/signal';

export class BackgroundNotificationManager {
  private notificationIds: number[] = [];

  async requestPermissions() {
    try {
      console.log('🚀 Requesting permissions');
      const notificationPermission = await LocalNotifications.requestPermissions();
      console.log('🚀 Notification permission status:', notificationPermission);
      return notificationPermission;
    } catch (error) {
      console.error('🚀 Error requesting permissions:', error);
      return null;
    }
  }

  async triggerBackgroundNotification(signal: Signal) {
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

  async triggerHapticFeedback() {
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

  async scheduleAllSignals(signals: Signal[], antidelaySeconds: number) {
    try {
      await this.cancelAllScheduledNotifications();
      
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

  getNotificationIds() {
    return [...this.notificationIds];
  }
}
