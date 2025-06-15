
import React from "react";

export const BackgroundDebugPanel = () => {
  const [status, setStatus] = React.useState<any>({});

  React.useEffect(() => {
    function update() {
      setStatus((window as any).bgServiceDebug || {});
    }
    update();
    window.addEventListener("app-foreground", update);
    setInterval(update, 1500);
    return () => window.removeEventListener("app-foreground", update);
  }, []);

  return (
    <div className="p-2 text-xs bg-gray-900 text-green-300 border border-green-700 rounded mt-2 max-w-xl mx-auto">
      <div><b>Background/Foreground Debug Info</b></div>
      <pre className="overflow-x-auto whitespace-pre-wrap max-h-32">
        {JSON.stringify(status, null, 2)}
      </pre>
    </div>
  );
};
export default BackgroundDebugPanel;
