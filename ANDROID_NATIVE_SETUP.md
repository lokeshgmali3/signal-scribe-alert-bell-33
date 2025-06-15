
# Android Native Implementation Setup

This guide explains how to set up the native Android features for reliable background signal alerts.

## Prerequisites

1. **Android Studio** installed
2. **Android device** with USB debugging enabled
3. **Developer Options** enabled on the device
4. **Git** for pulling the project

## Setup Steps

### 1. Pull Project from GitHub

```bash
git clone <your-github-repo-url>
cd signal-scribe-alert-bell-67
npm install
```

### 2. Add Android Platform

```bash
npx cap add android
```

### 3. Build and Sync

```bash
npm run build
npx cap sync android
```

### 4. Verify Plugin Files

The native plugin files should be automatically created in:
- `android/app/src/main/java/com/androidsignalplugin/`

If missing, check that all files were committed to your GitHub repo.

### 5. Open in Android Studio

```bash
npx cap open android
```

### 6. Build and Deploy

In Android Studio:
1. Connect your Android device via USB
2. Enable USB debugging on your device
3. Click "Run" button or use Ctrl+R
4. Select your device from the deployment target

Or use the command line:
```bash
npx cap run android
```

## Native Features Implemented

### ✅ AlarmManager Integration
- Exact alarm scheduling for signal times
- Survives app closure and device restarts
- Uses native Android alarms instead of JavaScript timers

### ✅ Foreground Service
- Keeps app process alive in background
- Silent persistent notification (required by Android)
- Prevents system from killing the app

### ✅ Native Audio Playback
- MediaPlayer for custom ringtones
- ToneGenerator for default beep
- Proper audio focus handling
- Works reliably when screen is off

### ✅ Battery Optimization
- Requests to ignore battery optimization
- Maintains background functionality
- Handles Doze mode and App Standby

## Testing

1. **Schedule signals** in the app
2. **Go to device settings** → Apps → Your App → Battery → Allow in background
3. **Turn off screen** and wait for signal time
4. **App should ring** even with screen off and app in background

## Troubleshooting

### No Background Ringing
1. Check battery optimization is disabled
2. Verify exact alarm permission (Android 12+)
3. Ensure notification permissions are granted
4. Check that foreground service is running

### Audio Not Playing
1. Verify audio focus is being requested
2. Check Do Not Disturb settings
3. Ensure volume is not muted
4. Test with both custom and default sounds

### Alarms Not Triggering
1. Check exact alarm permission in app settings
2. Verify alarm scheduling in Android Studio logs
3. Test with shorter time intervals first
4. Ensure device time is correct

## Permissions Required

The app requests these critical permissions:
- `SCHEDULE_EXACT_ALARM` - For precise signal timing
- `FOREGROUND_SERVICE` - To stay alive in background
- `WAKE_LOCK` - To wake device for signals
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` - For background reliability

## Development Notes

- Plugin automatically detects native vs web environment
- Falls back to web features if native unavailable
- All existing web functionality is preserved
- Audio-only mode works on both platforms

For issues, check Android Studio's Logcat for detailed error messages.
