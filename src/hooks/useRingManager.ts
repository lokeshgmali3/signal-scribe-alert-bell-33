
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

  console.log('useRingManager - Current customRingtone:', customRingtone);

  // Reset triggered signals when savedSignals change (new signals loaded)
  useEffect(() => {
    setTriggeredSignals(new Set());
  }, [savedSignals]);

  // Ring notification
  const triggerRing = async (signal: Signal, currentCustomRingtone: string | null) => {
    const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
    
    // Check if this specific signal has already been triggered this session
    if (triggeredSignals.has(signalKey) || signal.triggered) {
      return; // Don't trigger again
    }

    console.log('Triggering ring for signal:', signal, 'with customRingtone:', currentCustomRingtone);
    
    // Mark this signal as triggered in our local set
    setTriggeredSignals(prev => new Set(prev).add(signalKey));
    
    setIsRinging(true);
    setCurrentRingingSignal(signal);
    
    // Wake up screen if supported
    const lock = await requestWakeLock();
    setWakeLock(lock);

    // Wake up screen on mobile by trying to focus the window
    if (document.hidden) {
      window.focus();
    }

    // Play custom ringtone or default beep and track audio instances
    const audio = await playCustomRingtone(currentCustomRingtone, audioContextsRef);
    if (audio instanceof HTMLAudioElement) {
      audioInstancesRef.current.push(audio);
      
      // Auto-stop after 10 seconds to prevent infinite loop
      setTimeout(() => {
        if (audio && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
      }, 10000);
    }

    // Mark signal as triggered in the main state
    onSignalTriggered(signal);
    
    // Auto-stop ringing after 10 seconds
    setTimeout(() => {
      setIsRinging(false);
      setCurrentRingingSignal(null);
      releaseWakeLock(wakeLock);
      setWakeLock(null);
    }, 10000);
  };

  // Check signals every second for precise timing
  useEffect(() => {
    if (savedSignals.length > 0) {
      intervalRef.current = setInterval(() => {
        savedSignals.forEach(signal => {
          if (checkSignalTime(signal, antidelaySeconds) && !signal.triggered) {
            const signalKey = `${signal.timestamp}-${signal.asset}-${signal.direction}`;
            if (!triggeredSignals.has(signalKey)) {
              triggerRing(signal, customRingtone);
            }
          }
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [savedSignals, customRingtone, antidelaySeconds, triggeredSignals]);

  // Ring off button handler - stops ALL audio immediately
  const handleRingOff = () => {
    setRingOffButtonPressed(true);
    setTimeout(() => setRingOffButtonPressed(false), 200);
    
    // Stop ALL audio instances immediately
    audioInstancesRef.current.forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    audioInstancesRef.current = [];
    
    // Stop ALL Web Audio API contexts
    audioContextsRef.current.forEach(context => {
      if (context && context.state !== 'closed') {
        context.close().catch(err => console.log('Audio context cleanup error:', err));
      }
    });
    audioContextsRef.current = [];
    
    // Additional cleanup: Stop any remaining audio elements on the page
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    
    // Stop ringing if currently ringing
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
