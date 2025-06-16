import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { globalSignalProcessingLock } from './globalSignalProcessingLock';

const AUDIO_ONLY_MODE_KEY = 'audioOnlyMode';

function getAudioOnlyMode(): boolean {
  try {
    // Defaults to false for backward compatibility
    return localStorage.getItem(AUDIO_ONLY_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}
function setAudioOnlyMode(val: boolean) {
  try {
    localStorage.setItem(AUDIO_ONLY_MODE_KEY, val ? 'true' : 'false');
  } catch {}
}

export class BackgroundMonitoringManager {
  private backgroundCheckInterval: NodeJS.Timeout | null = null;
  private signalProcessingLock = new Set<string>();
  private instanceId: string;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private audioOnlyMode: boolean;

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

  // Tolerance for trigger (seconds)
  private static readonly SIGNAL_TRIGGER_WINDOW_MS = 3000; // 3 seconds

  private lastCheckTime: number | null = null;
  private throttleDetected: boolean = false;
  private driftAccumMs: number = 0;

  constructor(
    instanceId: string,
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager
  ) {
    this.instanceId = instanceId;
    this.notificationManager = notificationManager;
    this.audioManager = audioManager;
    this.audioOnlyMode = getAudioOnlyMode();
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

    // ← Make monitoring persistent. Do NOT stop in foreground.

    console.log(
      '🚀 Starting background monitoring for instance:',
      this.instanceId,
      'Audio only mode:',
      this.audioOnlyMode
    );
    // Store the last interval timestamp to detect throttling/drift
    this.lastCheckTime = null;
    this.throttleDetected = false;
    this.driftAccumMs = 0;

    // --- Aggressive wake lock handling ---
    const attemptAcquireWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          // @ts-ignore
          await navigator.wakeLock.request("screen");
          // let the lock auto-release or be recovered
        }
      } catch { /* Ignore errors, not all browsers support */ }
    };

    this.backgroundCheckInterval = setInterval(async () => {
      await attemptAcquireWakeLock();

      const now = Date.now();
      if (this.lastCheckTime !== null) {
        const elapsed = now - this.lastCheckTime;
        if (elapsed > 1500) {
          // Browser likely throttled this timer; report (for debug only)
          this.throttleDetected = true;
          this.driftAccumMs += elapsed - 1000;
          console.warn(
            `[Monitor] Timer drift/throttle detected! Interval ms:`,
            elapsed,
            'Total drift:',
            this.driftAccumMs
          );
        }
      }
      this.lastCheckTime = now;

      if (globalBackgroundManager.getStatus().activeInstanceId !== this.instanceId) {
        console.warn(
          `⛔ [${this.instanceId}] Not owning monitoring. Interval auto-clearing. Current owner: ${globalBackgroundManager.getStatus().activeInstanceId}`
        );
        this.stopBackgroundMonitoring();
        return;
      }
      await this.checkSignalsInBackground();
    }, 1000); // Keep a 1s base tick; the window adjustment is in trigger logic below
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

  // Use an expanded trigger window and log if miss
  private async checkSignalsInBackground() {
    try {
      this.metrics.cacheHits++;
      const signals = this.cachedSignals;
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
          if (this.signalProcessingLock.has(signalKey)) {
            continue;
          }
          if (
            this.shouldTriggerSignalWithTolerance(signal, antidelaySeconds, now) &&
            !signal.triggered
          ) {
            this.signalProcessingLock.add(signalKey);
            this.metrics.signalTriggers++;
            console.log('🚀 Signal should trigger in background:', signal);

            // --- AUDIO ONLY MODE: skip notification
            if (!this.audioOnlyMode) {
              await this.notificationManager.triggerBackgroundNotification(signal);
            }
            await this.audioManager.playBackgroundAudio(signal);

            signalsToTrigger.push(signal);

            setTimeout(() => {
              this.signalProcessingLock.delete(signalKey);
            }, 2000);
          }
        } finally {
          globalSignalProcessingLock.unlockSignal(signalKey);
        }
      }

      // --- Recovery sweep: trigger any signals missed in the last interval up to 2 minutes back
      // (browser wake/sleep - triggers recovery for up to 120 sec missed)
      if (this.throttleDetected && signals) {
        const recoveryNow = new Date();
        for (const signal of signals) {
          if (!signal.triggered) {
            const triggered = this.shouldTriggerSignalWithTolerance(signal, antidelaySeconds, recoveryNow);
            if (triggered) {
              // Optionally re-trigger missed signal audio
              console.warn('[Recovery] Missed signal detected (timer drift), catching up audio:', signal);
              await this.audioManager.playBackgroundAudio(signal); // Beep/audio only, do not re-notify
              signalsToTrigger.push(signal);
            }
          }
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

  // Expanded trigger window with drift/tolerance (primary change for reliability)
  private shouldTriggerSignalWithTolerance(signal: Signal, antidelaySeconds: number, now: Date): boolean {
    if (signal.triggered) return false;

    // Parse time and create date objects
    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
    const signalDate = new Date(now);
    signalDate.setHours(signalHours, signalMinutes, 0, 0);

    // Subtract antidelay
    const targetTime = new Date(signalDate.getTime() - antidelaySeconds * 1000);

    // Handle hour boundary wrap-around robustly
    if (
      signalDate.getHours() !== signalHours ||
      isNaN(signalHours) || isNaN(signalMinutes)
    ) {
      // Error parsing signal, skip triggering
      return false;
    }

    // DRIFT WINDOW: Use ABS diff to allow for delayed ticks and throttling
    const diff = Math.abs(now.getTime() - targetTime.getTime());
    if (diff < BackgroundMonitoringManager.SIGNAL_TRIGGER_WINDOW_MS) {
      return true;
    }

    // Optional: drift detection for debug
    if (diff < 30_000 && !signal.triggered) {
      // If within 30s but outside trigger window, log that the window was missed due to drift
      // (could be used for missed-signal recovery/future improvement)
      // console.log(`[Monitor] Missed trigger window for signal`, signal, 'by', diff, 'ms');
    }
    return false;
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

  setAudioOnlyMode(mode: boolean) {
    this.audioOnlyMode = mode;
    setAudioOnlyMode(mode);
  }
  getAudioOnlyMode() {
    return this.audioOnlyMode;
  }
}
