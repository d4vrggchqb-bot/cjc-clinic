import React from 'react';
import { FiWifi, FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { useSync } from '../context/SyncContext';

export const SyncStatusBadge: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, triggerSync, checkConnectivity } = useSync();

  // 1. Currently Syncing
  if (isSyncing) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold shadow-xs animate-pulse cursor-wait select-none"
        title="Syncing pending offline data to central clinic server..."
      >
        <FiRefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
        <span>Syncing{pendingCount > 0 ? ` (${pendingCount})` : '...'}</span>
      </div>
    );
  }

  // 2. Disconnected / Offline Mode
  if (!isOnline) {
    return (
      <button
        onClick={() => {
          if (pendingCount > 0) {
            triggerSync();
          } else {
            checkConnectivity();
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-bold shadow-xs hover:bg-rose-100 transition-colors cursor-pointer"
        title={
          pendingCount > 0
            ? `${pendingCount} offline record(s) queued. Click to retry connection and sync.`
            : 'Disconnected from Clinic Server. Click to retry connection.'
        }
      >
        <FiWifiOff className="w-3.5 h-3.5 text-rose-600" />
        <span>Offline{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
        <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-200/80 px-1 py-0.2 rounded ml-0.5">
          Retry
        </span>
      </button>
    );
  }

  // 3. Online with Pending Unsynced Records
  if (pendingCount > 0) {
    return (
      <button
        onClick={() => triggerSync()}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold shadow-xs hover:bg-amber-100 transition-colors cursor-pointer"
        title={`${pendingCount} offline record(s) ready to sync. Click to upload now.`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
        <span>{pendingCount} Pending Sync</span>
        <FiRefreshCw className="w-3 h-3 text-amber-700 ml-0.5" />
      </button>
    );
  }

  // 4. Fully Connected (Normal Operational State)
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-2xs select-none"
      title="Connected to Clinic Server (LAN)"
    >
      <FiWifi className="w-3.5 h-3.5 text-emerald-600" />
      <span>Online</span>
    </div>
  );
};

export default SyncStatusBadge;
