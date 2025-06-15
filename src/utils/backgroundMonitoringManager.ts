import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { globalSignalProcessingLock } from './globalSignalProcessingLock';

export class BackgroundMonitoringManager {
  private backgroundCheckInterval: NodeJS.Timeout | null = null;
  private signalProcessingLock = new Set<string>();
  private instanceId: string;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;

  // === CACHE & PERF ===
  private cachedSignals: Signal[] = [];
  private cacheVersion: number = 0;
  private metrics = {
    storageLoads: 0,
    cacheHits: 0,
    cacheInvalidations: 0,
    signalTriggers: 0,
  };
  private signalsListenerRegistered: boolean = false;

  constructor(
    instanceId: string,
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager
  ) {
    this.instanceId = instanceId;
    this.notificationManager = notificationManager;
    this.audioManager = audioManager;
    this.initCache();
    this.registerSignalsListener();
  }

  private initCache() {
    this.cachedSignals = loadSignalsFromStorage();
    this.cacheVersion++;
    this.metrics.storageLoads++;
    console.info('[Monitor] Signals loaded into cache. (Loads:', this.metrics.storageLoads, 'Version:', this.cacheVersion, ')', this.cachedSignals);
  }

  private updateCache(newSignals: Signal[]) {
    this.cachedSignals = Array.isArray(newSignals) ? [...newSignals] : [];
    this.cacheVersion++;
    this.metrics.cacheInvalidations++;
    console.info(`[Monitor] Signal cache updated (ver ${this.cacheVersion}, invalidations: ${this.metrics.cacheInvalidations})`, this.cachedSignals);
  }

  private registerSignalsListener() {
    if (this.signalsListenerRegistered) return;
    window.addEventListener('signals-storage-update', this.handleSignalsUpdate);
    this.signalsListenerRegistered = true;
  }

  private unregisterSignalsListener() {
    if (this.signalsListenerRegistered) {
      window.removeEventListener('signals-storage-update', this.handleSignalsUpdate);
      this.signalsListenerRegistered = false;
    }
  }

  // Listener to keep cache current when storage changes
  private handleSignalsUpdate = () => {
    this.metrics.storageLoads++;
    const updatedSignals = loadSignalsFromStorage();
    this.updateCache(updatedSignals);
    console.info('[Monitor] Cache reloaded after storage update (Loads:', this.metrics.storageLoads, ')');
  };

  // Public: May be called on app cleanup
  cleanup() {
    this.stopBackgroundMonitoring();
    this.signalProcessingLock.clear();
    this.unregisterSignalsListener();
  }

  startBackgroundMonitoring() {
    if (!globalBackgroundManager.canStartBackgroundMonitoring(this.instanceId)) {
      console.log('🚀 Background monitoring blocked by global manager for instance:', this.instanceId);
      return;
    }
    if (this.backgroundCheckInterval) {
      console.log('🚀 Background monitoring already active for this instance:', this.instanceId);
      return;
    }
    // Initial cache load always
    this.initCache();

    console.log('🚀 Starting background monitoring for instance:', this.instanceId);
    this.backgroundCheckInterval = setInterval(async () => {
      if (globalBackgroundManager.getStatus().activeInstanceId !== this.instanceId) {
        console.warn(
          `⛔ [${this.instanceId}] Not owning monitoring. Interval auto-clearing. Current owner: ${globalBackgroundManager.getStatus().activeInstanceId}`
        );
        this.stopBackgroundMonitoring();
        return;
      }
      // Use only cached signals!
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

  // Update ONLY specific triggered signal atomically in storage
  private async atomicallyMarkSignalAsTriggered(signalToMark: Signal) {
    try {
      let attempts = 0;
      let success = false;
      while (attempts < 3 && !success) {
        attempts++;
        // Get fresh signals from storage to ensure no outdated state
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
            console.info('[Monitor] Atomically marked triggered:', signalToMark.timestamp, '(attempt', attempts, ')');
          } catch (err) {
            console.warn('[Monitor] Save failed, will retry', attempts, err);
            await new Promise(res => setTimeout(res, 30 * attempts));
          }
        } else {
          // Already triggered elsewhere or signal not found
          success = true;
        }
      }
      if (!success) {
        // Optionally, error recovery: log this signal for cleanup
        console.error('[Monitor] Failed to atomically trigger signal after retries:', signalToMark.timestamp);
      }
    } catch (error) {
      console.error('[Monitor] Atomic trigger error:', error);
    }
  }

  // IMPORTANT: Use only the cache!
  private async checkSignalsInBackground() {
    try {
      this.metrics.cacheHits++;
      const signals = this.cachedSignals;
      if (!signals || signals.length === 0) {
        return;
      }
      const antidelaySeconds = loadAntidelayFromStorage();
      const now = new Date();

      // Track which signals actually need to be updated
      const signalsToTrigger: Signal[] = [];

      for (const signal of signals) {
        const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
        const acquired = globalSignalProcessingLock.lockSignal(signalKey);
        if (!acquired) continue;
        try {
          if (this.signalProcessingLock.has(signalKey)) {
            continue;
          }

          if (this.shouldTriggerSignal(signal, antidelaySeconds, now) && !signal.triggered) {
            this.signalProcessingLock.add(signalKey);
            this.metrics.signalTriggers++;
            console.log('🚀 Signal should trigger in background:', signal);

            await this.notificationManager.triggerBackgroundNotification(signal);
            await this.audioManager.playBackgroundAudio(signal);

            // Add to trigger queue (so we only update what is needed)
            signalsToTrigger.push(signal);

            setTimeout(() => {
              this.signalProcessingLock.delete(signalKey);
            }, 2000);
          }
        } finally {
          globalSignalProcessingLock.unlockSignal(signalKey);
        }
      }
      // Atomically update only relevant signals, handle each independently and recover if failed
      for (const triggeredSignal of signalsToTrigger) {
        await this.atomicallyMarkSignalAsTriggered(triggeredSignal);
      }
      if (signalsToTrigger.length > 0) {
        // Cache should refresh, but force event in case
        window.dispatchEvent(new Event('signals-storage-update'));
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

  // PERF
  getMetrics() {
    return { ...this.metrics, cacheVersion: this.cacheVersion };
  }
}
