
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

  async playBackgroundAudio(signal?: Signal) {
    try {
      console.log('🚀 Playing background audio for signal:', signal?.timestamp || 'manual trigger');
      console.log('🚀 Has cached audio:', this.cachedAudio ? 'yes' : 'no');
      console.log('🚀 Custom ringtone set:', this.customRingtone ? 'yes' : 'no');
      
      if (this.customRingtone && this.cachedAudio) {
        console.log('🚀 Using cached custom audio for background playback');
        await playCustomRingtoneBackground(this.cachedAudio);
      } else {
        console.log('🚀 No custom audio available, using default beep');
        await playCustomRingtoneBackground(null);
      }
    } catch (error) {
      console.error('🚀 Error playing background audio:', error);
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
