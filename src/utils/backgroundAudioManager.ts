
import { Signal } from '@/types/signal';
import { playCustomRingtoneBackground } from './audioUtils';

interface CachedAudio {
  base64: string;
  mimeType: string;
  timestamp: number;
}

let persistentAudioContext: AudioContext | null = null;

function getPersistentAudioContext() {
  if (!persistentAudioContext) {
    // Try to reuse/wake global audio context for better background reliability
    persistentAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    window.__unlockedAudioContext = persistentAudioContext;
    // Try to unlock on user gesture in main app startup
    document.body.addEventListener("click", () => {
      if (persistentAudioContext && persistentAudioContext.state === "suspended") {
        persistentAudioContext.resume();
      }
    }, { once: true });
  }
  return persistentAudioContext;
}

export class BackgroundAudioManager {
  private customRingtone: string | null = null;
  private cachedAudio: CachedAudio | null = null;
  private hasAudioFocus = true;

  setCustomRingtone(ringtone: string | null) {
    console.log('🚀 Background service custom ringtone set:', ringtone ? 'custom file' : 'null');
    this.customRingtone = ringtone;
  }

  async cacheCustomAudio(base64: string, mimeType: string) {
    this.cachedAudio = {
      base64,
      mimeType,
      timestamp: Date.now()
    };
    console.log('🚀 Custom audio cached successfully');
  }

  clearCustomAudio() {
    this.cachedAudio = null;
    console.log('🚀 Clearing cached custom audio');
  }

  async requestAudioFocus() {
    this.hasAudioFocus = true;
    console.log('🔊 (Stub) Audio focus requested and granted.');
  }
  async abandonAudioFocus() {
    this.hasAudioFocus = false;
    console.log('🔊 (Stub) Audio focus abandoned.');
  }

  // Louder beep using persistent context if no custom audio
  private async playBeepLoud() {
    try {
      const ctx = getPersistentAudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 1350; // Higher frequency for phone speaker
      gain.gain.value = 0.55; // Louder
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 5); // 5 sec louder beep
      // Auto disconnect after stop
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch (e) {
      console.warn("Could not play persistent beep: ", e);
    }
  }

  async playBackgroundAudio(signal?: Signal) {
    try {
      console.log('🚀 Playing background audio for signal:', signal?.timestamp || 'manual trigger');
      await this.requestAudioFocus();
      if (this.customRingtone && this.cachedAudio) {
        console.log('🚀 Using cached custom audio for background playback');
        await playCustomRingtoneBackground(this.cachedAudio);
      } else {
        console.warn('🚀 No custom ringtone set or cached audio missing, falling back to beep.');
        await this.playBeepLoud();
      }
      await this.abandonAudioFocus();
    } catch (error) {
      console.error('🚀 Error playing background audio:', error);
      await this.playBeepLoud();
      await this.abandonAudioFocus();
    }
  }

  hasCustomAudio(): boolean {
    return !!(this.customRingtone && this.cachedAudio);
  }

  getAudioInfo() {
    return {
      hasCustomRingtone: !!this.customRingtone,
      hasCachedAudio: !!this.cachedAudio,
      audioTimestamp: this.cachedAudio?.timestamp || null
    };
  }
}
