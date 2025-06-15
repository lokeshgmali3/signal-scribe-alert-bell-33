
import React, { useState, useCallback } from 'react';
import { globalSignalProcessingLock } from '../utils/globalSignalProcessingLock';

// Use a global variable in the window to coordinate between foreground and background.
export function useGlobalSignalProcessingLock() {
  const [locked, setLocked] = useState(globalSignalProcessingLock.getGlobalLock());

  // Listen for lock changes
  React.useEffect(() => {
    const handle = () => setLocked(globalSignalProcessingLock.getGlobalLock());
    window.addEventListener("globalSignalLockUpdate", handle);
    return () => window.removeEventListener("globalSignalLockUpdate", handle);
  }, []);

  // Attempt to acquire signal lock (returns true if successful)
  const lockSignal = useCallback((signalKey: string) => {
    return globalSignalProcessingLock.lockSignal(signalKey);
  }, []);

  // Release signal lock (only if owned)
  const unlockSignal = useCallback((signalKey: string) => {
    globalSignalProcessingLock.unlockSignal(signalKey);
  }, []);

  return {
    currentLock: locked,
    lockSignal,
    unlockSignal,
  };
}
