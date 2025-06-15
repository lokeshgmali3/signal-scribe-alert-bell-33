
import React, { useEffect, useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const getNotificationPermission = (): NotificationPermission | null => {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
};

export default function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission | null>(
    getNotificationPermission()
  );
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    if (permission === "denied" || permission === "default") {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [permission]);

  const requestPermission = async () => {
    if ("Notification" in window) {
      try {
        const newPerm = await Notification.requestPermission();
        setPermission(newPerm);
      } catch {}
    }
  };

  if (!show) return null;

  return (
    <div className="fixed top-0 z-50 w-full flex justify-center items-center pb-2 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg">
        <Alert variant={permission === "denied" ? "destructive" : "default"}>
          <AlertTitle>
            {permission === "denied"
              ? "Notifications Disabled"
              : "Notification Permission Needed"}
          </AlertTitle>
          <AlertDescription>
            {permission === "denied" && (
              <span>
                You have denied notification permissions. This app cannot alert you about signals in the background. Please enable notifications in your browser or device settings.
              </span>
            )}
            {permission === "default" && (
              <span>
                Enable notifications to receive alerts about your trading signals even when this tab is closed or your screen is off.
              </span>
            )}
          </AlertDescription>
          {permission === "default" && (
            <Button onClick={requestPermission} size="sm" className="mt-2">
              Enable Notifications
            </Button>
          )}
        </Alert>
      </div>
    </div>
  );
}
