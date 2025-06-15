
import { useState, useEffect, useRef } from 'react';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // do not include handleRingtoneSelect

  // No background sync! Everything below is foreground only.

  const handleRingtoneSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      console.log('🎵 Custom ringtone selected:', file.name, 'size:', file.size, 'bytes');

      // Store as blob URL for foreground playback only
      const blobUrl = URL.createObjectURL(file);
      console.log('🎵 Created blob URL:', blobUrl);

      setCustomRingtone(blobUrl);
      setUseDefault(false);
      console.log('🎵 Audio Manager - After selection - useDefault:', false, 'customRingtone set');

      // Also cache audio in background service for background ringing
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const base64data = result.split(',')[1]; // after data:audio/xxx;base64,
        const mimeType = file.type;
        try {
          const { backgroundService } = await import('@/utils/backgroundService');
          await backgroundService.cacheCustomAudio(base64data, mimeType);
        } catch (err) {
          console.log('Background audio caching failed:', err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerRingtoneSelection = () => {
    console.log('🎵 Triggering ringtone selection dialog');
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // allow re-upload of same file
      fileInputRef.current.click();
    }
  };

  const setUseDefaultSound = async () => {
    console.log('🎵 Setting to use default sound');
    setUseDefault(true);
    setCustomRingtone(null);
    console.log('🎵 Audio Manager - After default selection - useDefault:', true, 'customRingtone:', null);

    // Also clear cached audio in background service
    try {
      const { backgroundService } = await import('@/utils/backgroundService');
      await backgroundService.clearCustomAudio();
    } catch (err) {
      console.log('Background audio clearing failed:', err);
    }
  };

  const effectiveRingtone = useDefault ? null : customRingtone;
  
  console.log('🎵 Audio Manager - Returning effectiveRingtone:', effectiveRingtone ? 'custom' : 'default', 'based on useDefault:', useDefault);

  return {
    customRingtone: effectiveRingtone,
    triggerRingtoneSelection,
    setUseDefaultSound
  };
};
