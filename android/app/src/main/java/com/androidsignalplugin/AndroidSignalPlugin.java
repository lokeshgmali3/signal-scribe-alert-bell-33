
package com.androidsignalplugin;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.net.Uri;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

@CapacitorPlugin(name = "AndroidSignalPlugin")
public class AndroidSignalPlugin extends Plugin {

    private AlarmManager alarmManager;
    private Context context;
    private SignalForegroundService foregroundService;
    private SignalAudioManager audioManager;

    @Override
    public void load() {
        context = getContext();
        alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        audioManager = new SignalAudioManager(context);
    }

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        try {
            int id = call.getInt("id", 0);
            String timestamp = call.getString("timestamp");
            int antidelaySeconds = call.getInt("antidelaySeconds", 15);
            String signalData = call.getString("signalData");

            // Parse timestamp (HH:MM format)
            String[] timeParts = timestamp.split(":");
            int hours = Integer.parseInt(timeParts[0]);
            int minutes = Integer.parseInt(timeParts[1]);

            // Calculate alarm time
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, hours);
            calendar.set(Calendar.MINUTE, minutes);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);

            // Subtract antidelay
            calendar.add(Calendar.SECOND, -antidelaySeconds);

            // Create intent for alarm receiver
            Intent intent = new Intent(context, SignalAlarmReceiver.class);
            intent.putExtra("signalData", signalData);
            intent.putExtra("alarmId", id);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 
                id, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Schedule exact alarm
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    calendar.getTimeInMillis(),
                    pendingIntent
                );
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    calendar.getTimeInMillis(),
                    pendingIntent
                );
            }

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to schedule alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        try {
            int id = call.getInt("id", 0);
            
            Intent intent = new Intent(context, SignalAlarmReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 
                id, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            alarmManager.cancel(pendingIntent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to cancel alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAllAlarms(PluginCall call) {
        try {
            // Cancel alarms with IDs 1000-1099 (matching our notification range)
            for (int i = 1000; i < 1100; i++) {
                Intent intent = new Intent(context, SignalAlarmReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, 
                    i, 
                    intent, 
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                alarmManager.cancel(pendingIntent);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to cancel all alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        try {
            String title = call.getString("title", "Signal Alerts Running");
            String text = call.getString("text", "Monitoring for binary options signals");

            Intent serviceIntent = new Intent(context, SignalForegroundService.class);
            serviceIntent.putExtra("title", title);
            serviceIntent.putExtra("text", text);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to start foreground service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(context, SignalForegroundService.class);
            context.stopService(serviceIntent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to stop foreground service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void playAudio(PluginCall call) {
        try {
            String audioPath = call.getString("audioPath");
            boolean isCustom = call.getBoolean("isCustom", false);
            int duration = call.getInt("duration", 10000);

            audioManager.playAudio(audioPath, isCustom, duration);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to play audio: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopAudio(PluginCall call) {
        try {
            audioManager.stopAudio();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to stop audio: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to request battery optimization: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        try {
            JSObject result = new JSObject();
            
            // Check alarm permission
            boolean alarmsEnabled = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarmsEnabled = alarmManager.canScheduleExactAlarms();
            }
            
            // Check notification permission
            boolean notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
            
            // Check battery optimization
            boolean batteryOptimized = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                batteryOptimized = !((android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE))
                    .isIgnoringBatteryOptimizations(context.getPackageName());
            }

            result.put("alarms", alarmsEnabled);
            result.put("notifications", notificationsEnabled);
            result.put("batteryOptimization", !batteryOptimized);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Failed to check permissions: " + e.getMessage());
        }
    }
}
