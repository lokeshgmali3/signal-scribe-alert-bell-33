
#!/bin/bash

echo "🚀 Building Signal Scribe for Android..."

# Build the web app
echo "📦 Building web app..."
npm run build

# Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync android

# Copy custom plugin files if they don't exist
echo "📁 Checking plugin files..."
PLUGIN_DIR="android/app/src/main/java/com/androidsignalplugin"
if [ ! -d "$PLUGIN_DIR" ]; then
    echo "⚠️  Plugin directory not found. Make sure to copy the plugin files manually."
    echo "   Plugin files should be in: $PLUGIN_DIR"
fi

echo "✅ Build preparation complete!"
echo ""
echo "Next steps:"
echo "1. Open Android Studio: npx cap open android"
echo "2. Connect your phone via USB with Developer Options enabled"
echo "3. Build and run the app from Android Studio"
echo ""
echo "Or run directly: npx cap run android"
