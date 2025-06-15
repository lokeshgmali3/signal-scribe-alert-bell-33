
import { Signal } from '@/types/signal';
import { globalBackgroundManager } from './globalBackgroundManager';

const SIGNALS_STORAGE_KEY = 'binary_signals';
const ANTIDELAY_STORAGE_KEY = 'antidelay_seconds';

export const saveSignalsToStorage = async (signals: Signal[]) => {
  try {
    await globalBackgroundManager.withStorageLock(() => {
      localStorage.setItem(SIGNALS_STORAGE_KEY, JSON.stringify(signals));
      console.log('Signals saved to localStorage:', signals);
    });
  } catch (error) {
    console.error('Failed to save signals to localStorage:', error);
  }
};

export const loadSignalsFromStorage = (): Signal[] => {
  try {
    const stored = localStorage.getItem(SIGNALS_STORAGE_KEY);
    if (stored) {
      const signals = JSON.parse(stored);
      console.log('Signals loaded from localStorage:', signals);
      return signals;
    }
  } catch (error) {
    console.error('Failed to load signals from localStorage:', error);
  }
  return [];
};

export const saveAntidelayToStorage = (seconds: number) => {
  try {
    localStorage.setItem(ANTIDELAY_STORAGE_KEY, seconds.toString());
  } catch (error) {
    console.error('Failed to save antidelay to localStorage:', error);
  }
};

export const loadAntidelayFromStorage = (): number => {
  try {
    const stored = localStorage.getItem(ANTIDELAY_STORAGE_KEY);
    if (stored) {
      return parseInt(stored, 10) || 15;
    }
  } catch (error) {
    console.error('Failed to load antidelay from localStorage:', error);
  }
  return 15;
};

export const clearSignalsFromStorage = () => {
  try {
    localStorage.removeItem(SIGNALS_STORAGE_KEY);
    console.log('Signals cleared from localStorage');
  } catch (error) {
    console.error('Failed to clear signals from localStorage:', error);
  }
};
