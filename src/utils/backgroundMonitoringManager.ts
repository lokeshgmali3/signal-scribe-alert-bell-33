import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';

export class BackgroundMonitoringManager {
  private backgroundCheckInterval: NodeJS.Timeout | null = null;
  private signalProcessingLock = new Set<string>();
  private instanceId: string;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;

  constructor(
    instanceId: string, 
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager
  ) {
    this.instanceId = instanceId;
    this.notificationManager = notificationManager;
    this.audioManager = audioManager;
  }

  startBackgroundMonitoring() {
    // Add an immediate ownership check before starting the interval
    if (!globalBackgroundManager.canStartBackgroundMonitoring(this.instanceId)) {
      console.log('🚀 Background monitoring blocked by global manager for instance:', this.instanceId);
      return;
    }

    if (this.backgroundCheckInterval) {
      console.log('🚀 Background monitoring already active for this instance:', this.instanceId);
      return;
    }

    console.log('🚀 Starting background monitoring for instance:', this.instanceId);
    this.backgroundCheckInterval = setInterval(async () => {
      // NEW: Check if still the rightful instance before running the loop.
      if (globalBackgroundManager.getStatus().activeInstanceId !== this.instanceId) {
        // Not my turn anymore; self-terminate this interval!
        console.warn(
          `⛔ [${this.instanceId}] Not owning monitoring. Interval auto-clearing. Current owner: ${globalBackgroundManager.getStatus().activeInstanceId}`
        );
        this.stopBackgroundMonitoring();
        return;
      }
      await this.checkSignalsInBackground();
    }, 1000);
  }

  stopBackgroundMonitoring() {
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
          await this.notificationManager.triggerBackgroundNotification(signal);
          await this.audioManager.playBackgroundAudio(signal);
          
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

  isActive(): boolean {
    return !!this.backgroundCheckInterval;
  }

  getProcessingSignals(): string[] {
    return Array.from(this.signalProcessingLock);
  }

  cleanup() {
    this.stopBackgroundMonitoring();
    this.signalProcessingLock.clear();
  }
}
