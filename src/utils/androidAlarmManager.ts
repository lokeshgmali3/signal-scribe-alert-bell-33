
import { AlarmManager } from '@capacitor-community/alarm-manager';
import { Signal } from '@/types/signal';

interface AlarmMap {
  [key: number]: string; // Key: alarmId, Value: signal (serialized)
}

/**
 * Wraps scheduling and cancelling alarms for Android
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

    for (const alarm of alarmsToSet) {
      try {
        await AlarmManager.setAlarm({
          id: alarm.alarmId,
          triggerAtMillis: alarm.time,
          title: 'Binary Signal Alert',
          text: `${alarm.signal.asset || 'Asset'} - ${alarm.signal.direction || 'Direction'} at ${alarm.signal.timestamp}`,
          extra: { signal: JSON.stringify(alarm.signal) },
        });
        console.log('[AlarmManager] Scheduled alarm', alarm.alarmId, alarm.signal);
      } catch (error) {
        console.error('[AlarmManager] Failed to schedule alarm', alarm.alarmId, error);
      }
    }
  }

  static async cancelAllAlarms() {
    for (let idx = 0; idx < 100; ++idx) {
      const id = AndroidAlarmManager.alarmPrefix + idx;
      try {
        await AlarmManager.cancelAlarm({ id });
      } catch {}
    }
    console.log('[AlarmManager] Cancelled all alarms.');
  }
}
