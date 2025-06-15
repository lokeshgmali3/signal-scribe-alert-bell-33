
import React, { useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

export default function NotificationPermissionBanner() {
  const {
    effectivePermission,
    webPermission,
    capacitorPermission,
    browser,
    debug,
    requestPermission,
    checkPermissions,
  } = useNotificationPermission();

  const [showDebug, setShowDebug] = useState(false);
  const show =
    effectivePermission === "default" || effectivePermission === "denied";

  if (!show) return null;

  function getBrowserHelp() {
    if (browser === "IE" || browser === "Edge") {
      return (
        <div className="text-xs text-yellow-900 mt-2">
          You're using Internet Explorer or Edge. Notifications support is limited. <br />
          - Enable notifications in your browser site settings.<br />
          - Make sure your Windows OS notifications are enabled.<br />
          <span className="font-medium">Troubleshooting:</span> Try restarting your browser, or <a
            href="https://support.microsoft.com/en-us/windows/change-notification-settings-in-windows-10-59c8591a-d4d7-6b8b-48c4-3bcb7b4166c4"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >see Windows notification guide</a>.
        </div>
      );
    }
    if (browser === "Chrome") {
      return (
        <div className="text-xs text-gray-800 mt-2">
          Please allow notifications (via the lock 🔒/info ℹ️ icon in the address bar, Site Settings). If you denied, you may need to reset permission.
        </div>
      );
    }
    if (browser === "Firefox") {
      return (
        <div className="text-xs text-gray-800 mt-2">
          Check Firefox Preferences &rarr; Privacy &amp; Security &rarr; Permissions &rarr; Notifications, and ensure this site is Not Blocked.
        </div>
      );
    }
    if (browser === "Safari") {
      return (
        <div className="text-xs text-gray-800 mt-2">
          Please enable notifications in Safari Preferences &rarr; Websites &rarr; Notifications. If denied, remove and re-add permission.
        </div>
      );
    }
    return (
      <div className="text-xs text-gray-700 mt-2">
        Please enable notifications in your browser's site settings.
      </div>
    );
  }

  // Show detailed states for debugging
  function renderDebugPanel() {
    return (
      <div className="bg-slate-50 rounded mt-3 border text-xs p-2 text-left font-mono select-text break-all">
        <div><b>Browser:</b> {browser}</div>
        <div><b>Web Notification.permission:</b> {webPermission ?? "N/A"}</div>
        <div><b>Capacitor LocalNotifications:</b> {capacitorPermission ?? "N/A"}</div>
        <pre>{debug}</pre>
        <Button variant="secondary" size="sm" className="mt-2" onClick={checkPermissions}>
          Re-check status
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 z-50 w-full flex justify-center items-center pb-2 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg">
        <Alert
          variant={effectivePermission === "denied" ? "destructive" : "default"}
        >
          <AlertTitle>
            {effectivePermission === "denied"
              ? "Notifications Disabled"
              : "Notification Permission Needed"}
          </AlertTitle>
          <AlertDescription>
            {effectivePermission === "denied" && (
              <span>
                <b>Notifications are denied.</b> This app cannot alert you about signals in the background.<br />
                Please enable notifications in your browser or device settings.<br />
                You may need to reset site permissions and restart your browser.
              </span>
            )}
            {effectivePermission === "default" && (
              <span>
                To receive signal alerts when this tab is closed or minimized, you must enable notifications.
                <br />
                Please grant permission below.
              </span>
            )}
            {getBrowserHelp()}
            <div>
              <Button
                onClick={async () => {
                  await requestPermission();
                }}
                size="sm"
                className="mt-2"
              >
                Enable Notifications
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 mt-2"
                onClick={() => setShowDebug((s) => !s)}
              >
                {showDebug ? "Hide Debug" : "Show Debug"}
              </Button>
            </div>
            {showDebug && renderDebugPanel()}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
