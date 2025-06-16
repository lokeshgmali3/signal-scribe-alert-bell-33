
const AUDIO_ONLY_MODE_KEY = 'audioOnlyMode';

export class AudioOnlyModeManager {
  private audioOnlyMode: boolean = false;

  constructor() {
    this.audioOnlyMode = this.loadFromStorage();
  }

  private loadFromStorage(): boolean {
    return localStorage.getItem(AUDIO_ONLY_MODE_KEY) === 'true';
  }

  setAudioOnlyMode(mode: boolean): void {
    this.audioOnlyMode = mode;
    localStorage.setItem(AUDIO_ONLY_MODE_KEY, mode ? "true" : "false");
    console.log('Audio Only Mode set to:', mode);
  }

  getAudioOnlyMode(): boolean {
    return this.audioOnlyMode;
  }
}
