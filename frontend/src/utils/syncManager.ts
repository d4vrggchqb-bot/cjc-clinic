import { apiFetch } from './api';
import { offlineDb, SyncQueueItem } from './db';

export type SyncStateListener = (state: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  isForcedOffline: boolean;
}) => void;

class SyncManager {
  private isOnline: boolean = true;
  private isForcedOffline: boolean = false;
  private isSyncing: boolean = false;
  private pendingCount: number = 0;
  private lastSyncedAt: Date | null = null;
  private listeners: Set<SyncStateListener> = new Set();
  private autoSyncInterval: any = null;
  private pingInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.isForcedOffline = sessionStorage.getItem('cjc_force_offline') === 'true';
      } catch {
        this.isForcedOffline = false;
      }

      window.addEventListener('online', () => this.checkConnectivity());
      window.addEventListener('offline', () => this.setOnlineStatus(false));
      
      this.refreshPendingCount();
      this.checkConnectivity();
      this.startSyncLoop();
    }
  }

  public getIsOnline(): boolean {
    if (this.isForcedOffline) return false;
    return this.isOnline;
  }

  public toggleForceOffline(): boolean {
    this.isForcedOffline = !this.isForcedOffline;
    try {
      sessionStorage.setItem('cjc_force_offline', String(this.isForcedOffline));
    } catch {}

    if (this.isForcedOffline) {
      this.isOnline = false;
      this.notify();
    } else {
      this.checkConnectivity();
    }
    return this.isForcedOffline;
  }

  public async checkConnectivity(): Promise<boolean> {
    if (this.isForcedOffline) {
      this.setOnlineStatus(false);
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setOnlineStatus(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Probe our own clinic API health check endpoint
      const res = await fetch(`/api/index.php?route=sync&action=ping&_t=${Date.now()}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const online = res.ok;
      this.setOnlineStatus(online);
      return online;
    } catch {
      // Fallback: If server is temporarily unreachable, evaluate based on browser network status
      const fallbackOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      this.setOnlineStatus(fallbackOnline);
      return fallbackOnline;
    }
  }

  private setOnlineStatus(online: boolean) {
    const wasOffline = !this.isOnline;
    this.isOnline = this.isForcedOffline ? false : online;
    this.notify();

    if (wasOffline && this.isOnline) {
      this.triggerSync();
    }
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public getState() {
    return {
      isOnline: this.getIsOnline(),
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      isForcedOffline: this.isForcedOffline,
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  public async refreshPendingCount() {
    try {
      this.pendingCount = await offlineDb.getQueueCount();
      this.notify();
    } catch (e) {
      console.warn('Failed to get pending queue count', e);
    }
  }

  private startSyncLoop() {
    if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
    this.autoSyncInterval = setInterval(() => {
      if (this.getIsOnline() && !this.isSyncing && this.pendingCount > 0) {
        this.triggerSync();
      }
    }, 15000);

    // Periodic connectivity check every 30 seconds (or on browser online/offline events)
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.checkConnectivity();
    }, 30000);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.checkConnectivity());
      window.addEventListener('offline', () => this.setOnlineStatus(false));
    }
  }

  public destroy() {
    if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  /**
   * Queue an offline mutation action
   */
  public async queueAction(
    action: SyncQueueItem['action'],
    payload: any
  ): Promise<{ success: boolean; uuid: string }> {
    const uuid = 'offline-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    
    await offlineDb.addToSyncQueue({
      uuid,
      action,
      payload,
      timestamp: new Date().toISOString(),
    });

    await this.refreshPendingCount();

    // If online, attempt immediate sync
    if (this.getIsOnline()) {
      this.triggerSync();
    }

    return { success: true, uuid };
  }

  /**
   * Trigger synchronization of all queued items
   */
  public async triggerSync(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing || !this.getIsOnline()) return { synced: 0, failed: 0 };

    const queue = await offlineDb.getPendingQueue();
    if (queue.length === 0) {
      this.notify();
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notify();

    let synced = 0;
    let failed = 0;

    try {
      const response = await apiFetch('/api/index.php?route=sync&action=batch', {
        method: 'POST',
        body: JSON.stringify({ batch: queue }),
      });

      if (response && response.success && Array.isArray(response.results)) {
        for (const result of response.results) {
          if (result.success && result.uuid) {
            const item = queue.find(q => q.uuid === result.uuid);
            if (item && item.id) {
              await offlineDb.removeFromSyncQueue(item.id);
              synced++;
            }
          } else {
            failed++;
          }
        }
        this.lastSyncedAt = new Date();

        if (synced > 0 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cjc-sync-completed', { detail: { synced } }));
        }
      } else {
        failed = queue.length;
      }
    } catch (err: any) {
      console.warn('Sync failed (likely still offline):', err);
      this.isOnline = false;
      failed = queue.length;
    } finally {
      this.isSyncing = false;
      await this.refreshPendingCount();
    }

    return { synced, failed };
  }
}

export const syncManager = new SyncManager();
