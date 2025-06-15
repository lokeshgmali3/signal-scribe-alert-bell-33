
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

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

  function renderChromePermissionReset() {
    const siteSetUrl = getChromeSiteSettingsUrl();
    return (
      <div className="mt-3 text-xs bg-yellow-50 border border-yellow-300 rounded p-2 text-yellow-800">
        <b>Still seeing "Notifications Disabled" in Chrome after allowing?</b>
        <ul className="mt-1 ml-4 list-disc text-xs">
          <li>1. Click the <b>🔒 padlock</b> or <b>info</b> icon to the left of the address bar.</li>
          <li>2. Choose <b>Site settings</b>.</li>
          <li>3. Find <b>Notifications</b> and set it to <b>Allow</b>.</li>
          <li>4. Reload this page (Ctrl+R).</li>
        </ul>
        {siteSetUrl && (
          <div className="mt-1">
            <a
              href={siteSetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >Open Chrome site settings for this site</a>
          </div>
        )}
      </div>
    );
  }

  function getBrowserHelp() {
    if (browser === "Chrome" && effectivePermission === "denied") {
      return renderChromePermissionReset();
    }
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

  function renderDebugPanel() {
    return (
      <div className="bg-slate-50 rounded mt-3 border text-xs p-2 text-left font-mono select-text break-all">
        <div><b>Browser:</b> {browser}</div>
        <div><b>Web Notification.permission:</b> {webPermission ?? "N/A"}</div>
        <div><b>Capacitor LocalNotifications:</b> {capacitorPermission ?? "N/A"}</div>
        <div><b>Effective Permission:</b> {effectivePermission}</div>
        <div><b>Last Request Permission Result:</b> {lastPermResult ?? "N/A"}</div>
        <pre>{debug}</pre>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={async () => {
            await checkPermissions();
          }}
        >
          Re-check status
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-2 mt-2"
          onClick={handleTestNotification}
          disabled={testNotifStatus === "pending"}
        >
          {testNotifStatus === "pending" ? "Testing…" : "Test Notification"}
        </Button>
        {testNotifStatus === "ok" && (
          <div className="text-green-700 mt-1 font-bold">Test notification sent! {testNotifMessage}</div>
        )}
        {testNotifStatus === "fail" && (
          <div className="text-red-700 mt-1 font-bold">Failed: {testNotifMessage}</div>
        )}
      </div>
    );
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
