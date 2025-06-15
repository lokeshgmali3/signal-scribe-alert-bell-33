
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
    timingDrifts: 0,
    recoveryTriggered: 0,
    missedTriggers: 0
  };
  private signalsListenerRegistered: boolean = false;

  // Persistent and recovery state
  private persistentBackgroundMode = true;
  private missedSignalsBuffer: Signal[] = [];
  private isProcessingSignals = false;
  private lastIntervalTime: number | null = null;

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
    this.stopBackgroundMonitoring(true); // force stop always for cleanup
    this.signalProcessingLock.clear();
    this.unregisterSignalsListener();
    this.missedSignalsBuffer = [];
  }

  /**
   * Always persistent: don't stop background monitoring automatically.
   */
  startBackgroundMonitoring() {
    if (!globalBackgroundManager.canStartBackgroundMonitoring(this.instanceId)) {
      console.log('🚀 Background monitoring blocked by global manager for instance:', this.instanceId);
      return;
    }
    this.persistentBackgroundMode = true;

    if (this.backgroundCheckInterval) {
      console.log('🚀 Background monitoring already active for this instance:', this.instanceId);
      return;
    }
    // Initial cache load always
    this.initCache();
    // Start tracking interval time for drift detection
    this.lastIntervalTime = Date.now();

    console.log('🚀 Starting background monitoring for instance:', this.instanceId);

    this.backgroundCheckInterval = setInterval(async () => {
      // TIMING DRIFT DETECTION (detect browser throttling/backgrounded tabs)
      const now = Date.now();
      if (this.lastIntervalTime && now - this.lastIntervalTime > 2000) {
        // More than 2 seconds, signal timing drift or throttling
        this.metrics.timingDrifts++;
        console.warn('[Monitor] Timing drift detected!', {
          expected: this.lastIntervalTime + 1000,
          actual: now,
          driftMs: now - (this.lastIntervalTime + 1000)
        });
      }
      this.lastIntervalTime = now;

      // Always persist, no auto stop!
      if (globalBackgroundManager.getStatus().activeInstanceId !== this.instanceId) {
        console.warn(
          `⛔ [${this.instanceId}] Not owning monitoring. Interval auto-clearing. Current owner: ${globalBackgroundManager.getStatus().activeInstanceId}`
        );
        if (!this.persistentBackgroundMode) {
          this.stopBackgroundMonitoring();
        }
        return;
      }

      // Missed signals recovery for timing compensation missed due to throttling/standby
      this.recoverMissedSignals();

      // Use only cached signals!
      await this.checkSignalsInBackground();
    }, 1000);
  }

  /**
   * Stopping only allowed when persistentBackgroundMode is off, or if forced.
   */
  stopBackgroundMonitoring(force: boolean = false) {
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

  // Helper: For external events, trigger missed recovery
  public recoverMissedSignals() {
    // Missed detection: Find signals not triggered that should have gone off already (max 3s past now), but not more than 20s (late)
    const signals = this.cachedSignals;
    const antidelaySeconds = loadAntidelayFromStorage();
    const now = new Date();
    let recovered = 0;
    signals.forEach(signal => {
      const key = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
      const shouldHaveTriggered = this.robustShouldTriggerSignal(signal, antidelaySeconds, now, 3);
      if (shouldHaveTriggered && !signal.triggered && !this.signalProcessingLock.has(key)) {
        // Buffer for recovery
        this.metrics.missedTriggers++;
        this.missedSignalsBuffer.push(signal);
        recovered++;
      }
    });
    if (recovered > 0) {
      this.metrics.recoveryTriggered += recovered;
      console.warn(`[Monitor] ${recovered} missed signals detected and buffered for recovery.`);
    }
  }

  /**
   * Robust/atomic only mark as triggered for a signal in storage.
   */
  private async atomicallyMarkSignalAsTriggered(signalToMark: Signal) {
    try {
      let attempts = 0;
      let success = false;
      while (attempts < 5 && !success) {
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
            // Save checks
            const afterSave = loadSignalsFromStorage();
            const verify = afterSave[updateIdx]?.triggered;
            if (!verify) {
              throw new Error('Signal not marked as triggered after save');
            }
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
        console.error('[Monitor] Failed to atomically trigger signal after retries:', signalToMark.timestamp);
      }
    } catch (error) {
      console.error('[Monitor] Atomic trigger error:', error);
    }
  }

  // --- Robust Signal Timing Logic: expands to 3-second tolerance, robust hour boundary handling, and accepts recovery ---
  private robustShouldTriggerSignal(signal: Signal, antidelaySeconds: number, now: Date, toleranceSeconds: number = 3): boolean {
    if (signal.triggered) return false;

    // Parse signal timestamp
    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);

    // Build today's date with hour/min
    const signalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), signalHours, signalMinutes, 0, 0);

    // Tolerate hour boundary and day roll (e.g., prev hour goes over midnight), check +1/-1 window
    let candidateTimes: Date[] = [signalDate];

    // Handle hour wrap: if now < threshold, check previous day (23:59 to 00:00)
    if (Math.abs(now.getTime() - signalDate.getTime()) > toleranceSeconds * 1000) {
      // Might be at the edge: add roll-forward and roll-back 1 hour at edge
      candidateTimes.push(new Date(signalDate.getTime() - 60 * 60 * 1000)); // one hour back
      candidateTimes.push(new Date(signalDate.getTime() + 60 * 60 * 1000)); // one hour forward
    }

    for (const testTime of candidateTimes) {
      // Subtract antidelay
      const target = new Date(testTime.getTime() - antidelaySeconds * 1000);
      const timeDiff = Math.abs(now.getTime() - target.getTime());
      if (timeDiff < toleranceSeconds * 1000) {
        return true;
      }
    }
    return false;
  }

  // Main check, expanded for timing window and robust system, includes recovery buffer for missed signals
  private async checkSignalsInBackground() {
    try {
      this.isProcessingSignals = true;
      this.metrics.cacheHits++;
      const signals = this.cachedSignals;
      if (!signals || signals.length === 0) {
        this.isProcessingSignals = false;
        return;
      }
      const antidelaySeconds = loadAntidelayFromStorage();
      const now = new Date();

      // Remove signals from missed recovery buffer that are now triggered
      this.missedSignalsBuffer = this.missedSignalsBuffer.filter(
        missed =>
          !signals.some(
            s => s.timeframe === missed.timeframe && s.asset === missed.asset && s.timestamp === missed.timestamp && s.direction === missed.direction && s.triggered
          )
      );

      // --- Step 1: Attempt missed signals recovery before normal scan ---
      for (const missedSignal of [...this.missedSignalsBuffer]) {
        const key = `${missedSignal.timestamp}-${missedSignal.asset}-${missedSignal.direction}`;
        if (!missedSignal.triggered && !this.signalProcessingLock.has(key)) {
          console.info('[Monitor] Re-processing missed signal:', missedSignal);
          await this.processSignal(missedSignal, antidelaySeconds, now, { skipDuplicate: true }); // Only process if still not triggered
        }
      }
      // Reset buffer
      this.missedSignalsBuffer = [];

      // --- Step 2: Normal scan, with robust tolerance, hour boundary, anti-race ---
      for (const signal of signals) {
        await this.processSignal(signal, antidelaySeconds, now);
      }

      this.isProcessingSignals = false;
    } catch (error) {
      this.isProcessingSignals = false;
      console.error('🚀 Error checking signals in background:', error);
    }
  }

  // Process a given signal (robust tolerance, single trigger), atomic/lock/duplicate prevent
  private async processSignal(signal: Signal, antidelaySeconds: number, now: Date, opts: { skipDuplicate?: boolean } = {}) {
    const key = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
    const acquired = globalSignalProcessingLock.lockSignal(key);
    if (!acquired) return;
    try {
      if (this.signalProcessingLock.has(key)) return;
      // If asked to skip duplicates, exit if triggered in latest cache
      if (opts.skipDuplicate) {
        const freshSignals = loadSignalsFromStorage();
        const found = freshSignals.find(
          s =>
            s.timeframe === signal.timeframe &&
            s.asset === signal.asset &&
            s.timestamp === signal.timestamp &&
            s.direction === signal.direction
        );
        if (!found || found.triggered) return;
      }
      // Robust time check, 3s window, boundary safety
      if (this.robustShouldTriggerSignal(signal, antidelaySeconds, now, 3) && !signal.triggered) {
        this.signalProcessingLock.add(key);
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
        // Mark as triggered atomically
        await this.atomicallyMarkSignalAsTriggered(signal);

        setTimeout(() => {
          this.signalProcessingLock.delete(key);
        }, 2000);
      }
    } finally {
      globalSignalProcessingLock.unlockSignal(key);
    }
  }

  isActive(): boolean {
    return !!this.backgroundCheckInterval;
  }

  getProcessingSignals(): string[] {
    return Array.from(this.signalProcessingLock);
  }

  // PERF and diagnostic info
  getMetrics() {
    return { ...this.metrics, cacheVersion: this.cacheVersion };
  }
}
