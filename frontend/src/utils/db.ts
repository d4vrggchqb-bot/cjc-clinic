/**
 * Lightweight IndexedDB Database for CJC Clinic Offline-First Operations
 */

const DB_NAME = 'cjc_clinic_offline_db';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id?: number;
  uuid: string;
  action: 'create_patient' | 'update_patient' | 'create_consultation' | 'create_borrowing' | 'return_borrowing';
  payload: any;
  timestamp: string;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
  retryCount: number;
}

class OfflineDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Stores
        if (!db.objectStoreNames.contains('patients')) {
          db.createObjectStore('patients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('consultations')) {
          db.createObjectStore('consultations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('borrowings')) {
          db.createObjectStore('borrowings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('uuid', 'uuid', { unique: true });
          queueStore.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- GENERIC STORE OPERATIONS ---
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get<T>(storeName: string, key: any): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async setMany<T extends { id: any }>(storeName: string, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async put<T>(storeName: string, item: T): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, key: any): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- SYNC QUEUE OPERATIONS ---
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'retryCount' | 'status'>): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const queueItem: SyncQueueItem = {
        ...item,
        status: 'pending',
        retryCount: 0,
      };
      const req = store.add(queueItem);
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingQueue(): Promise<SyncQueueItem[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as SyncQueueItem[];
        // Filter and sort by id (insertion order)
        resolve(list.filter(item => item.status !== 'syncing'));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getQueueCount(): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  async removeFromSyncQueue(id: number): Promise<void> {
    return this.delete('sync_queue', id);
  }

  async updateQueueItem(item: SyncQueueItem): Promise<void> {
    return this.put('sync_queue', item);
  }
}

export const offlineDb = new OfflineDB();
