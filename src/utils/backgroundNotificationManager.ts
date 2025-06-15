import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Signal } from '@/types/signal';

// --- Android Background Requirements Scaffold ---
// These need to be implemented step by step in future phases
const ANDROID_CHANNEL_ID = 'signal_alerts_channel';

// TODO: Implement requesting battery optimization bypass (needs custom plugin or manual intent trigger)
// TODO: Implement persistent/foreground notification for Android background service (needs native code or plugin)
// TODO: Schedule alarms for background using AlarmManager (needs @capacitor-community/alarm-manager or custom)
// TODO: Set up notification channel for ringing alarms (needed for background wake+ring)

export class BackgroundNotificationManager {
  private notificationIds: number[] = [];

  /**
   * Ensure notification channel is created for Android, with high importance, sound, and vibration.
   */
  async createAndroidNotificationChannel() {
    // Use Capacitor LocalNotifications to create channel if supported
    // Future: enhance using plugin for full channel config (see AlarmManager plugin for advanced config)
    if ((window as any).cordova?.platformId === 'android' || /android/i.test(navigator.userAgent)) {
      try {
        await LocalNotifications.createChannel?.({
          id: 'signal_alerts_channel',
          name: 'Signal Alerts',
          description: 'Channel for binary signal alert notifications',
          importance: 5,
          visibility: 1,
          sound: 'beep.wav',
          vibration: true,
        });
        console.log('[BackgroundNotificationManager] Created Android notification channel');
      } catch (e) {
        // If plugin doesn't support, quietly ignore
      }
    }
  }

  async requestPermissions() {
    try {
      console.log('🚀 Requesting permissions');
      const notificationPermission = await LocalNotifications.requestPermissions();
      console.log('🚀 Notification permission status:', notificationPermission);

      // Attempt to create channel early if on Android (doesn't error if doesn't exist)
      await this.createAndroidNotificationChannel();

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

      // Show notification with alert sound/vibration and high importance/channel if possible
      await LocalNotifications.schedule({
        notifications: [
          {
            title: '🚨 Binary Options Signal Alert!',
            body: `${signal.asset || 'Asset'} - ${signal.direction || 'Direction'} at ${signal.timestamp}`,
            id: notificationId,
            schedule: { at: new Date() },
            sound: 'default', // You can use custom or 'beep.wav' if available
            attachments: undefined,
            actionTypeId: 'SIGNAL_ALERT',
            extra: {
              signal: JSON.stringify(signal),
              timestamp: Date.now()
            },
            // channelId: ANDROID_CHANNEL_ID, // Uncomment when channel supported
            // Renotify, persistent, vibration, etc -- future implementation as needed
            // vibrate: [400, 200, 400, 200, 400], // for Cordova
          }
        ]
      });

      // Basic Android wake/vibrate, escalate this pattern/length in future
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
              },
              // channelId: ANDROID_CHANNEL_ID,
              // Renotify, persistent, etc.
              // vibrate: [400, 200, 400, 200],
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
