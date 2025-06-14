
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Music, Volume2 } from 'lucide-react';

interface SoundSelectionDialogProps {
  open: boolean;
  onSelectCustomSound: () => void;
  onSelectDefaultSound: () => void;
  onClose: () => void;
}

const SoundSelectionDialog = ({
  open,
  onSelectCustomSound,
  onSelectDefaultSound,
  onClose
}: SoundSelectionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Ringtone</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 p-4">
          <Button
            onClick={onSelectCustomSound}
            variant="outline"
            className="h-16 flex items-center gap-3"
          >
            <Music className="h-6 w-6" />
            <span>Select Custom Sound</span>
          </Button>
          
          <Button
            onClick={onSelectDefaultSound}
            variant="outline"
            className="h-16 flex items-center gap-3"
          >
            <Volume2 className="h-6 w-6" />
            <span>Use Default Sound</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SoundSelectionDialog;
