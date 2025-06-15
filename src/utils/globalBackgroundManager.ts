
// Global singleton to coordinate all background monitoring activities
class GlobalBackgroundManager {
  private static instance: GlobalBackgroundManager | null = null;
  private isBackgroundMonitoringActive = false;
  private activeInstanceId: string | null = null;
  private listenerCount = 0;
  private storageOperationLock = false;
  private storageVersion = 0;

  static getInstance(): GlobalBackgroundManager {
    if (!GlobalBackgroundManager.instance) {
      GlobalBackgroundManager.instance = new GlobalBackgroundManager();
    }
    return GlobalBackgroundManager.instance;
  }

  generateInstanceId(): string {
    return `bg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  canStartBackgroundMonitoring(instanceId: string): boolean {
    if (!this.isBackgroundMonitoringActive) {
      this.isBackgroundMonitoringActive = true;
      this.activeInstanceId = instanceId;
      console.log('🌍 Global: Background monitoring started by instance:', instanceId);
      return true;
    }
    
    if (this.activeInstanceId === instanceId) {
      console.log('🌍 Global: Instance already owns background monitoring:', instanceId);
      return true;
    }
    
    console.log('🌍 Global: Background monitoring blocked for instance:', instanceId, 'active instance:', this.activeInstanceId);
    return false;
  }

  stopBackgroundMonitoring(instanceId: string): void {
    if (this.activeInstanceId === instanceId) {
      this.isBackgroundMonitoringActive = false;
      this.activeInstanceId = null;
      console.log('🌍 Global: Background monitoring stopped by instance:', instanceId);
    } else {
      console.log('🌍 Global: Stop request ignored from non-owner instance:', instanceId);
    }
  }

  getStatus() {
    return {
      isActive: this.isBackgroundMonitoringActive,
      activeInstanceId: this.activeInstanceId,
      listenerCount: this.listenerCount
    };
  }

  addListener(): void {
    this.listenerCount++;
    console.log('🌍 Global: Listener added, total count:', this.listenerCount);
  }

  removeListener(): void {
    this.listenerCount = Math.max(0, this.listenerCount - 1);
    console.log('🌍 Global: Listener removed, total count:', this.listenerCount);
  }

  async withStorageLock<T>(operation: () => Promise<T> | T): Promise<T> {
    while (this.storageOperationLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.storageOperationLock = true;
    try {
      const result = await operation();
      this.storageVersion++;
      return result;
    } finally {
      this.storageOperationLock = false;
    }
  }

  getStorageVersion(): number {
    return this.storageVersion;
  }
}

export const globalBackgroundManager = GlobalBackgroundManager.getInstance();
