
export type ProcessingLockState = {
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

// Attempt to acquire signal lock (returns true if successful)
function lockSignal(signalKey: string): boolean {
  const curr = getGlobalLock();
  if (!curr.signalKey) {
    setGlobalLock({ signalKey, timestamp: Date.now() });
    return true;
  }
  return false;
}

// Release signal lock (only if owned)
function unlockSignal(signalKey: string): void {
  const curr = getGlobalLock();
  if (curr.signalKey === signalKey) {
    setGlobalLock({ signalKey: null, timestamp: null });
  }
}

export const globalSignalProcessingLock = {
  getGlobalLock,
  setGlobalLock,
  lockSignal,
  unlockSignal,
};
