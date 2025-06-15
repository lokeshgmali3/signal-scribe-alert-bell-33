
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

export const checkSignalTime = (signal: Signal, antidelaySeconds: number = 0): boolean => {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  
  // Parse signal timestamp
  const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
  
  // Calculate target time with antidelay
  const signalDate = new Date();
  signalDate.setHours(signalHours, signalMinutes, 0, 0);
  
  // Subtract antidelay seconds
  const targetTime = new Date(signalDate.getTime() - (antidelaySeconds * 1000));
  const targetHours = targetTime.getHours();
  const targetMinutes = targetTime.getMinutes();
  const targetSeconds = targetTime.getSeconds();
  
  // Check if current time exactly matches target time (precise to the second)
  const timeMatches = currentHours === targetHours && 
                     currentMinutes === targetMinutes && 
                     currentSeconds === targetSeconds;
  
  return timeMatches && !signal.triggered;
};

export const calculateSignalTiming = (signal: Signal, antidelaySeconds: number, currentTime: Date = new Date()) => {
  const [signalHours, signalMinutes] = signal.timestamp.split(':').map(Number);
  const signalDate = new Date();
  signalDate.setHours(signalHours, signalMinutes, 0, 0);
  
  const targetTime = new Date(signalDate.getTime() - (antidelaySeconds * 1000));
  const timeDiff = Math.abs(currentTime.getTime() - targetTime.getTime());
  
  return {
    signalTime: signalDate,
    targetTime,
    currentTime,
    timeDiff,
    timeDiffSeconds: timeDiff / 1000,
    shouldTrigger: timeDiff <= 3000 && !signal.triggered, // 3 second tolerance
    debugInfo: {
      signal: signal.timestamp,
      target: targetTime.toISOString(),
      current: currentTime.toISOString(),
      diffMs: timeDiff,
      diffSec: (timeDiff / 1000).toFixed(2),
      triggered: signal.triggered
    }
  };
};

export const getSignalDebugInfo = (signals: Signal[], antidelaySeconds: number) => {
  const now = new Date();
  return signals.map(signal => {
    const timing = calculateSignalTiming(signal, antidelaySeconds, now);
    const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
    
    return {
      signalKey,
      signal,
      timing,
      status: signal.triggered ? 'triggered' : timing.shouldTrigger ? 'ready' : 'waiting'
    };
  });
};
