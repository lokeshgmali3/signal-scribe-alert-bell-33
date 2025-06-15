
import { useState, useEffect, useRef } from 'react';
import { Signal } from '@/types/signal';
import { checkSignalTime } from '@/utils/signalUtils';
import { playCustomRingtone } from '@/utils/audioUtils';
import { requestWakeLock, releaseWakeLock } from '@/utils/wakeLockUtils';
import { saveSignalsToStorage } from '@/utils/signalStorage';

export const useRingManager = (
  savedSignals: Signal[],
  antidelaySeconds: number,
  onSignalTriggered: (signal: Signal) => void,
  customRingtone: string | null
) => {
  const [isRinging, setIsRinging] = useState(false);
  const [currentRingingSignal, setCurrentRingingSignal] = useState<Signal | null>(null);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [ringOffButtonPressed, setRingOffButtonPressed] = useState(false);
  const [triggeredSignals, setTriggeredSignals] = useState<Set<string>>(new Set());

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioInstancesRef = useRef<HTMLAudioElement[]>([]);
  const audioContextsRef = useRef<AudioContext[]>([]);

  // Only run interval if tab is visible
  useEffect(() => {
    const handleVisibility = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (
        document.visibilityState === 'visible' &&
        savedSignals.length > 0
      ) {
        intervalRef.current = setInterval(() => {
          const now = new Date();
          savedSignals.forEach(signal => {
            if (checkSignalTime(signal, antidelaySeconds) && !signal.triggered) {
              const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
              if (!triggeredSignals.has(signalKey)) {
                triggerRing(signal, customRingtone);
              }
            }
          });
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    // run initially in case already not visible
    handleVisibility();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [savedSignals, customRingtone, antidelaySeconds, triggeredSignals]);

  // Reset triggered signals if the savedSignals array changes
  useEffect(() => {
    setTriggeredSignals(new Set());
  }, [savedSignals]);

  const triggerRing = async (signal: Signal, currentCustomRingtone: string | null) => {
    const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;

    if (triggeredSignals.has(signalKey) || signal.triggered) {
      return;
    }

    // Only allow ringing if app is visible
    if (document.visibilityState !== "visible") {
      return;
    }

    setTriggeredSignals(prev => new Set(prev).add(signalKey));
    setIsRinging(true);
    setCurrentRingingSignal(signal);

    const lock = await requestWakeLock();
    setWakeLock(lock);

    try {
      const audio = await playCustomRingtone(currentCustomRingtone, audioContextsRef);
      if (audio instanceof HTMLAudioElement) {
        audioInstancesRef.current.push(audio);
        setTimeout(() => {
          if (audio && !audio.paused) {
            audio.pause();
            audio.currentTime = 0;
          }
        }, 10000);
      }
    } catch (error) {
      // do nothing
    }

    signal.triggered = true;
    onSignalTriggered(signal);

    // Save the updated signals array to localStorage
    const updatedSignals = savedSignals.map(s =>
      s.timestamp === signal.timestamp ? { ...s, triggered: true } : s
    );
    saveSignalsToStorage(updatedSignals);

    setTimeout(() => {
      setIsRinging(false);
      setCurrentRingingSignal(null);
      releaseWakeLock(wakeLock);
      setWakeLock(null);
    }, 10000);
  };

  const handleRingOff = () => {
    setRingOffButtonPressed(true);
    setTimeout(() => setRingOffButtonPressed(false), 200);

    audioInstancesRef.current.forEach((audio) => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    audioInstancesRef.current = [];

    audioContextsRef.current.forEach((context) => {
      if (context && context.state !== 'closed') {
        context.close().catch(() => {});
      }
    });
    audioContextsRef.current = [];

    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });

    if (isRinging) {
      setIsRinging(false);
      setCurrentRingingSignal(null);
      releaseWakeLock(wakeLock);
      setWakeLock(null);
    }
  };

  return {
    isRinging,
    currentRingingSignal,
    ringOffButtonPressed,
    handleRingOff
  };
};
