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
              ? "Notifications Disabled"
              : "Notification Permission Needed"}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {effectivePermission === "denied" && (
            <span>
              <b>Notifications are denied.</b> This app cannot alert you about signals in the background.<br />
              Please enable notifications in your browser or device settings.<br />
              If you clicked "Block", you must reset permissions before enabling again.<br />
              You may need to reset site permissions and restart your browser.
            </span>
          )}
          {effectivePermission === "default" && (
            <span>
              To receive signal alerts when this tab is closed or minimized, you must enable notifications.<br />
              Please grant permission below.<br />
              <span className="font-semibold">
                {browser === "Chrome"
                  ? 'If you block notifications, Chrome will NOT prompt you again until you reset permissions manually using the instructions below.'
                  : ''}
              </span>
            </span>
          )}
          {/* Show browser-specific help */}
          <BrowserHelp browser={browser} effectivePermission={effectivePermission} />
          {/* Show extra Chrome instructions if in denied and Chrome */}
          {shouldShowChromeHelp() && (
            <ChromeSiteSettingsHelp />
          )}
          {/* Additional Chrome permission reset if needed */}
          {/* Could re-enable if you want more persistent help: <ChromePermissionReset /> */}
          <div className="mt-2">
            <Button
              onClick={async () => {
                // Always try both web/capacitor permissions no matter the status
                let result: NotificationPermission = "default";
                try {
                  // Try via custom hook now (unified logic & extra debug)
                  const reqResult = await requestPermission();
                  setLastPermResult(reqResult as NotificationPermission);
                  if (reqResult) {
                    console.log("Notification.requestPermission unified result:", reqResult);
                  }
                } catch (err) {
                  setLastPermResult("denied");
                  console.error("Permission request error:", err);
                }
                // Always check/refresh immediately after request
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
          </div>
          {/* Troubleshooting section for stuck users */}
          <div className="mt-4 p-2 border rounded text-xs bg-gray-50 text-gray-700">
            <b>Troubleshooting Tips:</b>
            <ul className="list-disc ml-5 mt-1">
              <li>If you denied/block notifications earlier, reset permissions in your browser's site settings (<b>Site settings &gt; Notifications &gt; Reset/Allow</b>).</li>
              <li>After resetting, reload this page and try again.</li>
              <li>If you still can't enable, fully close and reopen all browser windows before trying again (Chrome: this step often resolves caching issues).</li>
              <li>Try another browser or use an incognito/private window.</li>
            </ul>
            <span className="mt-1 block text-gray-600">
              Still stuck? See detailed help above or ask for support.
            </span>
          </div>
          {showDebug && (
            <DebugPanel
              browser={browser}
              webPermission={webPermission}
              capacitorPermission={capacitorPermission}
              effectivePermission={effectivePermission}
              lastPermResult={lastPermResult}
              debug={debug}
              checkPermissions={checkPermissions}
              handleTestNotification={handleTestNotification}
              testNotifStatus={testNotifStatus}
              testNotifMessage={testNotifMessage}
            />
          )}
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
