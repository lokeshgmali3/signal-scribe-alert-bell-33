
import { Signal } from '@/types/signal';
import { loadAntidelayFromStorage, saveSignalsToStorage, loadSignalsFromStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { MonitoringMetricsManager } from './monitoringMetrics';
import { SignalCacheManager } from './signalCacheManager';
import { SignalTriggerManager } from './signalTriggerManager';
import { SignalTimingManager } from './signalTimingManager';

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
  private instanceId: string;
  private audioOnlyMode: boolean;

  private metricsManager: MonitoringMetricsManager;
  private cacheManager: SignalCacheManager;
  private triggerManager: SignalTriggerManager;
  private timingManager: SignalTimingManager;

  constructor(
    instanceId: string,
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager
  ) {
    this.instanceId = instanceId;
    this.audioOnlyMode = getAudioOnlyMode();
    
    this.metricsManager = new MonitoringMetricsManager();
    this.cacheManager = new SignalCacheManager(this.metricsManager);
    this.triggerManager = new SignalTriggerManager(
      notificationManager,
      audioManager,
      this.metricsManager,
      this.audioOnlyMode
    );
    this.timingManager = new SignalTimingManager();
  }

  cleanup(): void {
    this.stopBackgroundMonitoring();
    this.triggerManager.cleanup();
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

    this.timingManager.reset();

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

      this.timingManager.checkForTimerDrift();

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
        if (
          this.timingManager.shouldTriggerSignalWithTolerance(signal, antidelaySeconds, now) &&
          !signal.triggered
        ) {
          const triggered = await this.triggerManager.processSignalTrigger(signal);
          if (triggered) {
            signalsToTrigger.push(signal);
          }
        }
      }

      if (this.timingManager.isThrottleDetected() && signals) {
        const recoveryNow = new Date();
        for (const signal of signals) {
          if (!signal.triggered) {
            const shouldTrigger = this.timingManager.shouldTriggerSignalWithTolerance(signal, antidelaySeconds, recoveryNow);
            if (shouldTrigger) {
              console.warn('[Recovery] Missed signal detected (timer drift), catching up audio:', signal);
              const triggered = await this.triggerManager.processSignalTrigger(signal);
              if (triggered) {
                signalsToTrigger.push(signal);
              }
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

  isActive(): boolean {
    return !!this.backgroundCheckInterval;
  }

  getProcessingSignals(): string[] {
    return this.triggerManager.getProcessingSignals();
  }

  getMetrics() {
    return this.metricsManager.getMetrics();
  }

  setAudioOnlyMode(mode: boolean): void {
    this.audioOnlyMode = mode;
    this.triggerManager.setAudioOnlyMode(mode);
    setAudioOnlyMode(mode);
  }

  getAudioOnlyMode(): boolean {
    return this.audioOnlyMode;
  }
}
