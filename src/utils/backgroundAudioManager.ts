
import { Signal } from '@/types/signal';
import { playCustomRingtoneBackground } from './audioUtils';

interface CachedAudio {
  base64: string;
  mimeType: string;
  timestamp: number;
  blobUrl?: string;
}

let persistentAudioContext: AudioContext | null = null;

function getPersistentAudioContext() {
  if (!persistentAudioContext) {
    persistentAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    window.__unlockedAudioContext = persistentAudioContext;
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
    // If setting a custom ringtone, convert it to base64 for background use
    if (ringtone) {
      this.convertRingtoneToBase64(ringtone);
    }
  }

  private async convertRingtoneToBase64(blobUrl: string) {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();

      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];

          this.cachedAudio = {
            base64: base64Data,
            mimeType: blob.type,
            timestamp: Date.now(),
            blobUrl: blobUrl
          };

          console.log('🚀 Custom audio converted to base64 for background use');
          resolve();
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('🚀 Failed to convert ringtone to base64:', error);
    }
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
    this.customRingtone = null;
    console.log('🚀 Clearing cached custom audio');
  }

  async requestAudioFocus() {
    this.hasAudioFocus = true;
    console.log('🔊 Audio focus requested and granted.');
  }

  async abandonAudioFocus() {
    this.hasAudioFocus = false;
    console.log('🔊 Audio focus abandoned.');
  }

  private async playBeepLoud() {
    try {
      const ctx = getPersistentAudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 1350;
      gain.gain.value = 0.55;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 5);
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

      // --- RELIABILITY FIX: (mobile/offscreen) ---
      // If customRingtone is set but cachedAudio is missing for any reason, re-attempt caching
      if (this.customRingtone && !(this.cachedAudio && this.cachedAudio.base64)) {
        console.warn('🚀 Custom ringtone selected but no cached audio found. Re-caching now before playback.');
        await this.convertRingtoneToBase64(this.customRingtone);
      }

      // Check if we have custom audio data for background playback
      if (this.hasCustomAudio()) {
        console.log('🚀 Using cached custom audio for background playback');
        await playCustomRingtoneBackground(this.cachedAudio);
      } else {
        console.warn('🚀 No custom ringtone cached, falling back to beep.');
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
    return !!(this.cachedAudio && this.cachedAudio.base64);
  }

  getAudioInfo() {
    return {
      hasCustomRingtone: !!this.customRingtone,
      hasCachedAudio: !!this.cachedAudio,
      audioTimestamp: this.cachedAudio?.timestamp || null
    };
  }
}
