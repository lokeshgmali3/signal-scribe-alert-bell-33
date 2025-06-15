
import { Device } from '@capacitor/device';
import { Intent } from '@capacitor-community/intent';

export class AndroidBatteryManager {
  static async requestBatteryOptimizationBypass() {
    try {
      // Try to open battery optimization settings on Android.
      await Intent.startActivity({
        action: 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
      });
      // (Optionally: show a dialog to the user explaining why this is needed)
      alert(
        'For the app to ring at the correct time while in the background or screen off, please allow this app to ignore battery optimizations in the settings screen that just opened.'
      );
      console.info('[AndroidBatteryManager] Requested battery optimization bypass');
    } catch (error) {
      // Fallback: open general battery settings
      try {
        await Intent.startActivity({
          action: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
        });
        alert(
          'Please find the app in the list and allow it to ignore battery optimizations.'
        );
      } catch (err) {
        alert(
          'Unable to open battery optimization settings automatically. Please visit your phone settings and allow this app to ignore battery optimizations for the best reliability.'
        );
      }
      console.error('[AndroidBatteryManager] Failed to launch battery optimization intent', error);
    }
  }
}
