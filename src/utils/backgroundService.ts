
import { BackgroundMode } from '@capacitor/background-mode';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage } from './signalStorage';

class BackgroundService {
  private isBackgroundModeEnabled = false;
  private notificationIds: number[] = [];
  private backgroundCheckInterval: NodeJS.Timeout | null = null;

  async initialize() {
    try {
      // Request all necessary permissions
      await this.requestPermissions();
      
      // Set up app state listeners
      await this.setupAppStateListeners();
      
      // Configure background mode
      await this.configureBackgroundMode();
      
      console.log('Background service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize background service:', error);
    }
  }

  private async requestPermissions() {
    try {
      // Request notification permissions
      const notificationPermission = await LocalNotifications.requestPermissions();
      console.log('Notification permission status:', notificationPermission);

      // Request background mode permissions
      if (await BackgroundMode.isAvailable()) {
        await BackgroundMode.requestPermissions();
        console.log('Background mode permissions requested');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  }

  private async setupAppStateListeners() {
    // Listen for app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Active:', isActive);
      
      if (!isActive) {
        // App moved to background
        this.enableBackgroundMode();
        this.startBackgroundMonitoring();
      } else {
        // App came to foreground
        this.disableBackgroundMode();
        this.stopBackgroundMonitoring();
      }
    });

    // Listen for notification actions
    LocalNotifications.addListener('localNotificationActionPerformed', 
      async (notification) => {
        console.log('Notification action performed:', notification);
        
        // Vibrate when notification is tapped
        await this.triggerHapticFeedback();
        
        // Bring app to foreground
        if (notification.actionId === 'view' || !notification.actionId) {
          // The app will automatically come to foreground
          console.log('Opening app from notification');
        }
      }
    );
  }

  private async configureBackgroundMode() {
    try {
      if (await BackgroundMode.isAvailable()) {
        // Configure background mode settings
        await BackgroundMode.configure({
          title: 'Signal Tracker Running',
          text: 'Monitoring binary options signals',
          silent: false,
          hidden: false,
          color: '488AFF',
          resume: true,
          allowClose: false,
          showWhen: false,
          disableWebViewOptimizations: true,
        });
        
        console.log('Background mode configured');
      }
    } catch (error) {
      console.error('Error configuring background mode:', error);
    }
  }

  async enableBackgroundMode() {
    try {
      if (!this.isBackgroundModeEnabled && await BackgroundMode.isAvailable()) {
        await BackgroundMode.enable();
        this.isBackgroundModeEnabled = true;
        console.log('Background mode enabled');
      }
    } catch (error) {
      console.error('Error enabling background mode:', error);
    }
  }

  async disableBackgroundMode() {
    try {
      if (this.isBackgroundModeEnabled && await BackgroundMode.isAvailable()) {
        await BackgroundMode.disable();
        this.isBackgroundModeEnabled = false;
        console.log('Background mode disabled');
      }
    } catch (error) {
      console.error('Error disabling background mode:', error);
    }
  }

  private startBackgroundMonitoring() {
    if (this.backgroundCheckInterval) {
      clearInterval(this.backgroundCheckInterval);
    }

    // Check signals every second in background
    this.backgroundCheckInterval = setInterval(async () => {
      await this.checkSignalsInBackground();
    }, 1000);
    
    console.log('Background monitoring started');
  }

  private stopBackgroundMonitoring() {
    if (this.backgroundCheckInterval) {
      clearInterval(this.backgroundCheckInterval);
      this.backgroundCheckInterval = null;
      console.log('Background monitoring stopped');
    }
  }

  private async checkSignalsInBackground() {
    try {
      const signals = loadSignalsFromStorage();
      const antidelaySeconds = loadAntidelayFromStorage();
      
      if (!signals || signals.length === 0) return;

      const now = new Date();
      
      for (const signal of signals) {
        if (this.shouldTriggerSignal(signal, antidelaySeconds, now) && !signal.triggered) {
          await this.triggerBackgroundNotification(signal);
          
          // Mark signal as triggered
          signal.triggered = true;
          console.log('Signal triggered in background:', signal);
        }
      }
    } catch (error) {
      console.error('Error checking signals in background:', error);
    }
  }

  private shouldTriggerSignal(signal: Signal, antidelaySeconds: number, now: Date): boolean {
    if (signal.triggered) return false;
    
    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
    const signalDate = new Date();
    signalDate.setHours(signalHours, signalMinutes, 0, 0);
    
    // Subtract antidelay seconds
    const targetTime = new Date(signalDate.getTime() - (antidelaySeconds * 1000));
    
    // Check if current time matches target time (within 1 second tolerance)
    const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
    return timeDiff < 1000;
  }

  private async triggerBackgroundNotification(signal: Signal) {
    try {
      const notificationId = Date.now();
      this.notificationIds.push(notificationId);

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
            },
            actions: [
              {
                id: 'view',
                title: 'View Signal',
                requiresAuthentication: false,
                foreground: true,
                destructive: false
              },
              {
                id: 'dismiss',
                title: 'Dismiss',
                requiresAuthentication: false,
                foreground: false,
                destructive: true
              }
            ]
          }
        ]
      });

      // Trigger haptic feedback
      await this.triggerHapticFeedback();
      
      console.log('Background notification scheduled for signal:', signal);
    } catch (error) {
      console.error('Failed to schedule background notification:', error);
    }
  }

  private async triggerHapticFeedback() {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      
      // Additional vibration pattern
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }, 200);
      
      setTimeout(async () => {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }, 400);
    } catch (error) {
      console.error('Error triggering haptic feedback:', error);
    }
  }

  async scheduleAllSignals(signals: Signal[]) {
    try {
      // Cancel existing scheduled notifications
      await this.cancelAllScheduledNotifications();
      
      const antidelaySeconds = loadAntidelayFromStorage();
      const now = new Date();
      
      const notifications = signals
        .filter(signal => !signal.triggered)
        .map((signal, index) => {
          const [hours, minutes] = signal.timestamp.split(':').map(Number);
          const signalTime = new Date();
          signalTime.setHours(hours, minutes, 0, 0);
          
          // Subtract antidelay seconds
          const notificationTime = new Date(signalTime.getTime() - (antidelaySeconds * 1000));
          
          // Only schedule if notification time is in the future
          if (notificationTime > now) {
            const notificationId = 1000 + index;
            this.notificationIds.push(notificationId);
            
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
              actions: [
                {
                  id: 'view',
                  title: 'View Signal',
                  requiresAuthentication: false,
                  foreground: true,
                  destructive: false
                },
                {
                  id: 'dismiss',
                  title: 'Dismiss',
                  requiresAuthentication: false,
                  foreground: false,
                  destructive: true
                }
              ]
            };
          }
          return null;
        })
        .filter(Boolean);

      if (notifications.length > 0) {
        await LocalNotifications.schedule({
          notifications: notifications as any[]
        });
        console.log(`Scheduled ${notifications.length} advance notifications`);
      }
    } catch (error) {
      console.error('Failed to schedule advance notifications:', error);
    }
  }

  async cancelAllScheduledNotifications() {
    try {
      if (this.notificationIds.length > 0) {
        await LocalNotifications.cancel({
          notifications: this.notificationIds.map(id => ({ id }))
        });
        this.notificationIds = [];
        console.log('Cancelled all scheduled notifications');
      }
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  async cleanup() {
    try {
      this.stopBackgroundMonitoring();
      await this.disableBackgroundMode();
      await this.cancelAllScheduledNotifications();
      console.log('Background service cleaned up');
    } catch (error) {
      console.error('Error cleaning up background service:', error);
    }
  }
}

export const backgroundService = new BackgroundService();
