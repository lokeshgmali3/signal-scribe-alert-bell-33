import { useState, useEffect, useRef } from 'react';
import { backgroundService } from '@/utils/backgroundService';

export const useAudioManager = () => {
  const [customRingtone, setCustomRingtone] = useState<string | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    console.log('🎵 Audio Manager - useDefault:', useDefault, 'customRingtone:', customRingtone ? 'set' : 'null');
  }, [useDefault, customRingtone]);

  useEffect(() => {
    console.log('🎵 Audio Manager - Setting up file input');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleRingtoneSelect);
    document.body.appendChild(fileInput);
    fileInputRef.current = fileInput;

    return () => {
      if (fileInputRef.current && document.body.contains(fileInputRef.current)) {
        document.body.removeChild(fileInputRef.current);
      }
    };
  }, []);

  // Sync with background service whenever the effective ringtone changes
  useEffect(() => {
    const effectiveRingtone = useDefault ? null : customRingtone;
    console.log('🎵 Audio Manager - Syncing with background service:', effectiveRingtone ? 'custom' : 'default');
    backgroundService.setCustomRingtone(effectiveRingtone);
  }, [useDefault, customRingtone]);

  const handleRingtoneSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('🎵 Custom ringtone selected:', file.name, 'size:', file.size, 'bytes');
      
      try {
        // Convert file to base64 for persistent storage
        const base64Audio = await fileToBase64(file);
        console.log('🎵 Custom ringtone converted to base64, length:', base64Audio.length);
        
        // Store both blob URL for immediate playback and base64 for background
        const blobUrl = URL.createObjectURL(file);
        console.log('🎵 Created blob URL:', blobUrl);
        
        // Cache the audio in background service
        await backgroundService.cacheCustomAudio(base64Audio, file.type);
        console.log('🎵 Custom audio cached in background service');
        
        setCustomRingtone(blobUrl);
        setUseDefault(false);
        console.log('🎵 Audio Manager - After selection - useDefault:', false, 'customRingtone set');
      } catch (error) {
        console.error('🎵 Error processing custom ringtone:', error);
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/mp3;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const triggerRingtoneSelection = () => {
    console.log('🎵 Triggering ringtone selection dialog');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const setUseDefaultSound = () => {
    console.log('🎵 Setting to use default sound');
    setUseDefault(true);
    setCustomRingtone(null);
    backgroundService.clearCustomAudio();
    console.log('🎵 Audio Manager - After default selection - useDefault:', true, 'customRingtone:', null);
  };

  const effectiveRingtone = useDefault ? null : customRingtone;
  
  console.log('🎵 Audio Manager - Returning effectiveRingtone:', effectiveRingtone ? 'custom' : 'default', 'based on useDefault:', useDefault);

  return {
    customRingtone: effectiveRingtone,
    triggerRingtoneSelection,
    setUseDefaultSound
  };
};
