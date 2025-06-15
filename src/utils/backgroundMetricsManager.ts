
export class BackgroundMetricsManager {
  private lastCheckTime: number | null = null;
  private throttleDetected: boolean = false;
  private driftAccumMs: number = 0;

  checkForThrottling(): void {
    const now = Date.now();
    if (this.lastCheckTime !== null) {
      const elapsed = now - this.lastCheckTime;
      if (elapsed > 1500) {
        this.throttleDetected = true;
        this.driftAccumMs += elapsed - 1000;
        console.warn(
          `[Metrics] Timer drift/throttle detected! Interval ms:`,
          elapsed,
          'Total drift:',
          this.driftAccumMs
        );
      }
    }
    this.lastCheckTime = now;
  }

  hasThrottleDetected(): boolean {
    return this.throttleDetected;
  }

  resetThrottleDetection(): void {
    this.throttleDetected = false;
  }

  getMetrics() {
    return {
      lastCheckTime: this.lastCheckTime,
      throttleDetected: this.throttleDetected,
      driftAccumMs: this.driftAccumMs
    };
  }

  reset(): void {
    this.lastCheckTime = null;
    this.throttleDetected = false;
    this.driftAccumMs = 0;
  }
}
