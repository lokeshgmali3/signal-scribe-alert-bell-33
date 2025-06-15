
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { BackgroundCacheManager } from './backgroundCacheManager';
import { BackgroundSignalProcessor } from './backgroundSignalProcessor';
import { BackgroundMetricsManager } from './backgroundMetricsManager';

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

  private cacheManager: BackgroundCacheManager;
  private signalProcessor: BackgroundSignalProcessor;
  private metricsManager: BackgroundMetricsManager;

  constructor(
    instanceId: string,
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager
  ) {
    this.instanceId = instanceId;
    this.audioOnlyMode = getAudioOnlyMode();
    
    this.cacheManager = new BackgroundCacheManager();
    this.metricsManager = new BackgroundMetricsManager();
    this.signalProcessor = new BackgroundSignalProcessor(
      instanceId,
      notificationManager,
      audioManager,
      this.cacheManager,
      this.audioOnlyMode
    );
  }

  cleanup() {
    this.stopBackgroundMonitoring();
    this.signalProcessor.cleanup();
    this.cacheManager.cleanup();
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

    this.cacheManager.invalidateCache();

    console.log(
      '🚀 Starting background monitoring for instance:',
      this.instanceId,
      'Audio only mode:',
      this.audioOnlyMode
    );

    this.metricsManager.reset();

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

      this.metricsManager.checkForThrottling();

      if (globalBackgroundManager.getStatus().activeInstanceId !== this.instanceId) {
        console.warn(
          `⛔ [${this.instanceId}] Not owning monitoring. Interval auto-clearing. Current owner: ${globalBackgroundManager.getStatus().activeInstanceId}`
        );
        this.stopBackgroundMonitoring();
        return;
      }

      await this.signalProcessor.processSignals();
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

  isActive(): boolean {
    return !!this.backgroundCheckInterval;
  }

  getProcessingSignals(): string[] {
    return this.signalProcessor.getProcessingSignals();
  }

  getMetrics() {
    return {
      ...this.cacheManager.getMetrics(),
      ...this.metricsManager.getMetrics(),
      signalTriggers: this.signalProcessor.getTriggerCount()
    };
  }

  setAudioOnlyMode(mode: boolean) {
    this.audioOnlyMode = mode;
    this.signalProcessor.setAudioOnlyMode(mode);
    setAudioOnlyMode(mode);
  }

  getAudioOnlyMode() {
    return this.audioOnlyMode;
  }
}
