
import { useState, useRef } from 'react';
import { Signal } from '@/types/signal';
import { playCustomRingtone } from '@/utils/audioUtils';
import { requestWakeLock, releaseWakeLock } from '@/utils/wakeLockUtils';

// WARNING: All automatic signal triggering is handled by background (BackgroundSignalProcessor)!
// This hook now only exposes manual ring-off control for UI.
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

  const audioInstancesRef = useRef<HTMLAudioElement[]>([]);
  const audioContextsRef = useRef<AudioContext[]>([]);

  // When background triggers a ring, it should inform the UI via new triggered signals/props

  // Manual "ring off" (stop all audio + cleanup, UI button)
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

    setIsRinging(false);
    setCurrentRingingSignal(null);
    releaseWakeLock(wakeLock);
    setWakeLock(null);
  };

  return {
    isRinging,
    currentRingingSignal,
    ringOffButtonPressed,
    handleRingOff
  };
};
