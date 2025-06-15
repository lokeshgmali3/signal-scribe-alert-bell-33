import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage } from './signalStorage';

class BackgroundService {
  private notificationIds: number[] = [];
  private backgroundCheckInterval: NodeJS.Timeout | null = null;
  private isAppActive = true;
  private customRingtoneData: string | null = null;
  private audioContexts: AudioContext[] = [];

  async initialize() {
    try {
      // Request all necessary permissions
      await this.requestPermissions();
      
      // Set up app state listeners
      await this.setupAppStateListeners();
      
      // Load cached custom ringtone
      await this.loadCachedRingtone();
      
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
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  }

  private async loadCachedRingtone() {
    try {
      const cached = localStorage.getItem('custom_ringtone_data');
      if (cached) {
        this.customRingtoneData = cached;
        console.log('Loaded cached custom ringtone data');
      }
    } catch (error) {
      console.error('Error loading cached ringtone:', error);
    }
  }

  async cacheCustomRingtone(audioBlob: Blob) {
    try {
      // Convert blob to base64 for persistent storage
      const reader = new FileReader();
      return new Promise<void>((resolve, reject) => {
        reader.onload = () => {
          const base64Data = reader.result as string;
          this.customRingtoneData = base64Data;
          localStorage.setItem('custom_ringtone_data', base64Data);
          console.log('Custom ringtone cached successfully');
          resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
    } catch (error) {
      console.error('Error caching custom ringtone:', error);
    }
  }

  private async setupAppStateListeners() {
    // Listen for app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Active:', isActive);
      this.isAppActive = isActive;
      
      if (!isActive) {
        // App moved to background - start more aggressive monitoring
        this.startBackgroundMonitoring();
      } else {
        // App came to foreground - can rely on normal timers
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
        console.log('Opening app from notification');
      }
    );
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
          
          // Play background audio
          await this.playBackgroundAudio();
          
          // Mark signal as triggered
          signal.triggered = true;
          console.log('Signal triggered in background:', signal);
        }
      }
    } catch (error) {
      console.error('Error checking signals in background:', error);
    }
  }

  private async playBackgroundAudio() {
    try {
      const useDefault = localStorage.getItem('use_default_sound') !== 'false';
      
      if (useDefault || !this.customRingtoneData) {
        // Play default beep using Web Audio API (works in background)
        await this.playDefaultBeep();
      } else {
        // Play custom sound using Web Audio API for background compatibility
        await this.playCustomSoundInBackground();
      }
    } catch (error) {
      console.error('Error playing background audio:', error);
      // Fallback to default beep
      await this.playDefaultBeep();
    }
  }

  private async playDefaultBeep() {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContexts.push(audioContext);
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      const duration = 3000; // 3 seconds
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration / 1000);
      
      console.log('Default beep played in background');
    } catch (error) {
      console.error('Error playing default beep:', error);
    }
  }

  private async playCustomSoundInBackground() {
    try {
      if (!this.customRingtoneData) return;
      
      // Convert base64 data to ArrayBuffer
      const response = await fetch(this.customRingtoneData);
      const arrayBuffer = await response.arrayBuffer();
      
      // Use Web Audio API to decode and play
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContexts.push(audioContext);
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.8;
      
      source.start();
      
      console.log('Custom sound played in background using Web Audio API');
    } catch (error) {
      console.error('Error playing custom sound in background:', error);
      // Fallback to default beep
      await this.playDefaultBeep();
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
            }
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
      await this.cancelAllScheduledNotifications();
      
      // Clean up audio contexts
      this.audioContexts.forEach(context => {
        if (context.state !== 'closed') {
          context.close().catch(err => console.log('Audio context cleanup error:', err));
        }
      });
      this.audioContexts = [];
      
      console.log('Background service cleaned up');
    } catch (error) {
      console.error('Error cleaning up background service:', error);
    }
  }
}

export const backgroundService = new BackgroundService();
