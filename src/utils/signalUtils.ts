import { Signal } from '@/types/signal';

export const parseSignals = (text: string): Signal[] => {
  const lines = text.split('\n').filter(line => line.trim());
  const signals: Signal[] = [];
  
  lines.forEach(line => {
    const parts = line.split(';');
    if (parts.length === 4) {
      const [timeframe, asset, timestamp, direction] = parts;
      if (timestamp.match(/^\d{2}:\d{2}$/)) {
        signals.push({
          timeframe: timeframe.trim(),
          asset: asset.trim(),
          timestamp: timestamp.trim(),
          direction: direction.trim(),
          triggered: false
        });
      }
    }
  });
  
  return signals;
};

/**
 * Calculates the absolute Date object when a signal should be triggered,
 * allowing robust handling of edge cases across midnight and hour boundaries.
 */
export const getSignalTargetTime = (signal: Signal, antidelaySeconds: number = 0): Date => {
  // current date/time
  const now = new Date();
  // Parse signal timestamp (hh:mm)
  const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
  // If parsing fails, fallback to now
  if (isNaN(signalHours) || isNaN(signalMinutes)) {
    return now;
  }
  const signalDate = new Date(now);
  signalDate.setHours(signalHours, signalMinutes, 0, 0);

  // If parsed time is more than 12 hours in the past, assume it's for the next day (crossed midnight boundary)
  if (signalDate.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
    signalDate.setDate(signalDate.getDate() + 1);
  }
  // Subtract antidelay
  const targetTime = new Date(signalDate.getTime() - antidelaySeconds * 1000);
  return targetTime;
};

/**
 * Checks if given signal falls within ±5 seconds of current time,
 * compensating for typical browser background throttling.
 * Returns true if signal should trigger now and is not already triggered.
 */
export const checkSignalTime = (
  signal: Signal,
  antidelaySeconds: number = 0,
  driftToleranceSeconds: number = 5
): boolean => {
  if (signal.triggered) return false;

  const now = new Date();
  const targetTime = getSignalTargetTime(signal, antidelaySeconds);

  // Calculate drift diff
  const diffMs = Math.abs(now.getTime() - targetTime.getTime());
  // Logging for debug and diagnosis
  if (diffMs < driftToleranceSeconds * 1000) {
    console.debug(
      `[TimeCheck] SIGNAL ${signal.timestamp} Δ${diffMs}ms (window ${driftToleranceSeconds}s) | now: ${now.toLocaleTimeString()} vs target: ${targetTime.toLocaleTimeString()}`
    );
  }
  // Signal triggers if within drift-tolerant window
  return diffMs < driftToleranceSeconds * 1000 && !signal.triggered;
};
