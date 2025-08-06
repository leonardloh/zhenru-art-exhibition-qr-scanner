/**
 * PWA Utilities
 * Helper functions for Progressive Web App functionality
 */

export interface PWAInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWACapabilities {
  isStandalone: boolean;
  canInstall: boolean;
  hasServiceWorker: boolean;
  isOnline: boolean;
  hasNotificationSupport: boolean;
  hasBackgroundSync: boolean;
}

/**
 * Check if the app is running in standalone mode (installed as PWA)
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Check if the app can be installed as a PWA
 */
export function canInstall(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if beforeinstallprompt event is supported
  return 'onbeforeinstallprompt' in window;
}

/**
 * Check if service worker is supported and registered
 */
export function hasServiceWorker(): boolean {
  if (typeof window === 'undefined') return false;
  
  return 'serviceWorker' in navigator;
}

/**
 * Check if push notifications are supported
 */
export function hasNotificationSupport(): boolean {
  if (typeof window === 'undefined') return false;
  
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Check if background sync is supported
 */
export function hasBackgroundSync(): boolean {
  if (typeof window === 'undefined') return false;
  
  return 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype;
}

/**
 * Get comprehensive PWA capabilities
 */
export function getPWACapabilities(): PWACapabilities {
  return {
    isStandalone: isStandalone(),
    canInstall: canInstall(),
    hasServiceWorker: hasServiceWorker(),
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasNotificationSupport: hasNotificationSupport(),
    hasBackgroundSync: hasBackgroundSync(),
  };
}

/**
 * Register for push notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!hasNotificationSupport()) {
    throw new Error('Push notifications are not supported');
  }

  return await Notification.requestPermission();
}

/**
 * Show a local notification
 */
export function showNotification(title: string, options?: NotificationOptions): void {
  if (!hasNotificationSupport()) {
    console.warn('Notifications are not supported');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      ...options,
    });
  }
}

/**
 * Install prompt handler
 */
export class PWAInstallManager {
  private installPrompt: PWAInstallPrompt | null = null;
  private listeners: Array<(canInstall: boolean) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupInstallPromptListener();
    }
  }

  private setupInstallPromptListener(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as PWAInstallPrompt;
      this.notifyListeners(true);
    });

    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.notifyListeners(false);
    });
  }

  private notifyListeners(canInstall: boolean): void {
    this.listeners.forEach(listener => listener(canInstall));
  }

  public onInstallAvailable(callback: (canInstall: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // Immediately call with current state
    callback(this.canInstall());

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public canInstall(): boolean {
    return this.installPrompt !== null;
  }

  public async install(): Promise<boolean> {
    if (!this.installPrompt) {
      throw new Error('No install prompt available');
    }

    try {
      await this.installPrompt.prompt();
      const choiceResult = await this.installPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        this.installPrompt = null;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error during PWA installation:', error);
      return false;
    }
  }
}

/**
 * Cache management utilities
 */
export class PWACacheManager {
  private cacheName = 'qr-checkin-app-v1';

  public async cacheResources(resources: string[]): Promise<void> {
    if (!('caches' in window)) {
      console.warn('Cache API is not supported');
      return;
    }

    try {
      const cache = await caches.open(this.cacheName);
      await cache.addAll(resources);
    } catch (error) {
      console.error('Error caching resources:', error);
    }
  }

  public async getCachedResponse(request: string | Request): Promise<Response | undefined> {
    if (!('caches' in window)) {
      return undefined;
    }

    try {
      return await caches.match(request);
    } catch (error) {
      console.error('Error retrieving cached response:', error);
      return undefined;
    }
  }

  public async clearCache(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  public async getCacheSize(): Promise<number> {
    if (!('caches' in window)) {
      return 0;
    }

    try {
      const cache = await caches.open(this.cacheName);
      const keys = await cache.keys();
      return keys.length;
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }
}

/**
 * Background sync utilities
 */
export class PWABackgroundSync {
  public async registerBackgroundSync(tag: string): Promise<void> {
    if (!hasBackgroundSync()) {
      console.warn('Background sync is not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
    } catch (error) {
      console.error('Error registering background sync:', error);
    }
  }

  public async getBackgroundSyncTags(): Promise<string[]> {
    if (!hasBackgroundSync()) {
      return [];
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      return await (registration as ServiceWorkerRegistration & { sync: { getTags: () => Promise<string[]> } }).sync.getTags();
    } catch (error) {
      console.error('Error getting background sync tags:', error);
      return [];
    }
  }
}

// Export singleton instances
export const pwaInstallManager = new PWAInstallManager();
export const pwaCacheManager = new PWACacheManager();
export const pwaBackgroundSync = new PWABackgroundSync();

/**
 * Initialize PWA features
 */
export function initializePWA(): void {
  if (typeof window === 'undefined') return;

  // Log PWA capabilities
  const capabilities = getPWACapabilities();
  console.log('PWA Capabilities:', capabilities);

  // Cache critical resources
  const criticalResources = [
    '/',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
  ];

  pwaCacheManager.cacheResources(criticalResources);

  // Register background sync for offline operations
  if (capabilities.hasBackgroundSync) {
    pwaBackgroundSync.registerBackgroundSync('offline-sync');
  }

  // Show install prompt if available
  if (capabilities.canInstall && !capabilities.isStandalone) {
    pwaInstallManager.onInstallAvailable((canInstall) => {
      if (canInstall) {
        console.log('PWA can be installed');
        // You could show an install banner here
      }
    });
  }
}