
import { BackgroundServiceCore } from './backgroundServiceCore';

class BackgroundService {
  private static instance: BackgroundService | null = null;
  private core: BackgroundServiceCore;

  constructor() {
    this.core = new BackgroundServiceCore();
  }

  static getInstance(): BackgroundService {
    if (!BackgroundService.instance) {
      BackgroundService.instance = new BackgroundService();
    }
    return BackgroundService.instance;
  }

  // Delegate all methods to core
  async initialize() {
    return this.core.initialize();
  }

  setCustomRingtone(ringtone: string | null) {
    return this.core.setCustomRingtone(ringtone);
  }

  async cacheCustomAudio(base64: string, mimeType: string) {
    return this.core.cacheCustomAudio(base64, mimeType);
  }

  clearCustomAudio() {
    return this.core.clearCustomAudio();
  }

  async playBackgroundAudio(signal?: any) {
    return this.core.playBackgroundAudio(signal);
  }

  async scheduleAllSignals(signals: any[]) {
    return this.core.scheduleAllSignals(signals);
  }

  async cancelAllScheduledNotifications() {
    return this.core.cancelAllScheduledNotifications();
  }

  async cleanup() {
    return this.core.cleanup();
  }

  getStatus() {
    return this.core.getStatus();
  }
}

export const backgroundService = BackgroundService.getInstance();
