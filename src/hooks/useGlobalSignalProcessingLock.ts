
import React, { useState, useCallback } from 'react';

// Use a global variable in the window to coordinate between foreground and background.
// This triggers across hooks and contexts in the current tab/app.
type ProcessingLockState = {
  signalKey: string | null;
  timestamp: number | null;
};

function getGlobalLock(): ProcessingLockState {
  return (window as any).__globalSignalProcessingLock || { signalKey: null, timestamp: null };
}

function setGlobalLock(lock: ProcessingLockState) {
  (window as any).__globalSignalProcessingLock = lock;
  window.dispatchEvent(new Event("globalSignalLockUpdate"));
}

export function useGlobalSignalProcessingLock() {
  const [locked, setLocked] = useState(getGlobalLock());

  // Listen for lock changes
  React.useEffect(() => {
    const handle = () => setLocked(getGlobalLock());
    window.addEventListener("globalSignalLockUpdate", handle);
    return () => window.removeEventListener("globalSignalLockUpdate", handle);
  }, []);

  // Attempt to acquire signal lock (returns true if successful)
  const lockSignal = useCallback((signalKey: string) => {
    const curr = getGlobalLock();
    if (!curr.signalKey) {
      setGlobalLock({ signalKey, timestamp: Date.now() });
      return true;
    }
    return false;
  }, []);

  // Release signal lock (only if owned)
  const unlockSignal = useCallback((signalKey: string) => {
    const curr = getGlobalLock();
    if (curr.signalKey === signalKey) {
      setGlobalLock({ signalKey: null, timestamp: null });
    }
  }, []);

  return {
    currentLock: locked,
    lockSignal,
    unlockSignal,
  };
}
