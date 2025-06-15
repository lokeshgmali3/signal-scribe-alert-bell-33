
import { registerPlugin } from '@capacitor/core';

export interface AndroidSignalPlugin {
  scheduleAlarm(options: { 
    id: number;
    timestamp: string;
    antidelaySeconds: number;
    signalData: string;
  }): Promise<{ success: boolean }>;
  
  cancelAlarm(options: { id: number }): Promise<{ success: boolean }>;
  
  cancelAllAlarms(): Promise<{ success: boolean }>;
  
  startForegroundService(options: {
    title: string;
    text: string;
  }): Promise<{ success: boolean }>;
  
  stopForegroundService(): Promise<{ success: boolean }>;
  
  playAudio(options: {
    audioPath?: string;
    isCustom: boolean;
    duration: number;
  }): Promise<{ success: boolean }>;
  
  stopAudio(): Promise<{ success: boolean }>;
  
  requestBatteryOptimization(): Promise<{ success: boolean }>;
  
  checkPermissions(): Promise<{ 
    alarms: boolean;
    notifications: boolean;
    batteryOptimization: boolean;
  }>;
}

const AndroidSignalPlugin = registerPlugin<AndroidSignalPlugin>('AndroidSignalPlugin');

export default AndroidSignalPlugin;
