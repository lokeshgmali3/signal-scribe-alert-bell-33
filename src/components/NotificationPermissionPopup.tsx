import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import BrowserHelp from "./notification-permission/BrowserHelp";
import ChromeSiteSettingsHelp from "./notification-permission/ChromeSiteSettingsHelp";
import ChromePermissionReset from "./notification-permission/ChromePermissionReset";
import DebugPanel from "./notification-permission/DebugPanel";

function getChromeSiteSettingsUrl(): string | null {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`;
}

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
  const [lastPermResult, setLastPermResult] = useState<NotificationPermission | null>(null);
  const [testNotifStatus, setTestNotifStatus] = useState<null | "ok" | "fail" | "pending">(null);
  const [testNotifMessage, setTestNotifMessage] = useState<string>("");

  React.useEffect(() => {
    if (effectivePermission === "default" || effectivePermission === "denied") {
      setShowDialog(true);
    } else {
      setShowDialog(false);
    }
  }, [effectivePermission]);

  // Try to send a test notification to see if it's really functioning
  async function handleTestNotification() {
    setTestNotifStatus("pending");
    setTestNotifMessage("");
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification("🚦 Test Notification", { body: "Signal Tracker: test notification sent!", silent: true });
        setTestNotifStatus("ok");
        setTestNotifMessage("Test notification dispatched! (Check your OS notification area)");
        setTimeout(() => n.close && n.close(), 4000);
      } else if ((window as any).Capacitor?.Plugins?.LocalNotifications) {
        await (window as any).Capacitor.Plugins.LocalNotifications.schedule({
          notifications: [
            {
              title: "🚦 Test Notification",
              body: "Signal Tracker: test notification (Capacitor)!",
              id: Date.now(),
              schedule: { at: new Date() }
            }
          ]
        });
        setTestNotifStatus("ok");
        setTestNotifMessage("Capacitor notification dispatched.");
      } else {
        setTestNotifStatus("fail");
        setTestNotifMessage("Notifications are not enabled or your browser does not support them.");
      }
    } catch (err: any) {
      setTestNotifStatus("fail");
      setTestNotifMessage("Failed to send notification: " + err?.message || String(err));
    }
  }

  // Helper to show Chrome settings/help for denied state
  function shouldShowChromeHelp() {
    return browser === "Chrome" && effectivePermission === "denied";
  }

  if (!showDialog) return null;

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="max-w-xs sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {effectivePermission === "denied"
              ? "Notifications Denied"
              : "Notification Permission Needed"}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {effectivePermission === "denied" ? (
            // New message for denied state
            <div>
              <b>Notifications are denied.</b>
              <br />
              This app cannot alert you about signals in the background.<br />
              Please enable notifications in your browser or device settings.
              <div className="mt-3">
                <b>Steps to enable in browser:</b>
                <ol className="list-decimal ml-6 mt-1 text-sm">
                  <li>Open lovable preview in new tab,</li>
                  <li>Manually reset notification permission</li>
                  <li>Reload site</li>
                  <li>Allow browser's notification popup</li>
                </ol>
              </div>
            </div>
          ) : (
            <span>
              To receive signal alerts when this tab is closed or minimized, you must enable notifications.<br />
              Please grant permission below.<br />
              <span className="font-semibold">
                {browser === "Chrome"
                  ? 'If you block notifications, Chrome will NOT prompt you again until you reset permissions manually using the instructions below.'
                  : ''}
              </span>
              <BrowserHelp browser={browser} effectivePermission={effectivePermission} />
              {browser === "Chrome" && effectivePermission === "denied" && (
                <ChromeSiteSettingsHelp />
              )}
            </span>
          )}
        </DialogDescription>
        <DialogFooter>
          {effectivePermission !== "denied" && (
            <>
              <Button
                onClick={async () => {
                  let result: NotificationPermission = "default";
                  try {
                    const reqResult = await requestPermission();
                    setLastPermResult(reqResult as NotificationPermission);
                    if (reqResult) {
                      console.log("Notification.requestPermission unified result:", reqResult);
                    }
                  } catch (err) {
                    setLastPermResult("denied");
                    console.error("Permission request error:", err);
                  }
                  await checkPermissions();
                }}
                size="sm"
                variant="default"
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
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowDialog(false)}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
