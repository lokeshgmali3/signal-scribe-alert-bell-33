
import { LocalNotifications } from '@capacitor/local-notifications';
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { checkSignalTime } from './signalUtils';
import { backgroundService } from './backgroundService';

let backgroundCheckInterval: NodeJS.Timeout | undefined;
let isBackgroundTaskActive = false;

export const startBackgroundTask = async () => {
  try {
    // Prevent multiple instances
    if (isBackgroundTaskActive) {
      console.log('🚀 Background task already active, skipping start');
      return;
    }

    // Request notification permissions first
    const permission = await LocalNotifications.requestPermissions();
    console.log('Notification permission:', permission);

    if (permission.display !== 'granted') {
      console.warn('Notification permissions not granted');
      return;
    }

    // Clear any existing interval to prevent duplicates
    if (backgroundCheckInterval) {
      console.log('🚀 Clearing existing background task before starting new one');
      clearInterval(backgroundCheckInterval);
      backgroundCheckInterval = undefined;
    }

    isBackgroundTaskActive = true;
    console.log('Background task started - using hybrid monitoring');
    
    // Start checking signals every second for web functionality
    backgroundCheckInterval = setInterval(async () => {
      await checkSignalsInBackground();
    }, 1000);

  } catch (error) {
    console.error('Failed to start background task:', error);
    isBackgroundTaskActive = false;
  }
};

export const stopBackgroundTask = () => {
  if (backgroundCheckInterval) {
    clearInterval(backgroundCheckInterval);
    backgroundCheckInterval = undefined;
    console.log('Background task stopped');
  }
  isBackgroundTaskActive = false;
};

const checkSignalsInBackground = async () => {
  try {
    const signals = loadSignalsFromStorage();
    const antidelaySeconds = loadAntidelayFromStorage();
    
    if (!signals || signals.length === 0) return;
    
    let signalsUpdated = false;
    
    for (const signal of signals) {
      if (checkSignalTime(signal, antidelaySeconds) && !signal.triggered) {
        await triggerLocalNotification(signal);
        
        // Mark signal as triggered and save back to storage
        signal.triggered = true;
        signalsUpdated = true;
        console.log('Signal triggered in web background:', signal.timestamp);
      }
    }
    
    // Save updated signals if any were triggered
    if (signalsUpdated) {
      console.log('🚀 Saving updated signals after web background trigger');
      saveSignalsToStorage(signals);
    }
  } catch (error) {
    console.error('Error checking signals in background:', error);
  }
};

const triggerLocalNotification = async (signal: Signal) => {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: '🚨 Binary Options Signal Alert!',
          body: `${signal.asset || 'Asset'} - ${signal.direction || 'Direction'} at ${signal.timestamp}`,
          id: Date.now(),
          schedule: { at: new Date() },
          sound: 'default',
          attachments: undefined,
          actionTypeId: 'SIGNAL_ALERT',
          extra: {
            signal: JSON.stringify(signal)
          }
        }
      ]
    });
    
    console.log('Local notification scheduled for signal:', signal);
  } catch (error) {
    console.error('Failed to schedule local notification:', error);
  }
};

// Schedule notifications in advance for all signals using the background service
export const scheduleAllSignalNotifications = async (signals: Signal[]) => {
  try {
    // Use the background service for comprehensive scheduling
    await backgroundService.scheduleAllSignals(signals);
    
    // Also handle web-based scheduling as fallback
    const antidelaySeconds = loadAntidelayFromStorage();
    const now = new Date();
    
    // Cancel existing notifications first
    await LocalNotifications.cancel({ notifications: [] });
    
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
          return {
            title: '🚨 Binary Options Signal Alert!',
            body: `${signal.asset || 'Asset'} - ${signal.direction || 'Direction'} at ${signal.timestamp}`,
            id: index + 1,
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
      console.log(`Scheduled ${notifications.length} web notifications`);
    }
  } catch (error) {
    console.error('Failed to schedule signal notifications:', error);
  }
};

export const getBackgroundTaskStatus = () => {
  return {
    isActive: isBackgroundTaskActive,
    hasInterval: !!backgroundCheckInterval
  };
};
