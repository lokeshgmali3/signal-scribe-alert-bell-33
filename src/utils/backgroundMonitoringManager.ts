import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { globalSignalProcessingLock } from './globalSignalProcessingLock';
import { getSignalTargetTime, checkSignalTime } from './signalUtils';

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

  // === NEW: Persistent Background Control & Signal Buffer ===
  private persistentBackgroundMode: boolean = true;
  private signalBuffer: Signal[] = [];
  private isProcessingSignals: boolean = false;

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
    // Avoid cache invalidation if actively processing a batch
    if (this.isProcessingSignals) {
      console.info("[Monitor] Skipping cache reload during active processing.");
      return;
    }
    this.metrics.storageLoads++;
    const updatedSignals = loadSignalsFromStorage();
    this.updateCache(updatedSignals);
    console.info('[Monitor] Cache reloaded after storage update (Loads:', this.metrics.storageLoads, ')');
  };

  // Public: May be called on app cleanup
  cleanup() {
    this.stopBackgroundMonitoring(true); // true: force stop for manual cleanup
    this.signalProcessingLock.clear();
    this.unregisterSignalsListener();
    this.signalBuffer = [];
  }

  startBackgroundMonitoring(forcePersistent: boolean = false) {
    if (!globalBackgroundManager.canStartBackgroundMonitoring(this.instanceId)) {
      console.log('🚀 Background monitoring blocked by global manager for instance:', this.instanceId);
      return;
    }
    // If requested, set persistent mode
    if (forcePersistent) this.persistentBackgroundMode = true;

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
        // Only clear if NOT persistent mode
        if (!this.persistentBackgroundMode) {
          this.stopBackgroundMonitoring();
        }
        return;
      }

      // Buffer flush: Check if signals are in buffer/unprocessed
      if (this.signalBuffer.length > 0) {
        console.info('[Monitor] Flushing signal buffer ('+this.signalBuffer.length+') on interval resume...');
        for (const buffered of [...this.signalBuffer]) {
          await this.processAndMarkSignal(buffered);
        }
        this.signalBuffer = [];
      }

      // Use only cached signals!
      await this.checkSignalsInBackground();
    }, 1000);
  }

  stopBackgroundMonitoring(force: boolean = false) {
    // Only allow stopping if NOT persistent mode, or forced (on cleanup)
    if (!force && this.persistentBackgroundMode) {
      console.log("[Monitor] Persistent mode is ON; will not stop background monitoring.");
      return;
    }
    if (this.backgroundCheckInterval) {
      console.log('🚀 Stopping background monitoring for instance:', this.instanceId);
      clearInterval(this.backgroundCheckInterval);
      this.backgroundCheckInterval = null;
    }
    globalBackgroundManager.stopBackgroundMonitoring(this.instanceId);
  }

  // Buffer and recover signals if processing window missed
  private async processAndMarkSignal(signal: Signal) {
    // Atomic, logged, retried; ensure only our signal is updated
    try {
      await this.atomicallyMarkSignalAsTriggered(signal);
    } catch (err) {
      // Buffer for future retry if atomic update fails
      this.signalBuffer.push(signal);
      console.error("[Monitor] Failed to atomically mark buffered signal; re-buffering for next cycle", signal, err);
    }
  }

  // Update ONLY specific triggered signal atomically in storage
  private async atomicallyMarkSignalAsTriggered(signalToMark: Signal) {
    let attempts = 0;
    let success = false;
    let lastError: any = null;
    while (attempts < 5 && !success) {
      attempts++;
      try {
        // Get fresh signals from storage to ensure valid state
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
          await globalBackgroundManager.withStorageLock(() =>
            saveSignalsToStorage(freshSignals)
          );
          // Validation step
          const afterSave = await globalBackgroundManager.withStorageLock(() => 
            loadSignalsFromStorage()
          );
          const verify = afterSave[updateIdx]?.triggered;
          if (!verify) {
            lastError = 'Trigger verification failed at index';
            throw new Error('Signal state not updated after save');
          }
          success = true;
          console.info('[Monitor] Atomically marked triggered:', signalToMark.timestamp, '(attempt', attempts, ')');
        } else if (updateIdx >= 0 && freshSignals[updateIdx].triggered) {
          // Already triggered by elsewhere
          success = true;
        } else {
          // Signal not found - could be recent cleanup, recovery needed
          lastError = 'Signal missing after attempted update';
          throw new Error('Signal missing from storage');
        }
      } catch (err) {
        lastError = err;
        console.warn('[Monitor] Atomic signal save failed, will retry (attempt', attempts, ')', err);
        await new Promise(res => setTimeout(res, 20 * attempts)); // quick backoff
      }
    }
    if (!success) {
      // Critical recovery: log, re-buffer for retry, add to failing list
      this.signalBuffer.push(signalToMark);
      console.error('[Monitor] CRITICAL: Failed to atomically trigger signal after retries, RE-BUFFERED for recovery:', signalToMark.timestamp, lastError);
    }
  }

  // Helper: Consistency check between cache and actual storage
  private async verifyCacheConsistency() {
    const actualSignals = await globalBackgroundManager.withStorageLock(() => Promise.resolve(loadSignalsFromStorage()));
    if (JSON.stringify(actualSignals) !== JSON.stringify(this.cachedSignals)) {
      console.warn('[Monitor][Consistency] Signal cache/stored signals diverged!', {
        cache: this.cachedSignals,
        storage: actualSignals,
      });
      // Auto-recover cache
      this.updateCache(actualSignals);
      return false;
    }
    return true;
  }

  // IMPORTANT: Use only the cache!
  private async checkSignalsInBackground() {
    try {
      this.isProcessingSignals = true;
      this.metrics.cacheHits++;
      // Consistency check before processing
      await this.verifyCacheConsistency();

      const signals = this.cachedSignals;
      if (!signals || signals.length === 0) {
        this.isProcessingSignals = false;
        return;
      }

      // Remove buffer items which are now marked triggered
      this.signalBuffer = this.signalBuffer.filter(
        buffered =>
          !signals.find(
            s =>
              s.timeframe === buffered.timeframe &&
              s.asset === buffered.asset &&
              s.timestamp === buffered.timestamp &&
              s.direction === buffered.direction &&
              s.triggered // remove if triggered
          )
      );

      const antidelaySeconds = loadAntidelayFromStorage();
      const now = new Date();

      // Track which signals should be triggered
      const signalsToTrigger: Signal[] = [];
      // ----- Expand timing window and handle boundary edge cases -----
      signals.forEach((signal) => {
        const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
        const acquired = globalSignalProcessingLock.lockSignal(signalKey);
        if (!acquired) return;
        try {
          if (this.signalProcessingLock.has(signalKey)) return;

          // Use new robust time check (5s tolerance, drift compensating)
          if (checkSignalTime(signal, antidelaySeconds, 5) && !signal.triggered) {
            // Additional hour-boundary and duplicate protection
            const targetTime = getSignalTargetTime(signal, antidelaySeconds);
            // If target time is in the past more than the tolerance window, skip (prevents double by late interval)
            if (now.getTime() - targetTime.getTime() > 2 * 5000) return;

            this.signalProcessingLock.add(signalKey);
            this.metrics.signalTriggers++;
            console.log('🚀 Signal should trigger in background (robust):', signal);

            try {
              await this.notificationManager.triggerBackgroundNotification(signal);
            } catch (e) {
              console.warn('[Monitor] Notification failed for signal:', signal, e);
            }
            try {
              await this.audioManager.playBackgroundAudio(signal);
            } catch (e) {
              console.warn('[Monitor] Audio failed for signal:', signal, e);
            }

            signalsToTrigger.push(signal);

            setTimeout(() => {
              this.signalProcessingLock.delete(signalKey);
            }, 2000);
          }
        } finally {
          globalSignalProcessingLock.unlockSignal(signalKey);
        }
      });
      // Atomically update only relevant signals, handle each independently and recover if failed
      for (const triggeredSignal of signalsToTrigger) {
        await this.processAndMarkSignal(triggeredSignal);
      }
      if (signalsToTrigger.length > 0) {
        // Force cache update for all listeners
        window.dispatchEvent(new Event('signals-storage-update'));
      }
      // Run consistency check after triggers too
      await this.verifyCacheConsistency();
      this.isProcessingSignals = false;
    } catch (error) {
      this.isProcessingSignals = false;
      // Fallback buffer all non-triggered signals if process fails
      if (this.cachedSignals?.length) {
        for (const s of this.cachedSignals.filter(si => !si.triggered)) {
          if (!this.signalBuffer.find(buf =>
            buf.timeframe === s.timeframe &&
            buf.asset === s.asset &&
            buf.timestamp === s.timestamp &&
            buf.direction === s.direction
          )) {
            this.signalBuffer.push(s);
          }
        }
      }
      console.error('🚀 [Error] checking signals in background (signals buffered for retry):', error);
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
