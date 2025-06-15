
export const createBeepAudio = (audioContextsRef?: React.MutableRefObject<AudioContext[]>) => {
  console.log('Creating default beep audio');
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
  }
  
  return oscillator;
};

export const playCustomRingtone = (customRingtone: string | null, audioContextsRef?: React.MutableRefObject<AudioContext[]>): Promise<HTMLAudioElement | null> => {
  console.log('playCustomRingtone called with:', customRingtone);
  
  return new Promise((resolve, reject) => {
    if (customRingtone) {
      console.log('Playing custom ringtone:', customRingtone);
      const audio = new Audio(customRingtone);
      audio.loop = false; // Don't loop - play only once
      audio.volume = 0.8; // Set volume
      
      audio.play().then(() => {
        console.log('Custom ringtone started playing successfully');
        resolve(audio);
      }).catch(err => {
        console.log('Error playing custom ringtone:', err);
        console.log('Falling back to default beep');
        // Fallback to default beep
        createBeepAudio(audioContextsRef);
        resolve(null);
      });
    } else {
      console.log('No custom ringtone provided, playing default beep');
      // Play default beep
      createBeepAudio(audioContextsRef);
      resolve(null);
    }
  });
};
