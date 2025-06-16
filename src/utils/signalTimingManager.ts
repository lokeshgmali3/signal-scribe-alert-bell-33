
import { Signal } from '@/types/signal';

export class SignalTimingManager {
  private static readonly SIGNAL_TRIGGER_WINDOW_MS = 5000; // Increased to 5 seconds for better reliability
  private lastCheckTime: number | null = null;
  private throttleDetected: boolean = false;
  private driftAccumMs: number = 0;
  private consecutiveThrottleCount: number = 0;

  checkForTimerDrift(): void {
    const now = Date.now();
    if (this.lastCheckTime !== null) {
      const elapsed = now - this.lastCheckTime;
      if (elapsed > 2000) { // More sensitive throttle detection
        this.throttleDetected = true;
        this.consecutiveThrottleCount++;
        this.driftAccumMs += elapsed - 1000;
        console.warn(
          `[Monitor] Timer drift/throttle detected! Interval ms:`,
          elapsed,
          'Total drift:',
          this.driftAccumMs,
          'Consecutive:',
          this.consecutiveThrottleCount
        );
      } else {
        // Reset consecutive count if timing is normal
        this.consecutiveThrottleCount = 0;
      }
    }
    this.lastCheckTime = now;
  }

  shouldTriggerSignalWithTolerance(signal: Signal, antidelaySeconds: number, now: Date): boolean {
    if (signal.triggered) return false;

    const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
    const signalDate = new Date(now);
    signalDate.setHours(signalHours, signalMinutes, 0, 0);

    const targetTime = new Date(signalDate.getTime() - antidelaySeconds * 1000);

    if (
      signalDate.getHours() !== signalHours ||
      isNaN(signalHours) || isNaN(signalMinutes)
    ) {
      return false;
    }

    const diff = Math.abs(now.getTime() - targetTime.getTime());
    
    // Use larger window if throttling has been detected
    const windowMs = this.throttleDetected ? 
      SignalTimingManager.SIGNAL_TRIGGER_WINDOW_MS * 2 : 
      SignalTimingManager.SIGNAL_TRIGGER_WINDOW_MS;
    
    return diff < windowMs;
  }

  isThrottleDetected(): boolean {
    return this.throttleDetected || this.consecutiveThrottleCount > 2;
  }

  getThrottleInfo(): { detected: boolean; driftMs: number; consecutiveCount: number } {
    return {
      detected: this.throttleDetected,
      driftMs: this.driftAccumMs,
      consecutiveCount: this.consecutiveThrottleCount
    };
  }

  reset(): void {
    this.lastCheckTime = null;
    this.throttleDetected = false;
    this.driftAccumMs = 0;
    this.consecutiveThrottleCount = 0;
    console.log('[Monitor] Timer drift detection reset');
  }
}
