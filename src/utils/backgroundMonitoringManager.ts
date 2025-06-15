
import { Signal } from '@/types/signal';
import { loadSignalsFromStorage, loadAntidelayFromStorage, saveSignalsToStorage } from './signalStorage';
import { globalBackgroundManager } from './globalBackgroundManager';
import { BackgroundNotificationManager } from './backgroundNotificationManager';
import { BackgroundAudioManager } from './backgroundAudioManager';
import { globalSignalProcessingLock } from './globalSignalProcessingLock';

interface SignalProcessingResult {
  signalKey: string;
  success: boolean;
  reason: string;
  targetTime: Date;
  currentTime: Date;
  timeDiff: number;
}

interface SignalDetectionStatus {
  signalKey: string;
  lastChecked: Date;
  status: 'pending' | 'triggered' | 'missed' | 'error';
  attempts: number;
  lastError?: string;
}

export class BackgroundMonitoringManager {
  private backgroundCheckInterval: NodeJS.Timeout | null = null;
  private signalProcessingLock = new Set<string>();
  private instanceId: string;
  private notificationManager: BackgroundNotificationManager;
  private audioManager: BackgroundAudioManager;

  // === CACHE & PERF ===
  private cachedSignals: Signal[] = [];
  private cacheVersion: number = 0;
  private metrics = {
    storageLoads: 0,
    cacheHits: 0,
    cacheInvalidations: 0,
    signalTriggers: 0,
    processingErrors: 0,
    signalsProcessed: 0,
  };
  private signalsListenerRegistered: boolean = false;

  // === SIGNAL STATE MANAGEMENT ===
  private signalDetectionStatus = new Map<string, SignalDetectionStatus>();
  private processingResults: SignalProcessingResult[] = [];
  private atomicUpdateLock = false;

  constructor(
    instanceId: string,
    notificationManager: BackgroundNotificationManager,
    audioManager: BackgroundAudioManager
  ) {
    this.instanceId = instanceId;
    this.notificationManager = notificationManager;
    this.audioManager = audioManager;
    this.initCache();
    this.registerSignalsListener();
  }

  private initCache() {
    this.cachedSignals = loadSignalsFromStorage();
    this.cacheVersion++;
    this.metrics.storageLoads++;
    this.initializeSignalDetectionStatus();
    console.info('[Monitor] Signals loaded into cache. (Loads:', this.metrics.storageLoads, 'Version:', this.cacheVersion, ')', this.cachedSignals);
  }

  private initializeSignalDetectionStatus() {
    this.signalDetectionStatus.clear();
    this.cachedSignals.forEach(signal => {
      const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
      this.signalDetectionStatus.set(signalKey, {
        signalKey,
        lastChecked: new Date(),
        status: signal.triggered ? 'triggered' : 'pending',
        attempts: 0
      });
    });
    console.info('[Monitor] Signal detection status initialized for', this.signalDetectionStatus.size, 'signals');
  }

  private updateCache(newSignals: Signal[]) {
    this.cachedSignals = Array.isArray(newSignals) ? [...newSignals] : [];
    this.cacheVersion++;
    this.metrics.cacheInvalidations++;
    this.initializeSignalDetectionStatus();
    console.info(`[Monitor] Signal cache updated (ver ${this.cacheVersion}, invalidations: ${this.metrics.cacheInvalidations})`, this.cachedSignals);
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
    console.info('[Monitor] Cache reloaded after storage update (Loads:', this.metrics.storageLoads, ')');
  };

  cleanup() {
    this.stopBackgroundMonitoring();
    this.signalProcessingLock.clear();
    this.signalDetectionStatus.clear();
    this.unregisterSignalsListener();
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
    
    this.initCache();
    console.log('🚀 Starting background monitoring for instance:', this.instanceId);
    
    this.backgroundCheckInterval = setInterval(async () => {
      if (globalBackgroundManager.getStatus().activeInstanceId !== this.instanceId) {
        console.warn(
          `⛔ [${this.instanceId}] Not owning monitoring. Interval auto-clearing. Current owner: ${globalBackgroundManager.getStatus().activeInstanceId}`
        );
        this.stopBackgroundMonitoring();
        return;
      }
      await this.checkSignalsInBackground();
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

  private async checkSignalsInBackground() {
    try {
      this.metrics.cacheHits++;
      const signals = this.cachedSignals;
      if (!signals || signals.length === 0) {
        return;
      }

      const antidelaySeconds = loadAntidelayFromStorage();
      const now = new Date();
      const processedSignals: Signal[] = [];
      const processingResults: SignalProcessingResult[] = [];

      console.debug(`[Monitor Debug] Checking ${signals.length} signals at ${now.toISOString()}`);

      for (const signal of signals) {
        const result = await this.processSignalIndependently(signal, antidelaySeconds, now);
        processingResults.push(result);
        
        if (result.success) {
          processedSignals.push(signal);
        }
      }

      // Atomic update of signals if any were processed
      if (processedSignals.length > 0) {
        await this.atomicSignalUpdate(signals);
      }

      // Log comprehensive debugging info
      this.logProcessingResults(processingResults, now);
      
    } catch (error) {
      this.metrics.processingErrors++;
      console.error('🚀 Error checking signals in background:', error);
    }
  }

  private async processSignalIndependently(signal: Signal, antidelaySeconds: number, now: Date): Promise<SignalProcessingResult> {
    const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
    
    try {
      this.metrics.signalsProcessed++;
      
      // Get detection status
      const detectionStatus = this.signalDetectionStatus.get(signalKey);
      if (detectionStatus) {
        detectionStatus.lastChecked = now;
        detectionStatus.attempts++;
      }

      // Calculate target time with debugging
      const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
      const signalDate = new Date();
      signalDate.setHours(signalHours, signalMinutes, 0, 0);
      const targetTime = new Date(signalDate.getTime() - (antidelaySeconds * 1000));
      const timeDiff = Math.abs(now.getTime() - targetTime.getTime());

      const result: SignalProcessingResult = {
        signalKey,
        success: false,
        reason: '',
        targetTime,
        currentTime: now,
        timeDiff
      };

      // Check if already triggered
      if (signal.triggered) {
        result.reason = 'Already triggered';
        if (detectionStatus) detectionStatus.status = 'triggered';
        return result;
      }

      // Try to acquire global lock
      const acquired = globalSignalProcessingLock.lockSignal(signalKey);
      if (!acquired) {
        result.reason = 'Global lock unavailable';
        return result;
      }

      try {
        // Check if already being processed by this instance
        if (this.signalProcessingLock.has(signalKey)) {
          result.reason = 'Already processing in this instance';
          return result;
        }

        // Check timing with extended tolerance (3 seconds)
        if (timeDiff > 3000) {
          result.reason = `Outside time window (${timeDiff}ms > 3000ms)`;
          return result;
        }

        // Signal should trigger
        this.signalProcessingLock.add(signalKey);
        this.metrics.signalTriggers++;
        
        console.log('🚀 Signal should trigger in background:', signal);
        console.debug(`[Signal Debug] ${signalKey}: Target=${targetTime.toISOString()}, Current=${now.toISOString()}, Diff=${timeDiff}ms`);

        // Trigger notifications and audio
        await this.notificationManager.triggerBackgroundNotification(signal);
        await this.audioManager.playBackgroundAudio(signal);

        // Mark as triggered
        signal.triggered = true;
        if (detectionStatus) detectionStatus.status = 'triggered';
        
        result.success = true;
        result.reason = 'Successfully triggered';
        
        console.log('🚀 Signal marked as triggered in background:', signal.timestamp);

        // Clean up processing lock after delay
        setTimeout(() => {
          this.signalProcessingLock.delete(signalKey);
        }, 2000);

      } finally {
        globalSignalProcessingLock.unlockSignal(signalKey);
      }

      return result;

    } catch (error) {
      this.metrics.processingErrors++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update detection status with error
      const detectionStatus = this.signalDetectionStatus.get(signalKey);
      if (detectionStatus) {
        detectionStatus.status = 'error';
        detectionStatus.lastError = errorMessage;
      }
      
      console.error(`🚀 Error processing signal ${signalKey}:`, error);
      
      return {
        signalKey,
        success: false,
        reason: `Error: ${errorMessage}`,
        targetTime: new Date(),
        currentTime: now,
        timeDiff: 0
      };
    }
  }

  private async atomicSignalUpdate(signals: Signal[]): Promise<void> {
    // Prevent concurrent updates
    while (this.atomicUpdateLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.atomicUpdateLock = true;
    try {
      console.log('🚀 Saving updated signals to storage after background trigger');
      await globalBackgroundManager.withStorageLock(() =>
        saveSignalsToStorage(signals)
      );
      window.dispatchEvent(new Event('signals-storage-update'));
    } finally {
      this.atomicUpdateLock = false;
    }
  }

  private logProcessingResults(results: SignalProcessingResult[], checkTime: Date) {
    const triggeredCount = results.filter(r => r.success).length;
    const pendingCount = results.filter(r => !r.success && r.reason !== 'Already triggered').length;
    
    if (triggeredCount > 0 || pendingCount > 0) {
      console.group(`[Monitor Results] ${checkTime.toLocaleTimeString()} - Triggered: ${triggeredCount}, Pending: ${pendingCount}`);
      
      results.forEach(result => {
        const timeDiffSeconds = (result.timeDiff / 1000).toFixed(1);
        const status = result.success ? '✅' : result.reason === 'Already triggered' ? '⏭️' : '⏳';
        
        console.log(`${status} ${result.signalKey}: ${result.reason} (${timeDiffSeconds}s diff)`);
        
        if (!result.success && result.reason !== 'Already triggered') {
          console.debug(`   Target: ${result.targetTime.toLocaleTimeString()}, Current: ${result.currentTime.toLocaleTimeString()}`);
        }
      });
      
      console.groupEnd();
    }

    // Log detection status summary every 30 seconds
    if (checkTime.getSeconds() % 30 === 0) {
      this.logDetectionStatusSummary();
    }
  }

  private logDetectionStatusSummary() {
    const statusCounts = {
      pending: 0,
      triggered: 0,
      missed: 0,
      error: 0
    };

    this.signalDetectionStatus.forEach(status => {
      statusCounts[status.status]++;
    });

    console.info('[Detection Summary]', statusCounts, 'Total metrics:', this.metrics);
  }

  isActive(): boolean {
    return !!this.backgroundCheckInterval;
  }

  getProcessingSignals(): string[] {
    return Array.from(this.signalProcessingLock);
  }

  getMetrics() {
    return { 
      ...this.metrics, 
      cacheVersion: this.cacheVersion,
      detectionStatusCount: this.signalDetectionStatus.size,
      processingResultsCount: this.processingResults.length
    };
  }

  getDetectionStatus(): Map<string, SignalDetectionStatus> {
    return new Map(this.signalDetectionStatus);
  }
}
