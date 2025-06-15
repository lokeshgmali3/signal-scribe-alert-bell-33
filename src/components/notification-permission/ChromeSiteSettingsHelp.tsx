
import React from "react";

const ChromeSiteSettingsHelp: React.FC = () => (
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

export default ChromeSiteSettingsHelp;
