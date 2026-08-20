import React, { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { syncManager } from '../utils/syncManager';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  isForcedOffline: boolean;
  triggerSync: () => Promise<void>;
  checkConnectivity: () => Promise<boolean>;
  toggleForceOffline: () => boolean;
}

const SyncContext = createContext<SyncContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  isForcedOffline: false,
  triggerSync: async () => {},
  checkConnectivity: async () => true,
  toggleForceOffline: () => false,
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [syncState, setSyncState] = useState(syncManager.getState());

  useEffect(() => {
    let prevPending = syncState.pendingCount;

    const unsubscribe = syncManager.subscribe((state) => {
      // Toast if sync completed
      if (prevPending > 0 && state.pendingCount === 0 && !state.isSyncing) {
        toast.success(`Synchronized ${prevPending} offline record${prevPending > 1 ? 's' : ''} to central database!`);
      }
      prevPending = state.pendingCount;
      setSyncState(state);
    });

    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    const res = await syncManager.triggerSync();
    if (res.synced > 0) {
      toast.success(`Successfully synced ${res.synced} item${res.synced > 1 ? 's' : ''}!`);
    } else if (res.failed > 0) {
      toast.error('Unable to sync right now. Will automatically retry once connection is stable.');
    } else {
      toast.success('All records are up to date!');
    }
  };

  const handleCheckConnectivity = async (): Promise<boolean> => {
    const online = await syncManager.checkConnectivity();
    if (online) {
      toast.success('Connected to Clinic Server!', { icon: '🌐' });
    } else {
      toast.error('Clinic Server is unreachable. Working in Offline Mode.', { icon: '📴' });
    }
    return online;
  };

  const handleToggleOffline = () => {
    const forced = syncManager.toggleForceOffline();
    if (forced) {
      toast('Switched to Offline Mode. Records will be saved locally in IndexedDB.', { icon: '📴' });
    } else {
      toast('Switched to Online Mode. Checking server connection...', { icon: '🌐' });
    }
    return forced;
  };

  return (
    <SyncContext.Provider
      value={{
        ...syncState,
        triggerSync: handleManualSync,
        checkConnectivity: handleCheckConnectivity,
        toggleForceOffline: handleToggleOffline,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
