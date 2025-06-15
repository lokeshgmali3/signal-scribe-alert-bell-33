import { LocalNotifications } from '@capacitor/local-notifications';
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { checkSignalTime } from './signalUtils';
import { backgroundService } from './backgroundService';
import { globalBackgroundManager } from './globalBackgroundManager';

let backgroundCheckInterval: NodeJS.Timeout | undefined;
let taskInstanceId: string | null = null;

export const startBackgroundTask = async () => {
  try {
    // Generate unique instance ID for this task
    taskInstanceId = globalBackgroundManager.generateInstanceId();
    
    if (!globalBackgroundManager.canStartBackgroundMonitoring(taskInstanceId)) {
      console.log('🚀 Web background task blocked by global manager');
      return;
    }

    const permission = await LocalNotifications.requestPermissions();
    console.log('Notification permission:', permission);

    if (permission.display !== 'granted') {
      console.warn('Notification permissions not granted');
      globalBackgroundManager.stopBackgroundMonitoring(taskInstanceId);
      return;
    }

    if (backgroundCheckInterval) {
      console.log('🚀 Clearing existing web background task before starting new one');
      clearInterval(backgroundCheckInterval);
      backgroundCheckInterval = undefined;
    }

    console.log('Background task started - using hybrid monitoring with ID:', taskInstanceId);
    
    backgroundCheckInterval = setInterval(async () => {
      await checkSignalsInBackground();
    }, 1000);

  } catch (error) {
    console.error('Failed to start background task:', error);
    if (taskInstanceId) {
      globalBackgroundManager.stopBackgroundMonitoring(taskInstanceId);
    }
  }
};

export const stopBackgroundTask = () => {
  if (backgroundCheckInterval) {
    clearInterval(backgroundCheckInterval);
    backgroundCheckInterval = undefined;
    console.log('Background task stopped');
  }
  
  if (taskInstanceId) {
    globalBackgroundManager.stopBackgroundMonitoring(taskInstanceId);
    taskInstanceId = null;
  }
};

const checkSignalsInBackground = async () => {
  try {
    const signals = await globalBackgroundManager.withStorageLock(() => 
      loadSignalsFromStorage()
    );
    const antidelaySeconds = loadAntidelayFromStorage();
    
    if (!signals || signals.length === 0) return;
    
    let signalsUpdated = false;
    
    for (const signal of signals) {
      if (checkSignalTime(signal, antidelaySeconds) && !signal.triggered) {
        await triggerLocalNotification(signal);
        
        signal.triggered = true;
        signalsUpdated = true;
        console.log('Signal triggered in web background:', signal.timestamp);
      }
    }
    
    if (signalsUpdated) {
      console.log('🚀 Saving updated signals after web background trigger');
      await globalBackgroundManager.withStorageLock(() => 
        saveSignalsToStorage(signals)
      );
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

export const scheduleAllSignalNotifications = async (signals: Signal[]) => {
  try {
    await backgroundService.scheduleAllSignals(signals);
    
    const antidelaySeconds = loadAntidelayFromStorage();
    const now = new Date();
    
    await LocalNotifications.cancel({ notifications: [] });
    
    const notifications = signals
      .filter(signal => !signal.triggered)
      .map((signal, index) => {
        const [hours, minutes] = signal.timestamp.split(':').map(Number);
        const signalTime = new Date();
        signalTime.setHours(hours, minutes, 0, 0);
        
        const notificationTime = new Date(signalTime.getTime() - (antidelaySeconds * 1000));
        
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
  const globalStatus = globalBackgroundManager.getStatus();
  return {
    isActive: !!backgroundCheckInterval,
    hasInterval: !!backgroundCheckInterval,
    taskInstanceId,
    globalStatus
  };
};
