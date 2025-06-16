
export interface MonitoringMetrics {
  storageLoads: number;
  cacheHits: number;
  cacheInvalidations: number;
  signalTriggers: number;
  cacheVersion: number;
}

export class MonitoringMetricsManager {
  private metrics: MonitoringMetrics = {
    storageLoads: 0,
    cacheHits: 0,
    cacheInvalidations: 0,
    signalTriggers: 0,
    cacheVersion: 0
  };

  incrementStorageLoads(): void {
    this.metrics.storageLoads++;
  }

  incrementCacheHits(): void {
    this.metrics.cacheHits++;
  }

  incrementCacheInvalidations(): void {
    this.metrics.cacheInvalidations++;
  }

  incrementSignalTriggers(): void {
    this.metrics.signalTriggers++;
  }

  incrementCacheVersion(): void {
    this.metrics.cacheVersion++;
  }

  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      storageLoads: 0,
      cacheHits: 0,
      cacheInvalidations: 0,
      signalTriggers: 0,
      cacheVersion: 0
    };
  }
}
