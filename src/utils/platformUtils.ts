
export class PlatformUtils {
  static isAndroidPlatform(): boolean {
    return /android/i.test(navigator.userAgent);
  }

  static isIOSPlatform(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  static isMobilePlatform(): boolean {
    return this.isAndroidPlatform() || this.isIOSPlatform();
  }

  static isWebPlatform(): boolean {
    return !this.isMobilePlatform();
  }
}
