package com.androidsignalplugin;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import java.io.IOException;

public class SignalAudioManager implements AudioManager.OnAudioFocusChangeListener {
    private static final String TAG = "SignalAudioManager";
    
    private Context context;
    private AudioManager audioManager;
    private MediaPlayer mediaPlayer;
    private ToneGenerator toneGenerator;
    private AudioFocusRequest audioFocusRequest;
    private Handler handler;

    public SignalAudioManager(Context context) {
        this.context = context;
        this.audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        this.handler = new Handler(Looper.getMainLooper());
    }

    public void playAudio(String audioPath, boolean isCustom, int duration) {
        stopAudio(); // Stop any existing audio
        
        requestAudioFocus();
        
        if (isCustom && audioPath != null) {
            playCustomAudio(audioPath, duration);
        } else {
            playDefaultBeep(duration);
        }
    }

    private void playCustomAudio(String audioPath, int duration) {
        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(context, Uri.parse(audioPath));
            
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            
            mediaPlayer.setLooping(true);
            mediaPlayer.setVolume(1.0f, 1.0f);
            
            mediaPlayer.setOnPreparedListener(mp -> {
                mp.start();
                Log.d(TAG, "Custom audio started");
                
                // Stop after duration
                handler.postDelayed(() -> stopAudio(), duration);
            });
            
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "MediaPlayer error: " + what + ", " + extra);
                playDefaultBeep(duration); // Fallback to beep
                return true;
            });
            
            mediaPlayer.prepareAsync();
            
        } catch (IOException e) {
            Log.e(TAG, "Error playing custom audio", e);
            playDefaultBeep(duration); // Fallback to beep
        }
    }

    private void playDefaultBeep(int duration) {
        try {
            // Use ToneGenerator for reliable beep
            toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            
            // Play beep pattern: beep for 500ms, pause 200ms, repeat
            playBeepPattern(duration);
            
            Log.d(TAG, "Default beep started");
            
        } catch (Exception e) {
            Log.e(TAG, "Error playing default beep", e);
        }
    }

    private void playBeepPattern(int remainingDuration) {
        if (remainingDuration <= 0 || toneGenerator == null) {
            return;
        }
        
        toneGenerator.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 500);
        
        handler.postDelayed(() -> {
            if (toneGenerator != null) {
                playBeepPattern(remainingDuration - 700); // 500ms beep + 200ms pause
            }
        }, 700);
    }

    public void stopAudio() {
        abandonAudioFocus();
        
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping MediaPlayer", e);
            }
            mediaPlayer = null;
        }
        
        if (toneGenerator != null) {
            try {
                toneGenerator.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping ToneGenerator", e);
            }
            toneGenerator = null;
        }
        
        Log.d(TAG, "Audio stopped");
    }

    private void requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
                
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(audioAttributes)
                .setOnAudioFocusChangeListener(this, handler)
                .build();
                
            audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            audioManager.requestAudioFocus(this, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }
    }

    private void abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
            audioFocusRequest = null;
        } else {
            audioManager.abandonAudioFocus(this);
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                // Don't stop alarm audio, it's important
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                // Lower volume if needed, but keep playing
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    mediaPlayer.setVolume(0.3f, 0.3f);
                }
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                // Restore full volume
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    mediaPlayer.setVolume(1.0f, 1.0f);
                }
                break;
        }
    }
}
