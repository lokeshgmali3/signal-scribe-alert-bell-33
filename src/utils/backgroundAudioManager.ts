
import { Signal } from '@/types/signal';
import { playCustomRingtoneBackground } from './audioUtils';

interface CachedAudio {
  base64: string;
  mimeType: string;
  timestamp: number;
}

export class BackgroundAudioManager {
  private customRingtone: string | null = null;
  private cachedAudio: CachedAudio | null = null;

  /**
   * Track audio "focus" intent (can't guarantee on web, stub/log for native Android-phase integration)
   */
  private hasAudioFocus = true;

  setCustomRingtone(ringtone: string | null) {
    console.log('🚀 Background service custom ringtone set:', ringtone ? 'custom file' : 'null');
    this.customRingtone = ringtone;
  }

  async cacheCustomAudio(base64: string, mimeType: string) {
    console.log('🚀 Caching custom audio in background service - base64 length:', base64.length, 'mime type:', mimeType);
    this.cachedAudio = {
      base64,
      mimeType,
      timestamp: Date.now()
    };
    console.log('🚀 Custom audio cached successfully');
  }

  clearCustomAudio() {
    console.log('🚀 Clearing cached custom audio');
    this.cachedAudio = null;
  }

  /**
   * Request/abandon "audio focus" for background sound.
   * (Stub on web/package for native; logs only now.)
   */
  async requestAudioFocus() {
    this.hasAudioFocus = true;
    console.log('🔊 (Stub) Audio focus requested and granted.');
  }
  async abandonAudioFocus() {
    this.hasAudioFocus = false;
    console.log('🔊 (Stub) Audio focus abandoned.');
  }

  /**
   * Try to play custom sound, fallback to beep if unavailable in background.
   * Optionally logs audio focus.
   */
  async playBackgroundAudio(signal?: Signal) {
    try {
      console.log('🚀 Playing background audio for signal:', signal?.timestamp || 'manual trigger');
      await this.requestAudioFocus();

      if (this.customRingtone && this.cachedAudio) {
        console.log('🚀 Using cached custom audio for background playback');
        await playCustomRingtoneBackground(this.cachedAudio);
      } else {
        console.warn('🚀 No custom ringtone set or cached audio missing, falling back to beep.');
        await playCustomRingtoneBackground(null);
      }

      await this.abandonAudioFocus();
    } catch (error) {
      console.error('🚀 Error playing background audio:', error);
      // Fallback: Always play beep if anything goes wrong
      await playCustomRingtoneBackground(null);
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

