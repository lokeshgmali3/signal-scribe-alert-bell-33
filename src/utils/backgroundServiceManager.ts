
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { globalBackgroundManager } from './globalBackgroundManager';

export class BackgroundServiceManager {
  private instanceId: string;
  private isAppActive = true;
  private appStateListenerInitialized = false;
  private listenerCleanupFunctions: (() => void)[] = [];

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  async setupAppStateListeners() {
    console.log('🚀 Setting up app state listeners for instance:', this.instanceId);
    
    this.cleanupListeners();
    
    try {
      const appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        console.log('🚀 App state changed. Active:', isActive, 'Instance:', this.instanceId);
        this.isAppActive = isActive;
      });

      const notificationListener = await LocalNotifications.addListener('localNotificationActionPerformed', 
        async (notification) => {
          console.log('🚀 Notification action performed:', notification);
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

  private cleanupListeners() {
    console.log('🚀 Cleaning up existing listeners for instance:', this.instanceId);
    this.listenerCleanupFunctions.forEach(cleanup => cleanup());
    this.listenerCleanupFunctions = [];
  }

  async cleanup() {
    try {
      this.cleanupListeners();
      globalBackgroundManager.removeListener();
      globalBackgroundManager.removeListener();
      console.log('🚀 Service manager cleaned up for instance:', this.instanceId);
    } catch (error) {
      console.error('🚀 Error cleaning up service manager:', error);
    }
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  isAppStateListenerInitialized(): boolean {
    return this.appStateListenerInitialized;
  }

  getAppActiveState(): boolean {
    return this.isAppActive;
  }
}
