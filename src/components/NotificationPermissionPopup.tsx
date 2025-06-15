import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

function getChromeSiteSettingsUrl(): string | null {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`;
}

function getChromeSiteSettingsHelp() {
  // Chrome disables direct links to chrome:// settings!
  return (
    <div className="mt-3 text-xs bg-yellow-50 border border-yellow-300 rounded p-2 text-yellow-800">
      <b>Still seeing “Notifications Disabled” in Chrome?</b>
      <ol className="mt-1 ml-4 list-decimal text-xs">
        <li>Click the <b>🔒 padlock</b> or <b>info</b> icon to the left of the address bar.</li>
        <li>Choose <b>Site settings</b>.</li>
        <li>Find <b>Notifications</b> and set it to <b>Allow</b>.</li>
        <li>
          <span>After making changes,</span>{" "}
          <button
            className="underline text-blue-700 ml-1"
            onClick={() => window.location.reload()}
          >
            refresh this page
          </button>
          .
        </li>
      </ol>
      <div className="mt-1 text-[10px] text-gray-600">
        Tip: If “Allow” isn't possible, select “Reset permissions” for this site first,<br />
        or go to <b>chrome://settings/content/notifications</b> and search for this site to remove settings.
        <br />
        <span className="font-semibold">If you still can't enable, try quitting all Chrome windows and reopening, then reload and retry.</span>
      </div>
    </div>
  );
}

// Add this utility component for an expandable troubleshooting section
function TroubleshootingPanel() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-3">
      <button
        className="underline text-sm text-blue-700"
        onClick={() => setOpen((cur) => !cur)}
      >
        {open ? "Hide Troubleshooting" : "Troubleshooting"}
      </button>
      {open && (
        <div className="mt-2 bg-slate-50 border border-slate-300 rounded p-3 text-xs text-slate-700">
          <div>
            <b>Typical issues &amp; fixes:</b>
            <ul className="list-disc ml-5 mt-1 space-y-1">
              <li>
                <b>Blocked Prompt:</b> If you clicked <i>Block</i> or dismissed the popup, notifications are now blocked for this site.
              </li>
              <li>
                <b>To Unblock:</b> Click the <b>🔒 padlock</b> (or info icon) in the address bar, choose <b>Site settings</b> &gt; <b>Notifications</b>, and set to <b>Allow</b>. Then <b>reload</b> the page.
              </li>
              <li>
                <b>No “Allow” Option?</b> Click <b>Reset permissions</b>, or 
                <span> go to your browser’s notification settings, search for this site, and remove the block to try again.</span>
              </li>
              <li>
                <b>If still stuck:</b> Close all tabs/windows of this site, fully quit Chrome, relaunch, and reload.
              </li>
              <li>
                Some browsers automatically suppress notification prompts if “Block” was chosen — you must <b>reset</b> permission manually, then “Allow” at the prompt.
              </li>
            </ul>
            <div className="mt-2 text-[11px] text-gray-500">
              <b>Note:</b> Notifications prompts may not appear in private/incognito mode or some preview environments.
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
      return getChromeSiteSettingsHelp();
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
              : "Enable Notifications"}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <span className="block mb-2">
            {effectivePermission === "denied" ? (
              <>
                <b>Notifications are currently <span className="text-red-700">blocked</span>.</b><br />
                To receive important alerts when the app is closed or minimized, you need to allow notifications for this site.
              </>
            ) : (
              <>
                Please enable notifications so the app can alert you even if this tab is inactive or closed.
              </>
            )}
            <br />
            <b>What happens if I click <span className="font-mono">Block</span>?</b>
            <br />
            If you deny or dismiss the browser prompt, this site cannot show notifications. You must manually <b>reset</b> and <b>allow</b> permission in your browser's site settings to fix it.
          </span>
          {getBrowserHelp()}
          <TroubleshootingPanel />
          <div className="mt-2">
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
              {effectivePermission === "default" ? "Allow Notifications" : "Retry Enable"}
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
