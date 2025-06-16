
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage } from './signalStorage';
import { MonitoringMetricsManager } from './monitoringMetrics';

export class SignalCacheManager {
  private cachedSignals: Signal[] = [];
  private metricsManager: MonitoringMetricsManager;
  private signalsListenerRegistered: boolean = false;

  constructor(metricsManager: MonitoringMetricsManager) {
    this.metricsManager = metricsManager;
    this.initCache();
    this.registerSignalsListener();
  }

  private initCache(): void {
    this.cachedSignals = loadSignalsFromStorage();
    this.metricsManager.incrementCacheVersion();
    this.metricsManager.incrementStorageLoads();
    console.info('[Monitor] Signals loaded into cache. (Loads:', 
      this.metricsManager.getMetrics().storageLoads, 
      'Version:', this.metricsManager.getMetrics().cacheVersion, ')', 
      this.cachedSignals);
  }

  updateCache(newSignals: Signal[]): void {
    this.cachedSignals = Array.isArray(newSignals) ? [...newSignals] : [];
    this.metricsManager.incrementCacheVersion();
    this.metricsManager.incrementCacheInvalidations();
    console.info(`[Monitor] Signal cache updated (ver ${this.metricsManager.getMetrics().cacheVersion}, invalidations: ${this.metricsManager.getMetrics().cacheInvalidations})`, 
      this.cachedSignals);
  }

  private registerSignalsListener(): void {
    if (this.signalsListenerRegistered) return;
    window.addEventListener('signals-storage-update', this.handleSignalsUpdate);
    this.signalsListenerRegistered = true;
  }

  private unregisterSignalsListener(): void {
    if (this.signalsListenerRegistered) {
      window.removeEventListener('signals-storage-update', this.handleSignalsUpdate);
      this.signalsListenerRegistered = false;
    }
  }

  private handleSignalsUpdate = (): void => {
    this.metricsManager.incrementStorageLoads();
    const updatedSignals = loadSignalsFromStorage();
    this.updateCache(updatedSignals);
    console.info('[Monitor] Cache reloaded after storage update (Loads:', 
      this.metricsManager.getMetrics().storageLoads, ')');
  };

  getCachedSignals(): Signal[] {
    this.metricsManager.incrementCacheHits();
    return this.cachedSignals;
  }

  cleanup(): void {
    this.unregisterSignalsListener();
  }
}
