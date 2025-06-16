import { Signal } from '@/types/signal';
import { loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { globalSignalProcessingLock } from './globalSignalProcessingLock';
import { MonitoringMetricsManager } from './monitoringMetrics';
import { SignalCacheManager } from './signalCacheManager';

const AUDIO_ONLY_MODE_KEY = 'audioOnlyMode';

function getAudioOnlyMode(): boolean {
  try {
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

  private metricsManager: MonitoringMetricsManager;
  private cacheManager: SignalCacheManager;

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
    
    this.metricsManager = new MonitoringMetricsManager();
    this.cacheManager = new SignalCacheManager(this.metricsManager);
  }

  cleanup(): void {
    this.stopBackgroundMonitoring();
    this.signalProcessingLock.clear();
    this.cacheManager.cleanup();
  }

  startBackgroundMonitoring(): void {
    if (!globalBackgroundManager.canStartBackgroundMonitoring(this.instanceId)) {
      console.log('🚀 Background monitoring blocked by global manager for instance:', this.instanceId);
      return;
    }
    if (this.backgroundCheckInterval) {
      console.log('🚀 Background monitoring already active for this instance:', this.instanceId);
      return;
    }

    console.log(
      '🚀 Starting background monitoring for instance:',
      this.instanceId,
      'Audio only mode:',
      this.audioOnlyMode
    );

    this.lastCheckTime = null;
    this.throttleDetected = false;
    this.driftAccumMs = 0;

    const attemptAcquireWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          // @ts-ignore
          await navigator.wakeLock.request("screen");
        }
      } catch { /* Ignore errors, not all browsers support */ }
    };

    this.backgroundCheckInterval = setInterval(async () => {
      await attemptAcquireWakeLock();

      const now = Date.now();
      if (this.lastCheckTime !== null) {
        const elapsed = now - this.lastCheckTime;
        if (elapsed > 1500) {
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
    }, 1000);
  }

  stopBackgroundMonitoring(): void {
    if (this.backgroundCheckInterval) {
      console.log('🚀 Stopping background monitoring for instance:', this.instanceId);
      clearInterval(this.backgroundCheckInterval);
      this.backgroundCheckInterval = null;
    }
    globalBackgroundManager.stopBackgroundMonitoring(this.instanceId);
  }

  private async atomicallyMarkSignalAsTriggered(signalToMark: Signal): Promise<void> {
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
            console.info('[Monitor] Atomically marked triggered:', signalToMark.timestamp, '(attempt', attempts, ')');
          } catch (err) {
            console.warn('[Monitor] Save failed, will retry', attempts, err);
            await new Promise(res => setTimeout(res, 30 * attempts));
          }
        } else {
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

  private async checkSignalsInBackground(): Promise<void> {
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
          if (this.signalProcessingLock.has(signalKey)) {
            continue;
          }
          if (
            this.shouldTriggerSignalWithTolerance(signal, antidelaySeconds, now) &&
            !signal.triggered
          ) {
            this.signalProcessingLock.add(signalKey);
            this.metricsManager.incrementSignalTriggers();
            console.log('🚀 Signal should trigger in background:', signal);

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

      if (this.throttleDetected && signals) {
        const recoveryNow = new Date();
        for (const signal of signals) {
          if (!signal.triggered) {
            const triggered = this.shouldTriggerSignalWithTolerance(signal, antidelaySeconds, recoveryNow);
            if (triggered) {
              console.warn('[Recovery] Missed signal detected (timer drift), catching up audio:', signal);
              await this.audioManager.playBackgroundAudio(signal);
              signalsToTrigger.push(signal);
            }
          }
        }
      }

      for (const triggeredSignal of signalsToTrigger) {
        await this.atomicallyMarkSignalAsTriggered(triggeredSignal);
      }
      if (signalsToTrigger.length > 0) {
        window.dispatchEvent(new Event('signals-storage-update'));
      }
    } catch (error) {
      console.error('🚀 Error checking signals in background:', error);
    }
  }

  private shouldTriggerSignalWithTolerance(signal: Signal, antidelaySeconds: number, now: Date): boolean {
    if (signal.triggered) return false;

    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
    const signalDate = new Date(now);
    signalDate.setHours(signalHours, signalMinutes, 0, 0);

    const targetTime = new Date(signalDate.getTime() - antidelaySeconds * 1000);

    if (
      signalDate.getHours() !== signalHours ||
      isNaN(signalHours) || isNaN(signalMinutes)
    ) {
      return false;
    }

    const diff = Math.abs(now.getTime() - targetTime.getTime());
    if (diff < BackgroundMonitoringManager.SIGNAL_TRIGGER_WINDOW_MS) {
      return true;
    }

    return false;
  }

  isActive(): boolean {
    return !!this.backgroundCheckInterval;
  }

  getProcessingSignals(): string[] {
    return Array.from(this.signalProcessingLock);
  }

  getMetrics() {
    return this.metricsManager.getMetrics();
  }

  setAudioOnlyMode(mode: boolean): void {
    this.audioOnlyMode = mode;
    setAudioOnlyMode(mode);
  }

  getAudioOnlyMode(): boolean {
    return this.audioOnlyMode;
  }
}
