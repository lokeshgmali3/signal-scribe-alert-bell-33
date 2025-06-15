
import { useEffect } from 'react';
import { useSignalState } from './useSignalState';
import { useRingManager } from './useRingManager';
import { useAntidelayManager } from './useAntidelayManager';
import { useAudioManager } from './useAudioManager';
import { toast } from "@/hooks/use-toast";

function hasNotificationPermission(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted";
}

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

  // Watch for foreground alerts fallback if notification permission denied
  useEffect(() => {
    if (!hasNotificationPermission()) {
      // Listen for signal triggers on foreground (user returned). Could be improved to listen to actual events
      const handleAppForeground = () => {
        // This is a naive example, you should trigger this toast _when_ you would send a native notification but can't
        toast({
          title: "⚠️ Notification Blocked",
          description: "Cannot send background signal alert - notifications are disabled. Please enable them for best experience.",
        });
      };
      window.addEventListener("signal-alert-fallback", handleAppForeground);
      return () => window.removeEventListener("signal-alert-fallback", handleAppForeground);
    }
  }, []);

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
