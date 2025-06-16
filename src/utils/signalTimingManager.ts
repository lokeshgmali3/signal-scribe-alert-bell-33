
import { Signal } from '@/types/signal';

export class SignalTimingManager {
  private static readonly SIGNAL_TRIGGER_WINDOW_MS = 3000; // 3 seconds
  private lastCheckTime: number | null = null;
  private throttleDetected: boolean = false;
  private driftAccumMs: number = 0;

  checkForTimerDrift(): void {
    const now = Date.now();
    if (this.lastCheckTime !== null) {
      const elapsed = now - this.lastCheckTime;
      if (elapsed > 1500) {
        this.throttleDetected = true;
        this.driftAccumMs += elapsed - 1000;
        console.warn(
          `[Monitor] Timer drift/throttle detected! Interval ms:`,
          elapsed,
          'Total drift:',
          this.driftAccumMs
        );
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
    return diff < SignalTimingManager.SIGNAL_TRIGGER_WINDOW_MS;
  }

  isThrottleDetected(): boolean {
    return this.throttleDetected;
  }

  reset(): void {
    this.lastCheckTime = null;
    this.throttleDetected = false;
    this.driftAccumMs = 0;
  }
}
