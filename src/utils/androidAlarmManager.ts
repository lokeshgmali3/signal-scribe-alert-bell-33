// Placeholder for AlarmManager integration: native code/plugin required!
import { Signal } from '@/types/signal';

interface AlarmMap {
  [key: number]: string; // Key: alarmId, Value: signal (serialized)
}

/**
 * Stub for scheduling and cancelling alarms for Android.
 * REAL implementation requires a custom Capacitor plugin or custom native code.
 */
export class AndroidAlarmManager {
  static alarmPrefix = 24600;

  static async scheduleAlarms(signals: Signal[], antidelaySeconds: number) {
    const now = Date.now();
    const alarmsToSet = signals
      .filter(signal => !signal.triggered)
      .map((signal, idx) => {
        const [hours, minutes] = signal.timestamp.split(':').map(Number);
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        const scheduled = target.getTime() - (antidelaySeconds * 1000);
        if (scheduled <= now) return null;
        return {
          alarmId: AndroidAlarmManager.alarmPrefix + idx,
          time: scheduled,
          signal,
        };
      })
      .filter(Boolean) as { alarmId: number; time: number; signal: Signal }[];

    await this.cancelAllAlarms();

    // In a web-only/JS environment, AlarmManager is NOT available.
    // For actual device scheduling, implement a Capacitor plugin in native code.
    console.warn('[AndroidAlarmManager] AlarmManager is not available without custom plugin.');
    console.log('[AlarmManager] Would schedule', alarmsToSet.length, 'alarms');
    // Fallback: Do nothing, or schedule notifications some other way as needed.
  }

  static async cancelAllAlarms() {
    // Fallback/stub.
    console.warn('[AndroidAlarmManager] AlarmManager cancelAllAlarms is a no-op in this build.');
    console.log('[AlarmManager] Cancelled all alarms.');
  }
}
