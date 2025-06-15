
// Remove ALL interval-based background detection. Comment any previous export.

///// BEGIN: Remove/disable web background task system. /////

// @ts-ignore
// export const startBackgroundTask = async () => {};
// @ts-ignore
// export const stopBackgroundTask = () => {};
// @ts-ignore
// export const scheduleAllSignalNotifications = async (signals: any[]) => {};
// @ts-ignore
// export const getBackgroundTaskStatus = () => ({ isActive: false, hasInterval: false, taskInstanceId: null, globalStatus: {} });

///// END: All interval-based detection replaced by BackgroundMonitoringManager. /////

// Leave the file for future single export only, or for methods that call into the main manager.

