
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage } from './signalStorage';

export class BackgroundCacheManager {
  private cachedSignals: Signal[] = [];
  private cacheVersion: number = 0;
  private metrics = {
    storageLoads: 0,
    cacheHits: 0,
    cacheInvalidations: 0,
  };
  private signalsListenerRegistered: boolean = false;

  constructor() {
    this.initCache();
    this.registerSignalsListener();
  }

  private initCache() {
    this.cachedSignals = loadSignalsFromStorage();
    this.cacheVersion++;
    this.metrics.storageLoads++;
    console.info('[Cache] Signals loaded into cache. (Loads:', this.metrics.storageLoads, 'Version:', this.cacheVersion, ')', this.cachedSignals);
  }

  private updateCache(newSignals: Signal[]) {
    this.cachedSignals = Array.isArray(newSignals) ? [...newSignals] : [];
    this.cacheVersion++;
    this.metrics.cacheInvalidations++;
    console.info(`[Cache] Signal cache updated (ver ${this.cacheVersion}, invalidations: ${this.metrics.cacheInvalidations})`, this.cachedSignals);
  }

  private registerSignalsListener() {
    if (this.signalsListenerRegistered) return;
    window.addEventListener('signals-storage-update', this.handleSignalsUpdate);
    this.signalsListenerRegistered = true;
  }

  private unregisterSignalsListener() {
    if (this.signalsListenerRegistered) {
      window.removeEventListener('signals-storage-update', this.handleSignalsUpdate);
      this.signalsListenerRegistered = false;
    }
  }

  private handleSignalsUpdate = () => {
    this.metrics.storageLoads++;
    const updatedSignals = loadSignalsFromStorage();
    this.updateCache(updatedSignals);
    console.info('[Cache] Cache reloaded after storage update (Loads:', this.metrics.storageLoads, ')');
  };

  getCachedSignals(): Signal[] {
    this.metrics.cacheHits++;
    return this.cachedSignals;
  }

  invalidateCache() {
    this.initCache();
  }

  cleanup() {
    this.unregisterSignalsListener();
  }

  getMetrics() {
    return { ...this.metrics, cacheVersion: this.cacheVersion };
  }
}
