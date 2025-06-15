
import { useState, useEffect, useRef } from 'react';

export const useAudioManager = () => {
  const [customRingtone, setCustomRingtone] = useState<string | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    console.log('Audio Manager - useDefault:', useDefault, 'customRingtone:', customRingtone);
  }, [useDefault, customRingtone]);

  useEffect(() => {
    // Create hidden file input for ringtone selection
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

  const handleRingtoneSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      const url = URL.createObjectURL(file);
      console.log('Custom ringtone selected:', file.name, 'URL:', url);
      setCustomRingtone(url);
      setUseDefault(false);
      console.log('Audio Manager - After selection - useDefault:', false, 'customRingtone set');
    }
  };

  const triggerRingtoneSelection = () => {
    console.log('Triggering ringtone selection dialog');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const setUseDefaultSound = () => {
    console.log('Setting to use default sound');
    setUseDefault(true);
    setCustomRingtone(null);
    console.log('Audio Manager - After default selection - useDefault:', true, 'customRingtone:', null);
  };

  // Fix the logic: return the actual customRingtone when useDefault is false
  const effectiveRingtone = useDefault ? null : customRingtone;
  
  console.log('Audio Manager - Returning effectiveRingtone:', effectiveRingtone, 'based on useDefault:', useDefault);

  return {
    customRingtone: effectiveRingtone,
    triggerRingtoneSelection,
    setUseDefaultSound
  };
};
