
import { useEffect } from 'react';
import { 
  startBackgroundTask, 
  stopBackgroundTask, 
  scheduleAllSignalNotifications 
} from '@/utils/backgroundTaskManager';
import { useSignalState } from './useSignalState';
import { useRingManager } from './useRingManager';
import { useAntidelayManager } from './useAntidelayManager';
import { useAudioManager } from './useAudioManager';

export const useSignalTracker = () => {
  const {
    signalsText,
    setSignalsText,
    savedSignals,
    antidelaySeconds,
    setAntidelaySeconds,
    saveButtonPressed,
    handleSaveSignals,
    updateSignalTriggered
  } = useSignalState();

  // Single audio manager instance to be shared
  const audioManager = useAudioManager();

  const {
    ringOffButtonPressed,
    handleRingOff
  } = useRingManager(savedSignals, antidelaySeconds, updateSignalTriggered, audioManager.customRingtone);

  const {
    showAntidelayDialog,
    showSoundDialog,
    antidelayInput,
    setAntidelayInput,
    setRingButtonPressed,
    handleSetRingMouseDown,
    handleSetRingMouseUp,
    handleSetRingMouseLeave,
    handleSelectCustomSound,
    handleSelectDefaultSound,
    handleCloseSoundDialog,
    handleAntidelaySubmit,
    handleAntidelayCancel
  } = useAntidelayManager(savedSignals, antidelaySeconds, setAntidelaySeconds, audioManager);

  // Start background task when app loads and signals exist
  useEffect(() => {
    if (savedSignals.length > 0) {
      startBackgroundTask();
      scheduleAllSignalNotifications(savedSignals);
      
      // Register service worker for background sync
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'REGISTER_BACKGROUND_SYNC'
        });
      }
    }

    return () => {
      stopBackgroundTask();
    };
  }, [savedSignals]);

  return {
    signalsText,
    setSignalsText,
    saveButtonPressed,
    ringOffButtonPressed,
    setRingButtonPressed,
    showAntidelayDialog,
    showSoundDialog,
    antidelayInput,
    setAntidelayInput,
    antidelaySeconds,
    handleRingOff,
    handleSaveSignals,
    handleSetRingMouseDown,
    handleSetRingMouseUp,
    handleSetRingMouseLeave,
    handleSelectCustomSound,
    handleSelectDefaultSound,
    handleCloseSoundDialog,
    handleAntidelaySubmit,
    handleAntidelayCancel
  };
};
