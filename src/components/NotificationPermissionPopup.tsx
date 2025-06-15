
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

export default function NotificationPermissionPopup() {
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
  const [showDialog, setShowDialog] = useState(
    effectivePermission === "default" || effectivePermission === "denied"
  );

  // Show dialog if permission not granted/denied
  React.useEffect(() => {
    if (effectivePermission === "default" || effectivePermission === "denied") {
      setShowDialog(true);
    } else {
      setShowDialog(false);
    }
  }, [effectivePermission]);

  function getBrowserHelp() {
    if (browser === "IE" || browser === "Edge") {
      return (
        <div className="text-xs text-yellow-900 mt-2">
          You're using Internet Explorer or Edge. Notifications support is limited.<br />
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
          Check Firefox Preferences → Privacy &amp; Security → Permissions → Notifications, and ensure this site is Not Blocked.
        </div>
      );
    }
    if (browser === "Safari") {
      return (
        <div className="text-xs text-gray-800 mt-2">
          Please enable notifications in Safari Preferences → Websites → Notifications. If denied, remove and re-add permission.
        </div>
      );
    }
    return (
      <div className="text-xs text-gray-700 mt-2">
        Please enable notifications in your browser's site settings.
      </div>
    );
  }

  // Debug panel
  function renderDebugPanel() {
    return (
      <div className="bg-slate-50 rounded mt-3 border text-xs p-2 text-left font-mono select-text break-all">
        <div><b>Browser:</b> {browser}</div>
        <div><b>Web Notification.permission:</b> {webPermission ?? "N/A"}</div>
        <div><b>Capacitor LocalNotifications:</b> {capacitorPermission ?? "N/A"}</div>
        <pre>{debug}</pre>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => {
            console.log("Re-check status clicked");
            checkPermissions();
          }}
        >
          Re-check status
        </Button>
      </div>
    );
  }

  // Only show modal if permission denied or default
  if (!showDialog) return null;

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="max-w-xs sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {effectivePermission === "denied"
              ? "Notifications Disabled"
              : "Notification Permission Needed"}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {effectivePermission === "denied" && (
            <span>
              <b>Notifications are denied.</b> This app cannot alert you about signals in the background.<br />
              Please enable notifications in your browser or device settings.<br />
              You may need to reset site permissions and restart your browser.
            </span>
          )}
          {effectivePermission === "default" && (
            <span>
              To receive signal alerts when this tab is closed or minimized, you must enable notifications.<br />
              Please grant permission below.
            </span>
          )}
          {getBrowserHelp()}
          <div className="mt-2">
            <Button
              onClick={async () => {
                console.log("Enable Notifications clicked");
                await requestPermission();
                setTimeout(() => checkPermissions(), 500);
              }}
              size="sm"
            >
              Enable Notifications
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={() => setShowDebug((s) => !s)}
            >
              {showDebug ? "Hide Debug" : "Show Debug"}
            </Button>
          </div>
          {showDebug && renderDebugPanel()}
        </DialogDescription>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setShowDialog(false)}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
