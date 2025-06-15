
export const createBeepAudio = (audioContextsRef?: React.MutableRefObject<AudioContext[]>) => {
  console.log('🔊 Creating default beep audio');
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  gainNode.gain.value = 0.3;
  
  const duration = 3000; // 3 seconds for default beep
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration / 1000);
  
  // Store audio context for cleanup tracking if ref is provided
  if (audioContextsRef) {
    audioContextsRef.current.push(audioContext);
    console.log('🔊 Audio context stored, total contexts:', audioContextsRef.current.length);
  }
  
  return oscillator;
};

export const playCustomRingtoneBackground = async (customRingtone: string | null): Promise<void> => {
  console.log('🔊 playCustomRingtoneBackground called with:', customRingtone ? 'custom file' : 'null');
  
  if (!customRingtone) {
    console.log('🔊 No custom ringtone, creating default beep for background');
    createBeepAudio();
    return;
  }

  try {
    console.log('🔊 Attempting to play custom ringtone in background mode');
    
    // Try to use Web Audio API for better background compatibility
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Fetch the audio file and decode it
    const response = await fetch(customRingtone);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log('🔊 Audio file decoded successfully, duration:', audioBuffer.duration);
    
    // Create source and play
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0.8;
    
    source.start();
    console.log('🔊 Custom ringtone started playing via Web Audio API');
    
    // Auto-stop after 10 seconds
    setTimeout(() => {
      try {
        source.stop();
        audioContext.close();
        console.log('🔊 Custom ringtone stopped and context closed');
      } catch (err) {
        console.log('🔊 Error stopping custom ringtone:', err);
      }
    }, 10000);
    
  } catch (error) {
    console.log('🔊 Error playing custom ringtone in background, falling back to beep:', error);
    createBeepAudio();
  }
};

export const playCustomRingtone = (customRingtone: string | null, audioContextsRef?: React.MutableRefObject<AudioContext[]>): Promise<HTMLAudioElement | null> => {
  console.log('🔊 playCustomRingtone called with:', customRingtone ? 'custom file' : 'null');
  console.log('🔊 Document visibility state:', document.visibilityState);
  console.log('🔊 Page hidden:', document.hidden);
  
  return new Promise((resolve, reject) => {
    if (customRingtone) {
      console.log('🔊 Playing custom ringtone:', customRingtone);
      
      // If page is hidden, use background-compatible method
      if (document.hidden) {
        console.log('🔊 Page is hidden, using background-compatible audio');
        playCustomRingtoneBackground(customRingtone).then(() => resolve(null));
        return;
      }
      
      const audio = new Audio(customRingtone);
      audio.loop = false;
      audio.volume = 0.8;
      
      audio.addEventListener('loadstart', () => console.log('🔊 Audio load started'));
      audio.addEventListener('canplay', () => console.log('🔊 Audio can play'));
      audio.addEventListener('play', () => console.log('🔊 Audio play event fired'));
      audio.addEventListener('pause', () => console.log('🔊 Audio pause event fired'));
      audio.addEventListener('ended', () => console.log('🔊 Audio ended'));
      audio.addEventListener('error', (e) => console.log('🔊 Audio error:', e));
      
      audio.play().then(() => {
        console.log('🔊 Custom ringtone started playing successfully');
        resolve(audio);
      }).catch(err => {
        console.log('🔊 Error playing custom ringtone:', err);
        console.log('🔊 Falling back to default beep');
        createBeepAudio(audioContextsRef);
        resolve(null);
      });
    } else {
      console.log('🔊 No custom ringtone provided, playing default beep');
      createBeepAudio(audioContextsRef);
      resolve(null);
    }
  });
};
