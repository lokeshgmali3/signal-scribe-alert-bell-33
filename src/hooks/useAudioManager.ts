
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

  const handleRingtoneSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('🎵 Custom ringtone selected:', file.name, 'size:', file.size, 'bytes');

      // Store as blob URL for foreground playback
      const blobUrl = URL.createObjectURL(file);
      console.log('🎵 Created blob URL:', blobUrl);

      setCustomRingtone(blobUrl);
      setUseDefault(false);

      // Convert to base64 and cache for background service (synchronously, before set custom ringtone)
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          // Cache synchronously before setting in bg service to prevent race condition with ring
          await backgroundService.cacheCustomAudio(base64Data, file.type);
          backgroundService.setCustomRingtone(blobUrl);
          console.log('🎵 Custom audio cached in background service');
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('🎵 Error caching custom audio:', error);
      }

      // Previously, setCustomRingtone was called before cacheCustomAudio finished (could allow a race).
      // Now, we set it from inside the FileReader only after caching.
      // backgroundService.setCustomRingtone(blobUrl);
      // console.log('🎵 Audio Manager - After selection - useDefault:', false, 'customRingtone set');
    }
  };

  const triggerRingtoneSelection = () => {
    console.log('🎵 Triggering ringtone selection dialog');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const setUseDefaultSound = () => {
    console.log('🎵 Setting to use default sound');
    setUseDefault(true);
    setCustomRingtone(null);
    
    // Clear custom audio from background service
    backgroundService.setCustomRingtone(null);
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
