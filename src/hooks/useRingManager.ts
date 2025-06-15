
import { useState, useEffect, useRef } from 'react';
import { Signal } from '@/types/signal';
import { checkSignalTime } from '@/utils/signalUtils';
import { playCustomRingtone } from '@/utils/audioUtils';
import { requestWakeLock, releaseWakeLock } from '@/utils/wakeLockUtils';

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

  console.log('🔔 useRingManager - Current customRingtone:', customRingtone ? 'custom' : 'default');

  useEffect(() => {
    setTriggeredSignals(new Set());
    console.log('🔔 Ring Manager - Reset triggered signals for new signal set');
  }, [savedSignals]);

  const triggerRing = async (signal: Signal, currentCustomRingtone: string | null) => {
    const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
    
    if (triggeredSignals.has(signalKey) || signal.triggered) {
      console.log('🔔 Signal already triggered, skipping:', signalKey);
      return;
    }

    console.log('🔔 Triggering ring for signal:', signal, 'with customRingtone:', currentCustomRingtone ? 'custom' : 'default');
    console.log('🔔 Document visibility state:', document.visibilityState);
    console.log('🔔 Page hidden:', document.hidden);
    
    setTriggeredSignals(prev => new Set(prev).add(signalKey));
    setIsRinging(true);
    setCurrentRingingSignal(signal);
    
    const lock = await requestWakeLock();
    setWakeLock(lock);

    if (document.hidden) {
      console.log('🔔 Page is hidden, trying to focus window');
      window.focus();
    }

    try {
      const audio = await playCustomRingtone(currentCustomRingtone, audioContextsRef);
      if (audio instanceof HTMLAudioElement) {
        audioInstancesRef.current.push(audio);
        console.log('🔔 Audio instance added, total instances:', audioInstancesRef.current.length);
        
        setTimeout(() => {
          if (audio && !audio.paused) {
            console.log('🔔 Auto-stopping audio after 10 seconds');
            audio.pause();
            audio.currentTime = 0;
          }
        }, 10000);
      }
    } catch (error) {
      console.error('🔔 Error playing ringtone:', error);
    }

    onSignalTriggered(signal);
    
    setTimeout(() => {
      console.log('🔔 Auto-stopping ring after 10 seconds');
      setIsRinging(false);
      setCurrentRingingSignal(null);
      releaseWakeLock(wakeLock);
      setWakeLock(null);
    }, 10000);
  };

  useEffect(() => {
    if (savedSignals.length > 0) {
      console.log('🔔 Setting up signal checking interval for', savedSignals.length, 'signals');
      
      intervalRef.current = setInterval(() => {
        const now = new Date();
        
        savedSignals.forEach(signal => {
          if (checkSignalTime(signal, antidelaySeconds) && !signal.triggered) {
            const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
            if (!triggeredSignals.has(signalKey)) {
              console.log('🔔 Signal time matched, triggering ring:', signal.timestamp);
              triggerRing(signal, customRingtone);
            }
          }
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          console.log('🔔 Signal checking interval cleared');
        }
      };
    }
  }, [savedSignals, customRingtone, antidelaySeconds, triggeredSignals]);

  const handleRingOff = () => {
    console.log('🔔 Ring off button pressed - stopping all audio');
    setRingOffButtonPressed(true);
    setTimeout(() => setRingOffButtonPressed(false), 200);
    
    audioInstancesRef.current.forEach((audio, index) => {
      if (audio) {
        console.log('🔔 Stopping audio instance', index);
        audio.pause();
        audio.currentTime = 0;
      }
    });
    audioInstancesRef.current = [];
    
    audioContextsRef.current.forEach((context, index) => {
      if (context && context.state !== 'closed') {
        console.log('🔔 Closing audio context', index);
        context.close().catch(err => console.log('🔔 Audio context cleanup error:', err));
      }
    });
    audioContextsRef.current = [];
    
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    console.log('🔔 Stopped all page audio elements:', allAudioElements.length);
    
    if (isRinging) {
      setIsRinging(false);
      setCurrentRingingSignal(null);
      releaseWakeLock(wakeLock);
      setWakeLock(null);
      console.log('🔔 Ring state cleared');
    }
  };

  return {
    isRinging,
    currentRingingSignal,
    ringOffButtonPressed,
    handleRingOff
  };
};
