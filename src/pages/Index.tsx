import React from 'react';
import { useSignalTracker } from '@/hooks/useSignalTracker';
import SignalInput from '@/components/SignalInput';
import ControlPanel from '@/components/ControlPanel';
import AntidelayDialog from '@/components/AntidelayDialog';
import SoundSelectionDialog from '@/components/SoundSelectionDialog';
import NotificationPermissionBanner from "@/components/NotificationPermissionBanner";

const Index = () => {
  const {
    signalsText,
    setSignalsText,
    saveButtonPressed,
    ringOffButtonPressed,
    setRingButtonPressed,
    showAntidelayDialog,
    showSoundDialog,
    antidelayInput,
    setAntidelayInput,
    antidelaySeconds,
    handleRingOff,
    handleSaveSignals,
    handleSetRingMouseDown,
    handleSetRingMouseUp,
    handleSetRingMouseLeave,
    handleSelectCustomSound,
    handleSelectDefaultSound,
    handleCloseSoundDialog,
    handleAntidelaySubmit,
    handleAntidelayCancel
  } = useSignalTracker();

  return (
    <div className="min-h-screen bg-background flex flex-col select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <NotificationPermissionBanner />
      <SignalInput
        signalsText={signalsText}
        onSignalsTextChange={setSignalsText}
      />
      
      <ControlPanel
        signalsText={signalsText}
        saveButtonPressed={saveButtonPressed}
        ringOffButtonPressed={ringOffButtonPressed}
        setRingButtonPressed={setRingButtonPressed}
        onRingOff={handleRingOff}
        onSaveSignals={handleSaveSignals}
        onSetRingMouseDown={handleSetRingMouseDown}
        onSetRingMouseUp={handleSetRingMouseUp}
        onSetRingMouseLeave={handleSetRingMouseLeave}
      />

      <AntidelayDialog
        open={showAntidelayDialog}
        value={antidelayInput}
        onChange={setAntidelayInput}
        onSubmit={handleAntidelaySubmit}
        onCancel={handleAntidelayCancel}
      />

      <SoundSelectionDialog
        open={showSoundDialog}
        onSelectCustomSound={handleSelectCustomSound}
        onSelectDefaultSound={handleSelectDefaultSound}
        onClose={handleCloseSoundDialog}
      />
    </div>
  );
};

export default Index;
