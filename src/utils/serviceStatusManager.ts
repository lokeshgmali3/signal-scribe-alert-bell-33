
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundMonitoringManager } from './backgroundMonitoringManager';
import { AppStateManager } from './appStateManager';

export class ServiceStatusManager {
  private instanceId: string;
  private audioManager: BackgroundAudioManager;
  private notificationManager: BackgroundNotificationManager;
  private monitoringManager: BackgroundMonitoringManager;
  private appStateManager: AppStateManager;

  constructor(
    instanceId: string,
    audioManager: BackgroundAudioManager,
    notificationManager: BackgroundNotificationManager,
    monitoringManager: BackgroundMonitoringManager,
    appStateManager: AppStateManager
  ) {
    this.instanceId = instanceId;
    this.audioManager = audioManager;
    this.notificationManager = notificationManager;
    this.monitoringManager = monitoringManager;
    this.appStateManager = appStateManager;
  }

  debugBackgroundStatus(): any {
    const status = {
      instanceId: this.instanceId,
      appActive: this.appStateManager.getIsAppActive(),
      audio: this.audioManager.getAudioInfo(),
      notifIDs: this.notificationManager.getNotificationIds(),
      bgMonitorActive: this.monitoringManager.isActive(),
      globalStatus: globalBackgroundManager.getStatus()
    };
    console.log('[DEBUG STATUS] Background service:', status);
    (window as any).bgServiceDebug = status;
    return status;
  }

  getStatus(): any {
    return this.debugBackgroundStatus();
  }
}
