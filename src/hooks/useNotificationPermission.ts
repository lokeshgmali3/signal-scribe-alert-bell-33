
import { useEffect, useState, useCallback } from "react";

// Helper for browser detection
function detectBrowser(): "IE" | "Edge" | "Chrome" | "Firefox" | "Safari" | "Unknown" {
  if (typeof window === "undefined") return "Unknown";
  const ua = window.navigator.userAgent;
  if (/Trident\/|MSIE /.test(ua)) return "IE";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Unknown";
}

// Capacitor LocalNotifications support check & permission
async function getCapacitorNotificationPermission(): Promise<NotificationPermission | null> {
  try {
    if ((window as any).Capacitor && (window as any).Capacitor.Plugins?.LocalNotifications) {
      // Try to request & return permission status using Capacitor
      const perm = await (window as any).Capacitor.Plugins.LocalNotifications.checkPermissions();
      // 'granted'/'denied'/'prompt'
      if (perm?.display === "granted") return "granted";
      if (perm?.display === "denied") return "denied";
      return "default";
    }
  } catch (err) {
    // Fail quietly, fallback to web
  }
  return null;
}

export function useNotificationPermission() {
  const [webPermission, setWebPermission] = useState<NotificationPermission | null>(null);
  const [capacitorPermission, setCapacitorPermission] = useState<NotificationPermission | null>(null);
  const [browser, setBrowser] = useState<ReturnType<typeof detectBrowser>>("Unknown");
  const [debug, setDebug] = useState<string>("");

  const checkPermissions = useCallback(async () => {
    let dbg = "";
    // Web API
    let webPerm: NotificationPermission | null = null;
    if (typeof window !== "undefined" && "Notification" in window) {
      webPerm = Notification.permission;
      dbg += `Web Notification.permission: ${webPerm}\n`;
      setWebPermission(webPerm);
    } else {
      dbg += "Web Notification API not available\n";
    }
    // Capacitor (optional)
    let capPerm: NotificationPermission | null = null;
    if ((window as any).Capacitor && (window as any).Capacitor.Plugins?.LocalNotifications) {
      try {
        const result = await (window as any).Capacitor.Plugins.LocalNotifications.checkPermissions();
        if (result.display === "granted") {
          capPerm = "granted";
        } else if (result.display === "denied") {
          capPerm = "denied";
        } else {
          capPerm = "default";
        }
        dbg += `Capacitor LocalNotifications: ${capPerm}\n`;
      } catch (err) {
        dbg += `Capacitor LocalNotifications failed: ${String(err)}\n`;
      }
    } else {
      dbg += "Capacitor not available\n";
    }
    setCapacitorPermission(capPerm);
    setDebug(dbg);
    setBrowser(detectBrowser());
  }, []);

  useEffect(() => {
    checkPermissions();
    // Also refresh when focus returns (user may change permission)
    const onFocus = () => checkPermissions();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkPermissions]);

  // Unified view: prefer web, then capacitor
  const effectivePermission = 
    webPermission && webPermission !== "default" ? webPermission 
    : capacitorPermission ? capacitorPermission
    : "default";

  // Unified request - always try (even if already denied)
  const requestPermission = useCallback(async () => {
    let debugMsg = "";
    let lastResult: NotificationPermission | null = null;
    // Always try web Notification.requestPermission
    if ("Notification" in window) {
      try {
        debugMsg += "[WEB] Trying Notification.requestPermission...\n";
        const res = await Notification.requestPermission();
        setWebPermission(res);
        lastResult = res;
        debugMsg += `[WEB] requestPermission result: ${res}\n`;
      } catch (err) {
        debugMsg += `[WEB] requestPermission failed: ${String(err)}\n`;
      }
    }
    // Always try Capacitor if available
    if ((window as any).Capacitor?.Plugins?.LocalNotifications) {
      try {
        debugMsg += "[CAPACITOR] Trying LocalNotifications.requestPermissions...\n";
        const capRes = await (window as any).Capacitor.Plugins.LocalNotifications.requestPermissions();
        if (capRes.display === "granted") {
          setCapacitorPermission("granted");
          lastResult = "granted";
        } else if (capRes.display === "denied") {
          setCapacitorPermission("denied");
          lastResult = "denied";
        } else {
          setCapacitorPermission("default");
        }
        debugMsg += `[CAPACITOR] requestPermissions result: ${capRes.display}\n`;
      } catch (err) {
        debugMsg += `[CAPACITOR] requestPermissions failed: ${String(err)}\n`;
      }
    }
    setDebug(debugMsg);
    await checkPermissions(); // Always refresh after attempts
    return lastResult;
  }, [checkPermissions]);

  return {
    effectivePermission,
    webPermission,
    capacitorPermission,
    browser,
    debug,
    checkPermissions,
    requestPermission
  };
}
