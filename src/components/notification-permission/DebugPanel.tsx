
import React from "react";
import { Button } from "@/components/ui/button";

interface DebugPanelProps {
  browser: string;
  webPermission: NotificationPermission | null;
  capacitorPermission: NotificationPermission | null;
  effectivePermission: NotificationPermission | null;
  lastPermResult: NotificationPermission | null;
  debug: string;
  checkPermissions: () => Promise<void>;
  handleTestNotification: () => Promise<void>;
  testNotifStatus: null | "ok" | "fail" | "pending";
  testNotifMessage: string;
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  browser,
  webPermission,
  capacitorPermission,
  effectivePermission,
  lastPermResult,
  debug,
  checkPermissions,
  handleTestNotification,
  testNotifStatus,
  testNotifMessage,
}) => (
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

export default DebugPanel;
