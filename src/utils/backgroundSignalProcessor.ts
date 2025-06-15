import { Signal } from '@/types/signal';
import { loadAntidelayFromStorage, saveSignalsToStorage, loadSignalsFromStorage } from './signalStorage'; // <-- Added loadSignalsFromStorage here
import { globalBackgroundManager } from './globalBackgroundManager';
import { globalSignalProcessingLock } from './globalSignalProcessingLock';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { BackgroundCacheManager } from './backgroundCacheManager';

export class BackgroundSignalProcessor {
  private signalProcessingLock = new Set<string>();
  private instanceId: string;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private cacheManager: BackgroundCacheManager;
  private audioOnlyMode: boolean;

  // Tolerance for trigger (seconds)
  private static readonly SIGNAL_TRIGGER_WINDOW_MS = 3000; // 3 seconds

  private signalTriggers: number = 0;

  constructor(
    instanceId: string,
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager,
    cacheManager: BackgroundCacheManager,
    audioOnlyMode: boolean = false
  ) {
    this.instanceId = instanceId;
    this.notificationManager = notificationManager;
    this.audioManager = audioManager;
    this.cacheManager = cacheManager;
    this.audioOnlyMode = audioOnlyMode;
  }

  setAudioOnlyMode(mode: boolean) {
    this.audioOnlyMode = mode;
  }

  async processSignals(): Promise<void> {
    try {
      const signals = this.cacheManager.getCachedSignals();
      if (!signals || signals.length === 0) {
        return;
      }

      const antidelaySeconds = loadAntidelayFromStorage();
      const now = new Date();
      const signalsToTrigger: Signal[] = [];

      for (const signal of signals) {
        const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
        const acquired = globalSignalProcessingLock.lockSignal(signalKey);
        if (!acquired) continue;

        try {
          // Prevent duplicate triggers: respect global and in-memory lock, AND triggered flag
          if (this.signalProcessingLock.has(signalKey) || signal.triggered) {
            continue;
          }
          if (this.shouldTriggerSignalWithTolerance(signal, antidelaySeconds, now)) {
            // Mark triggered everywhere (local cache, lock list)
            signal.triggered = true;
            this.signalProcessingLock.add(signalKey);
            this.signalTriggers++;
            console.log('🚀 Signal should trigger in background:', signal);

            if (!this.audioOnlyMode) {
              await this.notificationManager.triggerBackgroundNotification(signal);
            }
            await this.audioManager.playBackgroundAudio(signal);

            signalsToTrigger.push(signal);

            // Remove from lock after a short delay (so repeated intervals can't retrigger this signal)
            setTimeout(() => {
              this.signalProcessingLock.delete(signalKey);
            }, 2000);
          }
        } finally {
          globalSignalProcessingLock.unlockSignal(signalKey);
        }
      }

      // Atomically update triggered signals in storage
      for (const triggeredSignal of signalsToTrigger) {
        await this.atomicallyMarkSignalAsTriggered(triggeredSignal);
      }

      if (signalsToTrigger.length > 0) {
        window.dispatchEvent(new Event('signals-storage-update'));
      }
    } catch (error) {
      console.error('🚀 Error processing signals:', error);
    }
  }

  private async atomicallyMarkSignalAsTriggered(signalToMark: Signal) {
    try {
      let attempts = 0;
      let success = false;
      while (attempts < 3 && !success) {
        attempts++;
        const freshSignals = await globalBackgroundManager.withStorageLock(() =>
          loadSignalsFromStorage()
        );
        const updateIdx = freshSignals.findIndex(
          s =>
            s.timeframe === signalToMark.timeframe &&
            s.asset === signalToMark.asset &&
            s.timestamp === signalToMark.timestamp &&
            s.direction === signalToMark.direction
        );
        if (updateIdx >= 0 && !freshSignals[updateIdx].triggered) {
          freshSignals[updateIdx] = { ...freshSignals[updateIdx], triggered: true };
          try {
            await globalBackgroundManager.withStorageLock(() =>
              saveSignalsToStorage(freshSignals)
            );
            success = true;
            console.info('[Processor] Atomically marked triggered:', signalToMark.timestamp, '(attempt', attempts, ')');
          } catch (err) {
            console.warn('[Processor] Save failed, will retry', attempts, err);
            await new Promise(res => setTimeout(res, 30 * attempts));
          }
        } else {
          success = true;
        }
      }
      if (!success) {
        console.error('[Processor] Failed to atomically trigger signal after retries:', signalToMark.timestamp);
      }
    } catch (error) {
      console.error('[Processor] Atomic trigger error:', error);
    }
  }

  private shouldTriggerSignalWithTolerance(signal: Signal, antidelaySeconds: number, now: Date): boolean {
    if (signal.triggered) return false;

    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
    const signalDate = new Date(now);
    signalDate.setHours(signalHours, signalMinutes, 0, 0);

    const targetTime = new Date(signalDate.getTime() - antidelaySeconds * 1000);

    if (signalDate.getHours() !== signalHours || isNaN(signalHours) || isNaN(signalMinutes)) {
      return false;
    }

    const diff = Math.abs(now.getTime() - targetTime.getTime());
    return diff < BackgroundSignalProcessor.SIGNAL_TRIGGER_WINDOW_MS;
  }

  cleanup() {
    this.signalProcessingLock.clear();
  }

  getProcessingSignals(): string[] {
    return Array.from(this.signalProcessingLock);
  }

  getTriggerCount(): number {
    return this.signalTriggers;
  }
}
