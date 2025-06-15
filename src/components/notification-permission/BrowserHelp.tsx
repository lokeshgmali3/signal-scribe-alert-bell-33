
import React from "react";

interface BrowserHelpProps {
  browser: string;
  effectivePermission: NotificationPermission | null;
}

const BrowserHelp: React.FC<BrowserHelpProps> = ({ browser, effectivePermission }) => {
  if (browser === "Chrome" && effectivePermission === "denied") {
    return null; // ChromeSettingsHelp handled separately
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
};

export default BrowserHelp;
