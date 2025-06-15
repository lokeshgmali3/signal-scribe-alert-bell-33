import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { playCustomRingtoneBackground } from './audioUtils';
import { globalBackgroundManager } from './globalBackgroundManager';

interface CachedAudio {
  base64: string;
  mimeType: string;
  timestamp: number;
}

class BackgroundService {
  private static instance: BackgroundService | null = null;
  private instanceId: string;
  private notificationIds: number[] = [];
  private backgroundCheckInterval: NodeJS.Timeout | null = null;
  private isAppActive = true;
  private customRingtone: string | null = null;
  private cachedAudio: CachedAudio | null = null;
  private appStateListenerInitialized = false;
  private signalProcessingLock = new Set<string>();
  private listenerCleanupFunctions: (() => void)[] = [];

  constructor() {
    this.instanceId = globalBackgroundManager.generateInstanceId();
    console.log('🚀 Background service instance created with ID:', this.instanceId);
  }

  static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing background service instance:', this.instanceId);
      await this.requestPermissions();
      
      if (!this.appStateListenerInitialized) {
        await this.setupAppStateListeners();
        this.appStateListenerInitialized = true;
      }
      
      console.log('🚀 Background service initialized successfully');
    } catch (error) {
      console.error('🚀 Failed to initialize background service:', error);
    }
  }

  setCustomRingtone(ringtone: string | null) {
    console.log('🚀 Background service custom ringtone set:', ringtone ? 'custom file' : 'null');
    this.customRingtone = ringtone;
  }

  async cacheCustomAudio(base64: string, mimeType: string) {
    console.log('🚀 Caching custom audio in background service - base64 length:', base64.length, 'mime type:', mimeType);
    this.cachedAudio = {
      base64,
      mimeType,
      timestamp: Date.now()
    };
    console.log('🚀 Custom audio cached successfully');
  }

  clearCustomAudio() {
    console.log('🚀 Clearing cached custom audio');
    this.cachedAudio = null;
  }

  async playBackgroundAudio(signal?: Signal) {
    try {
      console.log('🚀 Playing background audio for signal:', signal?.timestamp || 'manual trigger');
      console.log('🚀 Has cached audio:', this.cachedAudio ? 'yes' : 'no');
      console.log('🚀 Custom ringtone set:', this.customRingtone ? 'yes' : 'no');
      
      if (this.customRingtone && this.cachedAudio) {
        console.log('🚀 Using cached custom audio for background playback');
        await playCustomRingtoneBackground(this.cachedAudio);
      } else {
        console.log('🚀 No custom audio available, using default beep');
        await playCustomRingtoneBackground(null);
      }
    } catch (error) {
      console.error('🚀 Error playing background audio:', error);
    }
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
    console.log('🚀 Setting up app state listeners for instance:', this.instanceId);
    
    // Clean up any existing listeners first
    this.cleanupListeners();
    
    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      console.log('🚀 App state changed. Active:', isActive, 'Instance:', this.instanceId);
      this.isAppActive = isActive;
      
      if (!isActive) {
        console.log('🚀 App moved to background - attempting to start monitoring');
        this.startBackgroundMonitoring();
      } else {
        console.log('🚀 App came to foreground - stopping monitoring');
        this.stopBackgroundMonitoring();
      }
    });

    const notificationListener = LocalNotifications.addListener('localNotificationActionPerformed', 
      async (notification) => {
        console.log('🚀 Notification action performed:', notification);
        await this.triggerHapticFeedback();
      }
    );

    this.listenerCleanupFunctions.push(
      () => appStateListener.remove(),
      () => notificationListener.remove()
    );

    globalBackgroundManager.addListener();
    globalBackgroundManager.addListener(); // One for each listener
  }

  private cleanupListeners() {
    console.log('🚀 Cleaning up existing listeners for instance:', this.instanceId);
    this.listenerCleanupFunctions.forEach(cleanup => cleanup());
    this.listenerCleanupFunctions = [];
  }

  private startBackgroundMonitoring() {
    if (!globalBackgroundManager.canStartBackgroundMonitoring(this.instanceId)) {
      console.log('🚀 Background monitoring blocked by global manager');
      return;
    }

    if (this.backgroundCheckInterval) {
      console.log('🚀 Background monitoring already active for this instance');
      return;
    }

    console.log('🚀 Starting background monitoring for instance:', this.instanceId);
    this.backgroundCheckInterval = setInterval(async () => {
      await this.checkSignalsInBackground();
    }, 1000);
  }

  private stopBackgroundMonitoring() {
    if (this.backgroundCheckInterval) {
      console.log('🚀 Stopping background monitoring for instance:', this.instanceId);
      clearInterval(this.backgroundCheckInterval);
      this.backgroundCheckInterval = null;
    }
    globalBackgroundManager.stopBackgroundMonitoring(this.instanceId);
  }

  private async checkSignalsInBackground() {
    try {
      const signals = await globalBackgroundManager.withStorageLock(() => 
        loadSignalsFromStorage()
      );
      const antidelaySeconds = loadAntidelayFromStorage();
      
      if (!signals || signals.length === 0) {
        return;
      }

      const now = new Date();
      let signalsUpdated = false;
      
      for (const signal of signals) {
        const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
        
        if (this.signalProcessingLock.has(signalKey)) {
          continue;
        }
        
        if (this.shouldTriggerSignal(signal, antidelaySeconds, now) && !signal.triggered) {
          this.signalProcessingLock.add(signalKey);
          
          console.log('🚀 Signal should trigger in background:', signal);
          await this.triggerBackgroundNotification(signal);
          await this.playBackgroundAudio(signal);
          
          signal.triggered = true;
          signalsUpdated = true;
          console.log('🚀 Signal marked as triggered in background:', signal.timestamp);
          
          setTimeout(() => {
            this.signalProcessingLock.delete(signalKey);
          }, 2000);
        }
      }
      
      if (signalsUpdated) {
        console.log('🚀 Saving updated signals to storage after background trigger');
        await globalBackgroundManager.withStorageLock(() => 
          saveSignalsToStorage(signals)
        );
      }
    } catch (error) {
      console.error('🚀 Error checking signals in background:', error);
    }
  }

  private shouldTriggerSignal(signal: Signal, antidelaySeconds: number, now: Date): boolean {
    if (signal.triggered) return false;
    
    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
    const signalDate = new Date();
    signalDate.setHours(signalHours, signalMinutes, 0, 0);
    
    const targetTime = new Date(signalDate.getTime() - (antidelaySeconds * 1000));
    const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
    
    return timeDiff < 1000;
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
      this.clearCustomAudio();
      this.signalProcessingLock.clear();
      this.cleanupListeners();
      
      // Remove listeners from global count
      globalBackgroundManager.removeListener();
      globalBackgroundManager.removeListener();
      
      console.log('🚀 Background service cleaned up for instance:', this.instanceId);
    } catch (error) {
      console.error('🚀 Error cleaning up background service:', error);
    }
  }

  getStatus() {
    const globalStatus = globalBackgroundManager.getStatus();
    return {
      instanceId: this.instanceId,
      hasBackgroundInterval: !!this.backgroundCheckInterval,
      isAppActive: this.isAppActive,
      processingSignals: Array.from(this.signalProcessingLock),
      globalStatus
    };
  }
}

export const backgroundService = BackgroundService.getInstance();
