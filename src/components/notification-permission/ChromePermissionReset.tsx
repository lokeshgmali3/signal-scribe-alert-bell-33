
import React from "react";

function getChromeSiteSettingsUrl(): string | null {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(origin)}`;
}

const ChromePermissionReset: React.FC = () => {
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
};

export default ChromePermissionReset;
