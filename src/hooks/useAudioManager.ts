
import { useState, useEffect, useRef } from 'react';

export const useAudioManager = () => {
  const [customRingtone, setCustomRingtone] = useState<string | null>(null);
  const [useDefault, setUseDefault] = useState(true); // Default to true initially
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setCustomRingtone(url);
      setUseDefault(false);
      console.log('Custom ringtone set:', file.name);
    }
  };

  const triggerRingtoneSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const setUseDefaultSound = () => {
    setUseDefault(true);
    setCustomRingtone(null);
    console.log('Default sound selected');
  };

  // Return null for customRingtone if useDefault is true
  const effectiveRingtone = useDefault ? null : customRingtone;

  return {
    customRingtone: effectiveRingtone,
    triggerRingtoneSelection,
    setUseDefaultSound
  };
};
