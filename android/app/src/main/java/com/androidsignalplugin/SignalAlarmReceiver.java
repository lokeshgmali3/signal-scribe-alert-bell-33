
package com.androidsignalplugin;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class SignalAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "SignalAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Alarm received!");
        
        String signalData = intent.getStringExtra("signalData");
        int alarmId = intent.getIntExtra("alarmId", 0);
        
        // Start foreground service to handle the alarm
        Intent serviceIntent = new Intent(context, SignalForegroundService.class);
        serviceIntent.setAction("TRIGGER_SIGNAL");
        serviceIntent.putExtra("signalData", signalData);
        serviceIntent.putExtra("alarmId", alarmId);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
