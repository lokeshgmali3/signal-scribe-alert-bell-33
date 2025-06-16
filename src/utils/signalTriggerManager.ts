
import { Signal } from '@/types/signal';
import { globalSignalProcessingLock } from './globalSignalProcessingLock';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { MonitoringMetricsManager } from './monitoringMetrics';

export class SignalTriggerManager {
  private signalProcessingLock = new Set<string>();
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;
  private metricsManager: MonitoringMetricsManager;
  private audioOnlyMode: boolean;

  constructor(
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager,
    metricsManager: MonitoringMetricsManager,
    audioOnlyMode: boolean
  ) {
    this.notificationManager = notificationManager;
    this.audioManager = audioManager;
    this.metricsManager = metricsManager;
    this.audioOnlyMode = audioOnlyMode;
  }

  setAudioOnlyMode(mode: boolean): void {
    this.audioOnlyMode = mode;
  }

  async processSignalTrigger(signal: Signal): Promise<boolean> {
    const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
    const acquired = globalSignalProcessingLock.lockSignal(signalKey);
    if (!acquired) return false;

    try {
      if (this.signalProcessingLock.has(signalKey)) {
        return false;
      }

      this.signalProcessingLock.add(signalKey);
      this.metricsManager.incrementSignalTriggers();
      console.log('🚀 Signal should trigger in background:', signal);

      if (!this.audioOnlyMode) {
        await this.notificationManager.triggerBackgroundNotification(signal);
      }
      await this.audioManager.playBackgroundAudio(signal);

      setTimeout(() => {
        this.signalProcessingLock.delete(signalKey);
      }, 2000);

      return true;
    } finally {
      globalSignalProcessingLock.unlockSignal(signalKey);
    }
  }

  getProcessingSignals(): string[] {
    return Array.from(this.signalProcessingLock);
  }

  cleanup(): void {
    this.signalProcessingLock.clear();
  }
}
