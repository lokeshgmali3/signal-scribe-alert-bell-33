
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';

export class AppStateManager {
  private instanceId: string;
  private isAppActive = true;
  private appStateListenerInitialized = false;
  private listenerCleanupFunctions: (() => void)[] = [];
  private notificationManager: BackgroundNotificationManager;

  constructor(instanceId: string, notificationManager: BackgroundNotificationManager) {
    this.instanceId = instanceId;
    this.notificationManager = notificationManager;
  }

  async setupAppStateListeners(): Promise<void> {
    if (this.appStateListenerInitialized) return;

    console.log('🚀 Setting up app state listeners for instance:', this.instanceId);
    
    // Clean up any existing listeners first
    this.cleanupListeners();
    
    try {
      const appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        console.log('🚀 App state changed. Active:', isActive, 'Instance:', this.instanceId);
        this.isAppActive = isActive;
      });

      const notificationListener = await LocalNotifications.addListener('localNotificationActionPerformed', 
        async (notification) => {
          console.log('🚀 Notification action performed:', notification);
          await this.notificationManager.triggerHapticFeedback();
        }
      );

      this.listenerCleanupFunctions.push(
        () => appStateListener.remove(),
        () => notificationListener.remove()
      );

      globalBackgroundManager.addListener();
      globalBackgroundManager.addListener();
      
      this.appStateListenerInitialized = true;
    } catch (error) {
      console.error('🚀 Error setting up app state listeners:', error);
    }
  }

  private cleanupListeners(): void {
    console.log('🚀 Cleaning up existing listeners for instance:', this.instanceId);
    this.listenerCleanupFunctions.forEach(cleanup => cleanup());
    this.listenerCleanupFunctions = [];
  }

  cleanup(): void {
    this.cleanupListeners();
    globalBackgroundManager.removeListener();
    globalBackgroundManager.removeListener();
  }

  isAppStateListenerInitialized(): boolean {
    return this.appStateListenerInitialized;
  }

  getIsAppActive(): boolean {
    return this.isAppActive;
  }
}
