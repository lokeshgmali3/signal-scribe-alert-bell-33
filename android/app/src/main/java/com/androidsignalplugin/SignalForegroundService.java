
package com.androidsignalplugin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class SignalForegroundService extends Service {
    private static final String TAG = "SignalForegroundService";
    private static final String CHANNEL_ID = "signal_foreground_service";
    private static final int NOTIFICATION_ID = 1;
    
    private SignalAudioManager audioManager;

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = new SignalAudioManager(this);
        createNotificationChannel();
        Log.d(TAG, "Foreground service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        
        if ("TRIGGER_SIGNAL".equals(action)) {
            // Handle signal trigger
            String signalData = intent.getStringExtra("signalData");
            int alarmId = intent.getIntExtra("alarmId", 0);
            
            Log.d(TAG, "Signal triggered: " + signalData);
            
            // Play audio for signal
            audioManager.playAudio(null, false, 10000);
            
        } else {
            // Regular foreground service start
            String title = intent != null ? intent.getStringExtra("title") : "Signal Alerts Running";
            String text = intent != null ? intent.getStringExtra("text") : "Monitoring for binary options signals";
            
            Notification notification = createNotification(title, text);
            startForeground(NOTIFICATION_ID, notification);
            
            Log.d(TAG, "Foreground service started");
        }
        
        return START_STICKY; // Restart if killed
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (audioManager != null) {
            audioManager.stopAudio();
        }
        Log.d(TAG, "Foreground service destroyed");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Signal Alerts Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps signal monitoring active in background");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification(String title, String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setShowWhen(false)
            .setSilent(true)
            .build();
    }
}
